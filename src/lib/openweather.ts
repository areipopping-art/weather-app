import "server-only";
import type { Day, Slot, WeatherResponse } from "./types";

// OpenWeatherMap 無料プランで使える API だけを使う
// - Geocoding API      /geo/1.0/direct, /geo/1.0/reverse
// - Current Weather    /data/2.5/weather
// - 5 Day / 3 Hour     /data/2.5/forecast
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
  weather: { description: string; icon: string }[];
};

type ForecastApi = {
  city: { timezone: number };
  list: {
    dt: number;
    main: { temp: number; temp_min: number; temp_max: number; humidity: number };
    wind: { speed: number };
    pop: number;
    weather: { description: string; icon: string }[];
  }[];
};

// UNIX 秒 + タイムゾーン差 → 現地の "YYYY-MM-DD" と "HH:MM"
function local(dt: number, tz: number) {
  const iso = new Date((dt + tz) * 1000).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export async function getWeather(place: Place): Promise<WeatherResponse> {
  const common = { lat: place.lat, lon: place.lon, units: "metric", lang: "ja" };
  const [cur, fc] = await Promise.all([
    owm<CurrentApi>("/data/2.5/weather", common),
    owm<ForecastApi>("/data/2.5/forecast", common),
  ]);

  const tz = fc.city.timezone;
  const now = local(cur.dt, cur.timezone);

  // 3時間ごとの予報を日付ごとにまとめる
  const byDate = new Map<string, { slots: Slot[]; winds: number[] }>();
  for (const item of fc.list) {
    const { date, time } = local(item.dt, tz);
    const slot: Slot = {
      time,
      temp: item.main.temp,
      humidity: item.main.humidity,
      pop: Math.round(item.pop * 100),
      icon: item.weather[0]?.icon ?? "01d",
      description: item.weather[0]?.description ?? "",
    };
    const entry = byDate.get(date) ?? { slots: [], winds: [] };
    entry.slots.push(slot);
    entry.winds.push(item.wind.speed);
    byDate.set(date, entry);
  }

  const days: Day[] = [...byDate.entries()].map(([date, { slots, winds }]) => {
    // その日の代表の天気は「お昼に一番近い時間帯」
    const noon = slots.reduce((best, s) =>
      Math.abs(parseInt(s.time) - 12) < Math.abs(parseInt(best.time) - 12) ? s : best
    );
    return {
      date,
      min: Math.min(...slots.map((s) => s.temp)),
      max: Math.max(...slots.map((s) => s.temp)),
      humidity: Math.round(slots.reduce((a, s) => a + s.humidity, 0) / slots.length),
      pop: Math.max(...slots.map((s) => s.pop)),
      wind: Math.max(...winds),
      icon: noon.icon,
      description: noon.description,
      slots,
    };
  });

  // 今日の分が予報に無い（夜遅い時間など）場合は現在の天気で補う
  if (!days.length || days[0].date !== now.date) {
    days.unshift({
      date: now.date,
      min: cur.main.temp,
      max: cur.main.temp,
      humidity: cur.main.humidity,
      pop: fc.list[0] ? Math.round(fc.list[0].pop * 100) : 0,
      wind: cur.wind.speed,
      icon: cur.weather[0]?.icon ?? "01d",
      description: cur.weather[0]?.description ?? "",
      slots: [],
    });
  } else {
    // 今日の最高・最低に現在の気温も反映
    days[0].min = Math.min(days[0].min, cur.main.temp);
    days[0].max = Math.max(days[0].max, cur.main.temp);
  }

  return {
    place,
    today: now.date,
    current: {
      time: now.time,
      temp: cur.main.temp,
      feelsLike: cur.main.feels_like,
      humidity: cur.main.humidity,
      wind: cur.wind.speed,
      pop: fc.list[0] ? Math.round(fc.list[0].pop * 100) : 0,
      icon: cur.weather[0]?.icon ?? "01d",
      description: cur.weather[0]?.description ?? "",
    },
    days,
  };
}
