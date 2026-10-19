// OpenWeatherMap のアイコンコード → 絵文字（現在の天気用）
const OWM: Record<string, [day: string, night: string]> = {
  "01": ["☀️", "🌙"],
  "02": ["🌤️", "🌤️"],
  "03": ["⛅", "⛅"],
  "04": ["☁️", "☁️"],
  "09": ["🌧️", "🌧️"],
  "10": ["🌦️", "🌧️"],
  "11": ["⛈️", "⛈️"],
  "13": ["❄️", "❄️"],
  "50": ["🌫️", "🌫️"],
};

export function weatherEmoji(icon: string): string {
  const pair = OWM[icon.slice(0, 2)];
  if (!pair) return "🌈";
  return icon.endsWith("n") ? pair[1] : pair[0];
}

// WMO 天気コード → 絵文字と日本語（予報用。Open-Meteo）
const WMO: Record<number, [string, string]> = {
  0: ["☀️", "快晴"], 1: ["🌤️", "晴れ"], 2: ["⛅", "晴れ時々くもり"], 3: ["☁️", "くもり"],
  45: ["🌫️", "霧"], 48: ["🌫️", "霧"],
  51: ["🌦️", "弱い霧雨"], 53: ["🌦️", "霧雨"], 55: ["🌧️", "強い霧雨"],
  56: ["🌧️", "着氷性の霧雨"], 57: ["🌧️", "着氷性の霧雨"],
  61: ["🌦️", "弱い雨"], 63: ["🌧️", "雨"], 65: ["🌧️", "強い雨"],
  66: ["🌧️", "着氷性の雨"], 67: ["🌧️", "着氷性の雨"],
  71: ["🌨️", "弱い雪"], 73: ["🌨️", "雪"], 75: ["❄️", "大雪"], 77: ["🌨️", "霧雪"],
  80: ["🌦️", "にわか雨"], 81: ["🌧️", "強めのにわか雨"], 82: ["⛈️", "激しいにわか雨"],
  85: ["🌨️", "にわか雪"], 86: ["❄️", "強いにわか雪"],
  95: ["⛈️", "雷雨"], 96: ["⛈️", "ひょうを伴う雷雨"], 99: ["⛈️", "激しい雷雨"],
};
export const codeEmoji = (code: number) => WMO[code]?.[0] ?? "🌈";
export const codeText = (code: number) => WMO[code]?.[1] ?? "不明";

export const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

// "YYYY-MM-DD" → "10/19（日）"
export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const w = new Date(y, m - 1, d).getDay();
  return `${m}/${d}（${WEEK[w]}）`;
}

// "YYYY-MM-DDTHH:MM" → 時（数値）
export const hourOf = (time: string) => Number(time.slice(11, 13));
