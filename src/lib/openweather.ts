import "server-only";
import type { WeatherResponse } from "./types";
import { getForecast, getPollen } from "./openmeteo";

// OpenWeatherMap 無料プランで使える API だけを使う
// - Geocoding API      /geo/1.0/direct, /geo/1.0/reverse
// - Current Weather    /data/2.5/weather
// - Air Pollution    /data/2.5/air_pollution（PM2.5）
// 1時間ごとの予報・UV・花粉は Open-Meteo（openmeteo.ts）から取る
const BASE = "https://api.openweathermap.org";

export class WeatherError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

function apiKey(): string {
  // キーは環境変数からだけ読む（.env.local / Vercel の Environment Variables）
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) throw new WeatherError("サーバーに OPENWEATHER_API_KEY が設定されていません", 500);
  return key;
}

async function owm<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), appid: apiKey() });
  // 同じ問い合わせは10分キャッシュして無料枠を節約
  const res = await fetch(`${BASE}${path}?${qs}`, { next: { revalidate: 600 } });
  if (res.status === 401) throw new WeatherError("API キーが無効です（発行直後は有効になるまで最大2時間ほどかかります）", 502);
  if (res.status === 429) throw new WeatherError("API の利用上限に達しました。少し待ってから試してください", 503);
  if (!res.ok) throw new WeatherError("天気データの取得に失敗しました", 502);
  return res.json() as Promise<T>;
}

type GeoResult = { name: string; local_names?: Record<string, string>; lat: number; lon: number; country: string; state?: string };

type Place = WeatherResponse["place"];

const toPlace = (g: GeoResult): Place => ({
  name: g.local_names?.ja ?? g.name,
  country: g.country,
  lat: g.lat,
  lon: g.lon,
});

// 日本語（ひらがな・カタカナ・漢字）だけの入力か
const isJapanese = (s: string) => /^[぀-ヿ㐀-鿿々ー]+$/.test(s);

export async function findCity(query: string): Promise<Place> {
  // 日本語の地名は「福岡」→中国の地名、「京都」→中国の地区…のように外れやすい。
  // 「〇〇市」→「〇〇」の順に試し、日本の結果を優先する。
  if (!isJapanese(query)) {
    const results = await owm<GeoResult[]>("/geo/1.0/direct", { q: query, limit: 1 });
    if (!results.length) throw new WeatherError(`「${query}」が見つかりませんでした`, 404);
    return toPlace(results[0]);
  }

  // 「京都府」「福岡県」は県庁所在地の「京都市」「福岡市」でも探す
  const base = query.replace(/[府県]$/, "");
  const candidates = /[市区町村]$/.test(query) ? [query] : [...new Set([`${base}市`, query])];
  const lists = await Promise.all(
    candidates.map((q) => owm<GeoResult[]>("/geo/1.0/direct", { q, limit: 5 }))
  );
  const all = lists.flat();
  const jaName = (r: GeoResult) => r.local_names?.ja ?? r.name;

  // 1. 入力した文字で始まる日本の地名（「東京」→「東京都」、「西東京市」は除外）
  // 2. 日本の地名  3. なんでも
  const best =
    all.find((r) => r.country === "JP" && jaName(r).startsWith(query)) ??
    all.find((r) => r.country === "JP") ??
    all[0];
  if (!best) throw new WeatherError(`「${query}」が見つかりませんでした`, 404);
  return toPlace(best);
}

export async function placeFromCoords(lat: number, lon: number): Promise<Place> {
  const results = await owm<GeoResult[]>("/geo/1.0/reverse", { lat, lon, limit: 1 });
  return results.length ? { ...toPlace(results[0]), lat, lon } : { name: "現在地", country: "", lat, lon };
}

type CurrentApi = {
  dt: number;
  timezone: number;
  main: { temp: number; feels_like: number; humidity: number };
  wind: { speed: number };
  weather: { id: number; description: string; icon: string }[];
};

type AirApi = { list: { dt: number; components: { pm2_5: number } }[] };

// UNIX 秒 + タイムゾーン差 → 現地の "YYYY-MM-DDTHH:MM"
const localIso = (dt: number, tz: number) => new Date((dt + tz) * 1000).toISOString().slice(0, 16);

export async function getWeather(place: Place): Promise<WeatherResponse> {
  const { lat, lon } = place;
  const [cur, airNow, airFc, forecast, pollen] = await Promise.all([
    owm<CurrentApi>("/data/2.5/weather", { lat, lon, units: "metric", lang: "ja" }),
    owm<AirApi>("/data/2.5/air_pollution", { lat, lon }).catch(() => null),
    owm<AirApi>("/data/2.5/air_pollution/forecast", { lat, lon }).catch(() => null),
    getForecast(lat, lon),
    getPollen(lat, lon),
  ]);

  // 「今」はサーバーの時計から（観測時刻は数十分遅れることがあるため）
  const now = localIso(Math.floor(Date.now() / 1000), forecast.utcOffset);
  const today = now.slice(0, 10);
  const observed = localIso(cur.dt, cur.timezone);

  // PM2.5 を日付ごとに集計
  const airByDate = new Map<string, number[]>();
  for (const item of airFc?.list ?? []) {
    const date = localIso(item.dt, forecast.utcOffset).slice(0, 10);
    airByDate.set(date, [...(airByDate.get(date) ?? []), item.components.pm2_5]);
  }
  const air: WeatherResponse["air"] = {};
  for (const [date, values] of airByDate) {
    air[date] = {
      pm25Avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
      pm25Max: Math.round(Math.max(...values) * 10) / 10,
    };
  }

  const days = forecast.days.filter((d) => d.date >= today);
  // 今日の最高・最低に現在の気温も反映
  if (days[0]?.date === today) {
    days[0].min = Math.min(days[0].min, cur.main.temp);
    days[0].max = Math.max(days[0].max, cur.main.temp);
  }

  const weatherId = cur.weather[0]?.id ?? 800;
  return {
    place,
    today,
    now,
    current: {
      time: observed.slice(11, 16), // 観測時刻
      temp: cur.main.temp,
      feelsLike: cur.main.feels_like,
      humidity: cur.main.humidity,
      wind: cur.wind.speed,
      icon: cur.weather[0]?.icon ?? "01d",
      description: cur.weather[0]?.description ?? "",
      raining: weatherId >= 200 && weatherId < 700, // 雷雨・霧雨・雨・雪
      pm25: airNow?.list[0]?.components.pm2_5 ?? null,
    },
    minutely: forecast.minutely.filter((m) => m.time >= now.slice(0, 13)),
    days,
    air,
    pollen,
  };
}
