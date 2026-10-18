// サーバーとブラウザで共有するデータの形

export type Slot = {
  time: string; // "HH:MM"（現地時刻）
  temp: number;
  humidity: number;
  pop: number; // 降水確率 %
  icon: string; // OpenWeatherMap のアイコンコード（例 "10d"）
  description: string;
};

export type Day = {
  date: string; // "YYYY-MM-DD"（現地日付）
  min: number;
  max: number;
  humidity: number; // 平均
  pop: number; // 最大の降水確率
  wind: number; // 最大風速 m/s
  icon: string;
  description: string;
  slots: Slot[];
};

export type WeatherResponse = {
  place: { name: string; country: string; lat: number; lon: number };
  today: string; // 現地の今日 "YYYY-MM-DD"
  current: {
    time: string;
    temp: number;
    feelsLike: number;
    humidity: number;
    wind: number;
    pop: number;
    icon: string;
    description: string;
  };
  days: Day[];
};
