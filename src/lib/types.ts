// サーバーとブラウザで共有するデータの形

export type Hour = {
  time: string; // "YYYY-MM-DDTHH:00"（現地時刻）
  temp: number;
  pop: number; // 降水確率 %
  precip: number; // 降水量 mm
  code: number; // WMO 天気コード
  uv: number;
  humidity: number;
  wind: number; // m/s
  wbgt: number; // 暑さ指数（推定）
};

export type Day = {
  date: string; // "YYYY-MM-DD"（現地日付）
  code: number;
  min: number;
  max: number;
  pop: number; // 最大の降水確率
  precipSum: number; // 合計降水量 mm
  uvMax: number;
  windMax: number;
  humidity: number; // 平均
  hours: Hour[];
};

export type AirDay = { pm25Avg: number; pm25Max: number };

export type PollenDay = {
  // 観測モデルのデータがある地域（主にヨーロッパ）の値。粒/m³ の最大値
  [species: string]: number;
};

export type WeatherResponse = {
  place: { name: string; country: string; lat: number; lon: number };
  today: string; // 現地の今日 "YYYY-MM-DD"
  now: string; // 現地の現在時刻 "YYYY-MM-DDTHH:MM"
  current: {
    time: string; // "HH:MM"
    temp: number;
    feelsLike: number;
    humidity: number;
    wind: number;
    icon: string; // OpenWeatherMap のアイコンコード
    description: string;
    raining: boolean;
    pm25: number | null;
  };
  // この先の15分ごとの降水量
  minutely: { time: string; precip: number }[];
  days: Day[];
  air: Record<string, AirDay>;
  pollen: Record<string, PollenDay> | null; // データが無い地域は null
};
