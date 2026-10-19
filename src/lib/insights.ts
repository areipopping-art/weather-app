// 天気データから「雨の見通し」「服装の提案」「アラート」「各指標の段階」を作る
import type { Day, Hour, WeatherResponse } from "./types";
import type { AlertSettings } from "./settings";
import { hourOf } from "./icons";

export type Tone = "good" | "fair" | "warn" | "bad" | "danger";
export type Level = { label: string; tone: Tone };

const r = Math.round;

// ---------- 雨の見通し ----------

export type RainOutlook = {
  headline: string;
  detail?: string;
  minutesUntilRain?: number; // 1時間以内の雨の通知に使う
  umbrella: "need" | "folding" | "none";
  umbrellaText: string;
};

const isRainy = (h: Hour) => h.pop >= 50 || h.precip >= 0.5;
const isDry = (h: Hour) => h.pop < 40 && h.precip < 0.1;

// "YYYY-MM-DDTHH:MM" 同士の差（分）
const minutesBetween = (a: string, b: string) =>
  (new Date(`${b}:00Z`).getTime() - new Date(`${a}:00Z`).getTime()) / 60000;

function umbrellaFor(hours: Hour[]): Pick<RainOutlook, "umbrella" | "umbrellaText"> {
  const maxPop = Math.max(0, ...hours.map((h) => h.pop));
  const total = hours.reduce((a, h) => a + h.precip, 0);
  if (maxPop >= 50 || total >= 1) return { umbrella: "need", umbrellaText: "傘を持って行こう" };
  if (maxPop >= 30) return { umbrella: "folding", umbrellaText: "折りたたみ傘があると安心" };
  return { umbrella: "none", umbrellaText: "傘はいらなさそう" };
}

export function rainOutlook(data: WeatherResponse, day: Day): RainOutlook {
  const isToday = day.date === data.today;
  // 今日なら「これから」の時間だけを見る
  const hours = isToday ? day.hours.filter((h) => h.time.slice(0, 13) >= data.now.slice(0, 13)) : day.hours;
  // 傘の判断は 22時まで（お出かけの時間帯）
  const outing = hours.filter((h) => hourOf(h.time) <= 22);
  const umbrella = umbrellaFor(outing.length ? outing : hours);

  if (!hours.length) return { headline: "今日の残りの予報はありません", ...umbrella };

  if (isToday) {
    const rainingNow = data.current.raining || (data.minutely[0]?.precip ?? 0) >= 0.1;
    if (rainingNow) {
      const stop = hours.slice(1).find(isDry);
      return {
        headline: "☔ いま雨が降っています",
        detail: stop ? `${hourOf(stop.time)}時ごろにはやみそうです` : "今日はこのまま降り続きそうです",
        ...umbrella,
      };
    }
    // 15分ごとの予報で、この先3時間以内の降り始めを探す
    const soon = data.minutely.find((m) => m.precip >= 0.1 && m.time >= data.now);
    if (soon) {
      const min = Math.max(0, r(minutesBetween(data.now, soon.time)));
      const at = soon.time.slice(11, 16);
      return {
        // 1時間以内なら「あと◯分」、それより先なら時刻で伝える
        headline: min <= 15 ? "☔ まもなく雨が降りそう" : min <= 60 ? `☔ あと約${min}分で雨が降りそう` : `☔ ${at}ごろから雨が降りそう`,
        detail: min <= 60 ? `${at}ごろから降り始める予報です` : `いまから約${Math.round(min / 6) / 10}時間後`,
        minutesUntilRain: min,
        umbrella: "need",
        umbrellaText: "傘を持って行こう",
      };
    }
  }

  const start = hours.find(isRainy);
  if (start) {
    const after = hours.slice(hours.indexOf(start) + 1);
    const end = after.find(isDry);
    const rainyCount = hours.filter(isRainy).length;
    if (!isToday && rainyCount >= 12) {
      return { headline: "☔ 一日を通して雨が降りやすい予報", detail: `降水量の合計は約${day.precipSum}mm`, ...umbrella };
    }
    return {
      headline: `☔ ${hourOf(start.time)}時から雨が降りそう`,
      detail: `降水確率${start.pop}%${end ? `・${hourOf(end.time)}時ごろにはやみそう` : ""}`,
      ...umbrella,
    };
  }

  const chance = hours.find((h) => h.pop >= 30);
  if (chance) {
    return {
      headline: `🌂 ${hourOf(chance.time)}時ごろににわか雨の可能性`,
      detail: `降水確率${chance.pop}%`,
      ...umbrella,
    };
  }
  return { headline: isToday ? "🌤️ この先、雨の心配はなさそう" : "🌤️ 雨の心配はなさそう", ...umbrella };
}

// ---------- 服装・持ち物 ----------

export type Suggestion = { icon: string; text: string };

export function outfit(day: Day, rain: RainOutlook): Suggestion[] {
  const { max, min, windMax, uvMax } = day;
  const list: Suggestion[] = [];

  if (max >= 35) list.push({ icon: "🥵", text: "猛暑になりそう！ 半袖・通気性のいい服で" });
  else if (max >= 28) list.push({ icon: "👕", text: "暑くなるので半袖がオススメ" });
  else if (max >= 23) list.push({ icon: "👔", text: "半袖か薄手の長袖でちょうどいい" });
  else if (max >= 19) list.push({ icon: "🧥", text: "長袖シャツに薄手の上着がオススメ" });
  else if (max >= 14) list.push({ icon: "🧶", text: "ニットや軽めのジャケットを" });
  else if (max >= 9) list.push({ icon: "🧥", text: "コートがほしい寒さ" });
  else list.push({ icon: "🧣", text: "厚手のコート・マフラー・手袋でしっかり防寒" });

  if (max - min >= 10) list.push({ icon: "🔁", text: `朝晩と日中の気温差が${r(max - min)}℃。脱ぎ着しやすい服で` });
  if (windMax >= 8) list.push({ icon: "🌬️", text: "風が強いので、風を通しにくい上着を" });

  if (rain.umbrella === "need") list.push({ icon: "☂️", text: "傘を持って行こう" });
  else if (rain.umbrella === "folding") list.push({ icon: "🌂", text: "折りたたみ傘があると安心" });

  if (uvMax >= 6) list.push({ icon: "🧢", text: "紫外線が強め。帽子・日焼け止め・サングラスを" });
  else if (uvMax >= 3) list.push({ icon: "🧴", text: "日焼け止めを塗っておくと安心" });

  if (max >= 28) list.push({ icon: "🥤", text: "水分と塩分をこまめにとろう" });
  if (min <= 3) list.push({ icon: "🧤", text: "朝晩は凍えるほど冷えます。カイロもあると◎" });

  return list;
}

// ---------- 指標の段階 ----------

export function uvLevel(uv: number): Level {
  if (uv < 3) return { label: "弱い", tone: "good" };
  if (uv < 6) return { label: "中程度", tone: "fair" };
  if (uv < 8) return { label: "強い", tone: "warn" };
  if (uv < 11) return { label: "非常に強い", tone: "bad" };
  return { label: "極端に強い", tone: "danger" };
}

// 暑さ指数（WBGT）の段階は環境省の区分
export function heatLevel(wbgt: number): Level {
  if (wbgt < 21) return { label: "ほぼ安全", tone: "good" };
  if (wbgt < 25) return { label: "注意", tone: "fair" };
  if (wbgt < 28) return { label: "警戒", tone: "warn" };
  if (wbgt < 31) return { label: "厳重警戒", tone: "bad" };
  return { label: "危険", tone: "danger" };
}

// PM2.5 の段階（環境基準 日平均35μg/m³・注意喚起の目安70μg/m³）
export function pm25Level(v: number): Level {
  if (v <= 15) return { label: "良い", tone: "good" };
  if (v <= 35) return { label: "普通", tone: "fair" };
  if (v <= 70) return { label: "やや多い", tone: "warn" };
  return { label: "多い", tone: "bad" };
}

const POLLEN_LABELS: Level[] = [
  { label: "ほぼなし", tone: "good" },
  { label: "少ない", tone: "good" },
  { label: "やや多い", tone: "fair" },
  { label: "多い", tone: "warn" },
  { label: "非常に多い", tone: "bad" },
];

// 観測モデルの値（粒/m³）がある地域
export function pollenMeasured(values: Record<string, number>): { level: Level; main: string } {
  const [main, v] = Object.entries(values).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  const idx = v < 1 ? 0 : v < 10 ? 1 : v < 30 ? 2 : v < 100 ? 3 : 4;
  return { level: POLLEN_LABELS[idx], main: idx > 0 ? main : "" };
}

// 日本向けの推定：季節（主な花粉の飛散時期）× 天気
const SEASONS = [
  { name: "スギ", from: 201, to: 420, peakFrom: 301, peakTo: 331, base: 2 },
  { name: "ヒノキ", from: 320, to: 515, peakFrom: 401, peakTo: 430, base: 2 },
  { name: "イネ科", from: 501, to: 930, peakFrom: 0, peakTo: 0, base: 1 },
  { name: "ブタクサ・ヨモギ", from: 815, to: 1031, peakFrom: 901, peakTo: 930, base: 2 },
];

export function pollenEstimate(day: Day, prev?: Day): { level: Level; main: string } {
  const [, m, d] = day.date.split("-").map(Number);
  const md = m * 100 + d;
  const active = SEASONS.filter((s) => md >= s.from && md <= s.to);
  if (!active.length) return { level: POLLEN_LABELS[0], main: "" };

  // ピーク中は3、シーズン中は base、ピークを過ぎた終盤は1段階下げる
  const seasonScore = (s: (typeof SEASONS)[number]) =>
    md >= s.peakFrom && md <= s.peakTo ? 3 : s.peakTo && md > s.peakTo ? s.base - 1 : s.base;
  let score = Math.max(...active.map(seasonScore));
  const rainy = day.pop >= 60 || day.precipSum >= 2;
  if (rainy) score -= 2;
  else {
    if (day.code <= 2 && day.max >= 15) score += 1; // 晴れて暖かい
    if (day.windMax >= 5) score += 1; // 風が強い
    if (prev && (prev.pop >= 60 || prev.precipSum >= 2)) score += 1; // 雨の翌日
  }
  score = Math.min(4, Math.max(active.length ? 1 : 0, score));
  return { level: POLLEN_LABELS[score], main: active.map((s) => s.name).join("・") };
}

// ---------- アラート ----------

export type Alert = { id: string; icon: string; text: string; tone: Tone };

export function buildAlerts(data: WeatherResponse, s: AlertSettings): Alert[] {
  const alerts: Alert[] = [];
  const key = `${data.place.lat.toFixed(2)},${data.place.lon.toFixed(2)}`;
  const [today, tomorrow] = data.days;

  if (s.rainSoon.on && today) {
    const rain = rainOutlook(data, today);
    if (rain.minutesUntilRain !== undefined && rain.minutesUntilRain <= 60) {
      alerts.push({
        id: `${key}|${data.now.slice(0, 13)}|rainSoon`,
        icon: "☔",
        text: rain.minutesUntilRain <= 15 ? "まもなく雨が降りそう！" : `あと約${rain.minutesUntilRain}分で雨が降りそう！`,
        tone: "warn",
      });
    }
  }

  [today, tomorrow].forEach((day, i) => {
    if (!day) return;
    const when = i === 0 ? "今日" : "明日";
    const id = (type: string) => `${key}|${day.date}|${type}`;
    // 今日の降水確率は「これから」の時間だけで判断
    const pop =
      i === 0
        ? Math.max(0, ...day.hours.filter((h) => h.time.slice(0, 13) >= data.now.slice(0, 13)).map((h) => h.pop))
        : day.pop;

    if (s.heat.on && day.max >= s.heat.max)
      alerts.push({ id: id("heat"), icon: "🥵", text: `${when}は最高気温${r(day.max)}℃ 猛暑になるから気をつけて！`, tone: "danger" });
    if (s.cold.on && day.min <= s.cold.min)
      alerts.push({ id: id("cold"), icon: "🥶", text: `${when}は最低気温${r(day.min)}℃ 冷え込むので暖かくして！`, tone: "warn" });
    if (s.rain.on && pop >= s.rain.pop)
      alerts.push({ id: id("rain"), icon: "☂️", text: `${when}は雨の予報（降水確率${pop}%）傘を忘れずに！`, tone: "warn" });
    if (s.wind.on && day.windMax >= s.wind.speed)
      alerts.push({ id: id("wind"), icon: "🌬️", text: `${when}は強い風（最大${day.windMax.toFixed(1)}m/s）に注意！`, tone: "warn" });
    if (s.uv.on && day.uvMax >= s.uv.index)
      alerts.push({ id: id("uv"), icon: "🕶️", text: `${when}は紫外線が非常に強い（UV ${r(day.uvMax)}）日焼け対策を！`, tone: "warn" });
  });

  if (s.change.on && today && tomorrow) {
    const diff = tomorrow.max - today.max;
    if (diff <= -s.change.diff)
      alerts.push({
        id: `${key}|${tomorrow.date}|drop`,
        icon: "📉",
        text: `明日は気温が大きく下がるよ！（最高 ${r(today.max)}℃ → ${r(tomorrow.max)}℃）`,
        tone: "warn",
      });
    if (diff >= s.change.diff)
      alerts.push({
        id: `${key}|${tomorrow.date}|rise`,
        icon: "📈",
        text: `明日は気温がぐっと上がるよ！（最高 ${r(today.max)}℃ → ${r(tomorrow.max)}℃）`,
        tone: "warn",
      });
  }
  return alerts;
}
