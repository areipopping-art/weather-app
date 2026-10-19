// ブラウザに保存する設定（アラート条件・お気に入り）

export type AlertSettings = {
  heat: { on: boolean; max: number }; // 最高気温が○℃以上
  cold: { on: boolean; min: number }; // 最低気温が○℃以下
  rain: { on: boolean; pop: number }; // 降水確率が○%以上
  change: { on: boolean; diff: number }; // 明日の最高気温が今日より○℃以上変わる
  wind: { on: boolean; speed: number }; // 最大風速が○m/s以上
  uv: { on: boolean; index: number }; // UV指数が○以上
  rainSoon: { on: boolean }; // 1時間以内に雨が降りそう
  notify: boolean; // ブラウザ通知も出す
};

export const DEFAULT_SETTINGS: AlertSettings = {
  heat: { on: true, max: 35 },
  cold: { on: true, min: 5 },
  rain: { on: true, pop: 60 },
  change: { on: true, diff: 5 },
  wind: { on: true, speed: 10 },
  uv: { on: true, index: 8 },
  rainSoon: { on: true },
  notify: false,
};

export type Favorite = {
  id: string;
  label: string; // 表示名（「勤務先」など自由に変えられる）
  name: string; // 地名
  country: string;
  lat: number;
  lon: number;
};

export const placeId = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

const KEYS = {
  settings: "soramoyou:settings",
  favorites: "soramoyou:favorites",
  notified: "soramoyou:notified",
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const loadSettings = (): AlertSettings => ({ ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) });
export const saveSettings = (s: AlertSettings) => write(KEYS.settings, s);

export const loadFavorites = (): Favorite[] => read(KEYS.favorites, []);
export const saveFavorites = (f: Favorite[]) => write(KEYS.favorites, f);

// 同じアラートを何度も通知しないように、通知済みの ID を覚えておく
export function markNotified(id: string): boolean {
  const list = read<string[]>(KEYS.notified, []);
  if (list.includes(id)) return false;
  write(KEYS.notified, [...list, id].slice(-100));
  return true;
}
