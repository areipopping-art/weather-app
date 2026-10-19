import "server-only";
import type { Day, Hour, PollenDay } from "./types";

// Open-Meteo（無料・APIキー不要）
// OpenWeatherMap の無料プランに無い「1時間ごとの予報」「15分ごとの降水量」「UV」「花粉」を補う
const FORECAST = "https://api.open-meteo.com/v1/forecast";
const AIR = "https://air-quality-api.open-meteo.com/v1/air-quality";

type ForecastApi = {
  utc_offset_seconds: number;
  minutely_15: { time: string[]; precipitation: (number | null)[] };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: (number | null)[];
    precipitation: number[];
    weather_code: number[];
    uv_index: (number | null)[];
    relative_humidity_2m: number[];
    wind_speed_10m: number[];
    shortwave_radiation: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
    precipitation_sum: number[];
    uv_index_max: (number | null)[];
    wind_speed_10m_max: number[];
  };
};

async function get<T>(url: string, params: Record<string, string | number>): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`${url}?${qs}`, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return res.json() as Promise<T>;
}

// 暑さ指数（WBGT）の推定式（小野ら 2014）。気温・湿度・日射量・風速から計算
function estimateWbgt(temp: number, rh: number, radiationWm2: number, wind: number) {
  const sr = radiationWm2 / 1000;
  return 0.735 * temp + 0.0374 * rh + 0.00292 * temp * rh + 7.619 * sr - 4.557 * sr * sr - 0.0572 * wind - 4.064;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function getForecast(lat: number, lon: number) {
  const d = await get<ForecastApi>(FORECAST, {
    latitude: lat,
    longitude: lon,
    timezone: "auto",
    forecast_days: 7,
    forecast_minutely_15: 12, // この先3時間
    wind_speed_unit: "ms",
    minutely_15: "precipitation",
    hourly:
      "temperature_2m,precipitation_probability,precipitation,weather_code,uv_index,relative_humidity_2m,wind_speed_10m,shortwave_radiation",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,uv_index_max,wind_speed_10m_max",
  });

  const h = d.hourly;
  const hours: Hour[] = h.time.map((time, i) => ({
    time,
    temp: h.temperature_2m[i],
    pop: h.precipitation_probability[i] ?? 0,
    precip: h.precipitation[i] ?? 0,
    code: h.weather_code[i],
    uv: round1(h.uv_index[i] ?? 0),
    humidity: h.relative_humidity_2m[i],
    wind: h.wind_speed_10m[i],
    wbgt: round1(estimateWbgt(h.temperature_2m[i], h.relative_humidity_2m[i], h.shortwave_radiation[i] ?? 0, h.wind_speed_10m[i])),
  }));

  const dl = d.daily;
  const days: Day[] = dl.time.map((date, i) => {
    const dayHours = hours.filter((x) => x.time.startsWith(date));
    return {
      date,
      code: dl.weather_code[i],
      min: dl.temperature_2m_min[i],
      max: dl.temperature_2m_max[i],
      pop: dl.precipitation_probability_max[i] ?? 0,
      precipSum: round1(dl.precipitation_sum[i] ?? 0),
      uvMax: round1(dl.uv_index_max[i] ?? 0),
      windMax: dl.wind_speed_10m_max[i],
      humidity: Math.round(dayHours.reduce((a, x) => a + x.humidity, 0) / (dayHours.length || 1)),
      hours: dayHours,
    };
  });

  const minutely = d.minutely_15.time.map((time, i) => ({ time, precip: d.minutely_15.precipitation[i] ?? 0 }));

  return { utcOffset: d.utc_offset_seconds, days, minutely };
}

// 花粉（データがあるのは主にヨーロッパ。日本などは null が返る）
const POLLEN_FIELDS = {
  alder_pollen: "ハンノキ",
  birch_pollen: "シラカバ",
  grass_pollen: "イネ科",
  mugwort_pollen: "ヨモギ",
  olive_pollen: "オリーブ",
  ragweed_pollen: "ブタクサ",
} as const;

export async function getPollen(lat: number, lon: number): Promise<Record<string, PollenDay> | null> {
  try {
    const d = await get<{ hourly: Record<string, (number | null)[]> & { time: string[] } }>(AIR, {
      latitude: lat,
      longitude: lon,
      timezone: "auto",
      forecast_days: 4,
      hourly: Object.keys(POLLEN_FIELDS).join(","),
    });
    const result: Record<string, PollenDay> = {};
    let hasData = false;
    d.hourly.time.forEach((time, i) => {
      const date = time.slice(0, 10);
      for (const [field, label] of Object.entries(POLLEN_FIELDS)) {
        const v = d.hourly[field]?.[i];
        if (v == null) continue;
        hasData = true;
        result[date] ??= {};
        result[date][label] = Math.max(result[date][label] ?? 0, v);
      }
    });
    return hasData ? result : null;
  } catch {
    return null; // 花粉が取れなくても天気は表示する
  }
}
