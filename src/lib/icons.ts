// OpenWeatherMap のアイコンコード → 絵文字
const MAP: Record<string, [day: string, night: string]> = {
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
  const pair = MAP[icon.slice(0, 2)];
  if (!pair) return "🌈";
  return icon.endsWith("n") ? pair[1] : pair[0];
}

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

// "YYYY-MM-DD" → "10/19（日）"
export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const w = new Date(y, m - 1, d).getDay();
  return `${m}/${d}（${WEEK[w]}）`;
}

export { WEEK };
