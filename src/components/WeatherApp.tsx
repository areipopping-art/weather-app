"use client";

import { useCallback, useEffect, useState } from "react";
import Calendar from "./Calendar";
import type { WeatherResponse } from "@/lib/types";
import { formatDate, weatherEmoji } from "@/lib/icons";

const PRESETS = ["東京", "大阪", "札幌", "福岡", "那覇"];
const LAST_KEY = "soramoyou:last-query";

type Query = { q: string } | { lat: number; lon: number };

function saveLast(query: Query) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(query));
  } catch {}
}
function loadLast(): Query | null {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) ?? "null");
  } catch {
    return null;
  }
}

// 自分のサーバー（/api/weather）にだけ問い合わせる。API キーはブラウザに出ない。
async function requestWeather(query: Query): Promise<WeatherResponse> {
  const params = new URLSearchParams(
    "q" in query ? { q: query.q } : { lat: String(query.lat), lon: String(query.lon) }
  );
  const res = await fetch(`/api/weather?${params}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "取得に失敗しました");
  return json;
}

export default function WeatherApp() {
  const [input, setInput] = useState("");
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>({ text: "天気を取得中…" });
  const [loading, setLoading] = useState(true);

  const apply = useCallback((query: Query, json: WeatherResponse) => {
    setData(json);
    setSelected(json.today);
    setStatus(null);
    setLoading(false);
    saveLast(query);
  }, []);
  const fail = useCallback((e: unknown) => {
    setStatus({ text: e instanceof Error ? e.message : "通信エラーが発生しました", error: true });
    setLoading(false);
  }, []);

  const load = (query: Query) => {
    setLoading(true);
    setStatus({ text: "天気を取得中…" });
    requestWeather(query).then((json) => apply(query, json), fail);
  };

  useEffect(() => {
    // 起動時は前回の場所、なければ東京
    const query = loadLast() ?? { q: "東京" };
    requestWeather(query).then((json) => apply(query, json), fail);
  }, [apply, fail]);

  const locate = () => {
    if (!navigator.geolocation) {
      setStatus({ text: "このブラウザでは現在地を取得できません", error: true });
      return;
    }
    setStatus({ text: "現在地を取得中…" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => load({ lat: coords.latitude, lon: coords.longitude }),
      () => setStatus({ text: "現在地を取得できませんでした（位置情報の許可を確認してください）", error: true }),
      { timeout: 10000 }
    );
  };

  const day = data?.days.find((d) => d.date === selected);
  const isToday = data && selected === data.today;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-12">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-bold">☁️ そらもよう</h1>
        <p className="mt-1 text-sm text-muted">ゆるっと天気予報</p>
      </header>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) load({ q: input.trim() });
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="都市名（例：京都、Sapporo、Paris）"
          aria-label="都市名"
          className="min-w-0 flex-1 rounded-full border-2 border-line bg-card px-4 py-3 outline-none focus:border-accent"
        />
        <button type="submit" disabled={loading} className="rounded-full bg-accent px-5 font-bold text-accent-ink disabled:opacity-60">
          検索
        </button>
        <button
          type="button"
          onClick={locate}
          disabled={loading}
          title="現在地の天気"
          aria-label="現在地の天気"
          className="rounded-full bg-sky px-4 disabled:opacity-60"
        >
          📍
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => load({ q: c })}
            className="rounded-full bg-lavender px-3 py-1 text-sm hover:opacity-80"
          >
            {c}
          </button>
        ))}
      </div>

      <p role="status" className={`mt-3 min-h-6 text-center text-sm ${status?.error ? "text-rose" : "text-muted"}`}>
        {status?.text}
      </p>

      {data && day && (
        <div className="mt-2 grid gap-4 md:grid-cols-[1fr_300px]">
          {/* 選んだ日の天気 */}
          <section className="rounded-3xl border border-line bg-gradient-to-br from-sky to-lavender p-5 shadow-soft">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold">{data.place.name}</h2>
              <p className="text-sm opacity-75">
                {formatDate(selected)}
                {isToday ? `　${data.current.time} 時点` : ""}
              </p>
            </div>

            <div className="my-4 flex items-center gap-4">
              <span className="text-7xl leading-none">{weatherEmoji(isToday ? data.current.icon : day.icon)}</span>
              <div>
                {isToday ? (
                  <p className="text-5xl font-bold">{Math.round(data.current.temp)}°C</p>
                ) : (
                  <p className="text-4xl font-bold">
                    {Math.round(day.max)}°<span className="text-2xl opacity-60"> / {Math.round(day.min)}°</span>
                  </p>
                )}
                <p className="mt-1 text-lg">{isToday ? data.current.description : day.description}</p>
              </div>
            </div>

            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(isToday
                ? [
                    ["体感", `${Math.round(data.current.feelsLike)}°C`],
                    ["湿度", `${data.current.humidity}%`],
                    ["降水確率", `${data.current.pop}%`],
                    ["風速", `${data.current.wind.toFixed(1)} m/s`],
                  ]
                : [
                    ["最高 / 最低", `${Math.round(day.max)}° / ${Math.round(day.min)}°`],
                    ["湿度（平均）", `${day.humidity}%`],
                    ["降水確率", `${day.pop}%`],
                    ["最大風速", `${day.wind.toFixed(1)} m/s`],
                  ]
              ).map(([label, value]) => (
                <li key={label} className="flex flex-col rounded-2xl bg-card p-3 text-center">
                  <span className="text-xs opacity-75">{label}</span>
                  <strong>{value}</strong>
                </li>
              ))}
            </ul>

            {day.slots.length > 0 && (
              <>
                <h3 className="mt-5 mb-2 text-sm font-bold">3時間ごとの予報</h3>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {day.slots.map((s, i) => (
                    <div
                      key={s.time}
                      className={`flex w-16 shrink-0 flex-col items-center rounded-2xl py-2 ${
                        ["bg-mint", "bg-peach", "bg-lemon"][i % 3]
                      }`}
                    >
                      <span className="text-xs opacity-75">{Number(s.time.slice(0, 2))}時</span>
                      <span className="my-1 text-2xl" title={s.description}>
                        {weatherEmoji(s.icon)}
                      </span>
                      <span className="font-bold">{Math.round(s.temp)}°</span>
                      <span className="text-[11px] opacity-75">☂ {s.pop}%</span>
                      <span className="text-[11px] opacity-75">💧{s.humidity}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* カレンダー */}
          <section className="rounded-3xl border border-line bg-card p-5 shadow-soft">
            <h3 className="mb-2 text-sm font-bold">📅 日付をえらぶ</h3>
            <Calendar key={`${data.place.lat},${data.place.lon}`} days={data.days} today={data.today} selected={selected} onSelect={setSelected} />
          </section>

          {/* 週間一覧 */}
          <section className="rounded-3xl border border-line bg-card p-5 shadow-soft md:col-span-2">
            <h3 className="mb-2 text-sm font-bold">週間予報</h3>
            <ul>
              {data.days.map((d) => (
                <li key={d.date}>
                  <button
                    type="button"
                    onClick={() => setSelected(d.date)}
                    className={`grid w-full grid-cols-[6.5em_2em_1fr_auto] items-center gap-2 rounded-xl px-2 py-2 text-left ${
                      d.date === selected ? "bg-lavender/70" : "hover:bg-lavender/30"
                    }`}
                  >
                    <span>{d.date === data.today ? "今日" : formatDate(d.date)}</span>
                    <span className="text-xl">{weatherEmoji(d.icon)}</span>
                    <span className="truncate text-xs text-muted">
                      ☂ {d.pop}%　💧{d.humidity}%
                    </span>
                    <span className="font-bold">
                      {Math.round(d.max)}° <span className="text-muted">/ {Math.round(d.min)}°</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <footer className="mt-8 text-center text-xs text-muted">
        データ提供：
        <a href="https://openweathermap.org/" target="_blank" rel="noopener noreferrer" className="text-accent underline">
          OpenWeatherMap
        </a>
      </footer>
    </main>
  );
}
