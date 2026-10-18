# ☁️ そらもよう

OpenWeatherMap（無料プラン）と連携した天気予報 Web アプリです。Next.js で作っています。

## できること

- 都市名検索（日本語・英語どちらでも OK）／📍ボタンで現在地の天気
- 気温・体感温度・天気・湿度・降水確率・風速の表示
- 📅 カレンダーで日付を選ぶと、その日の予報（最高/最低・3時間ごとの予報）に切り替わる
- 週間予報の一覧（今日〜5日後）

## API キーの管理

API キーは **環境変数 `OPENWEATHER_API_KEY` からだけ** 読み込みます。コードには書いていません。

- ブラウザは自分のサーバーの `/api/weather` を呼ぶだけで、OpenWeatherMap へのアクセスとキーの利用はサーバー側（`src/lib/openweather.ts`）で行います。そのためキーはブラウザに送られません。
- `.env.local` は `.gitignore` に含まれているので GitHub には上がりません。

## ローカルで動かす

1. [OpenWeatherMap](https://home.openweathermap.org/api_keys) で無料の API キーを発行（有効になるまで最大2時間ほどかかることがあります）
2. `.env.example` をコピーして `.env.local` を作り、キーを入れる

   ```
   OPENWEATHER_API_KEY=あなたのキー
   ```

3. 起動

   ```bash
   npm install
   npm run dev
   ```

   http://localhost:3000 を開く

## Vercel へのデプロイ

Vercel のプロジェクト設定 → Environment Variables に `OPENWEATHER_API_KEY` を登録してからデプロイします。

## 使っている API（すべて無料プラン）

| API | 用途 |
| --- | --- |
| Geocoding API | 都市名 ⇄ 緯度経度 |
| Current Weather Data | 現在の天気 |
| 5 Day / 3 Hour Forecast | 5日間・3時間ごとの予報 |
