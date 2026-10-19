"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Calendar from "./Calendar";
import RainCard from "./RainCard";
import OutfitCard from "./OutfitCard";
import HealthCard, { type HealthItem } from "./HealthCard";
import AlertBanner from "./AlertBanner";
import SettingsPanel from "./SettingsPanel";
import type { WeatherResponse } from "@/lib/types";
import { codeEmoji, codeText, formatDate, hourOf, weatherEmoji } from "@/lib/icons";
import {
  buildAlerts,
  heatLevel,
  outfit,
  pm25Level,
  pollenEstimate,
  pollenMeasured,
  rainOutlook,
  uvLevel,
} from "@/lib/insights";
import {
  DEFAULT_SETTINGS,
  type AlertSettings,
  type Favorite,
  loadFavorites,
  loadSettings,
  markNotified,
  placeId,
  saveFavorites,
  saveSettings,
} from "@/lib/settings";

const PRESETS = ["東京", "大阪", "札幌", "福岡", "那覇"];
const LAST_KEY = "soramoyou:last-query";
const REFRESH_MS = 10 * 60 * 1000; // 10分ごとに自動更新（雨雲の見通しを新しくする）

type Query = { q: string } | { lat: number; lon: number; name?: string; country?: string };

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
  const p: Record<string, string> =
    "q" in query ? { q: query.q } : { lat: String(query.lat), lon: String(query.lon) };
  if ("lat" in query && query.name) Object.assign(p, { name: query.name, country: query.country ?? "" });
  const res = await fetch(`/api/weather?${new URLSearchParams(p)}`);
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
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_SETTINGS);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const queryRef = useRef<Query | null>(null);

  const apply = useCallback((query: Query, json: WeatherResponse, keepDate = false) => {
    setData(json);
    setSelected((prev) => (keepDate && json.days.some((d) => d.date === prev) ? prev : json.today));
    setStatus(null);
    setLoading(false);
    queryRef.current = query;
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

  // 起動時：保存した設定を読み、前回の場所（なければ東京）を表示
  useEffect(() => {
    const query = loadLast() ?? { q: "東京" };
    requestWeather(query).then((json) => {
      setSettings(loadSettings());
      setFavorites(loadFavorites());
      apply(query, json);
    }, fail);
  }, [apply, fail]);

  // 開いている間は10分ごとに静かに更新
  useEffect(() => {
    const timer = setInterval(() => {
      const q = queryRef.current;
      if (q && document.visibilityState === "visible") requestWeather(q).then((json) => apply(q, json, true), () => {});
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [apply]);

  const alerts = useMemo(() => (data ? buildAlerts(data, settings) : []), [data, settings]);

  // ブラウザ通知（同じアラートは1回だけ）
  useEffect(() => {
    if (!settings.notify || !("Notification" in window) || Notification.permission !== "granted") return;
    for (const a of alerts) {
      if (markNotified(a.id)) new Notification(`そらもよう｜${data?.place.name ?? ""}`, { body: `${a.icon} ${a.text}` });
    }
  }, [alerts, settings.notify, data?.place.name]);

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

  const currentId = data ? placeId(data.place.lat, data.place.lon) : "";
  const isFavorite = favorites.some((f) => f.id === currentId);
  const toggleFavorite = () => {
    if (!data) return;
    const next = isFavorite
      ? favorites.filter((f) => f.id !== currentId)
      : [...favorites, { id: currentId, label: data.place.name, ...data.place }];
    setFavorites(next);
    saveFavorites(next);
  };

  const dayIndex = data ? data.days.findIndex((d) => d.date === selected) : -1;
  const day = data?.days[dayIndex];
  const isToday = !!data && selected === data.today;

  const rain = data && day ? rainOutlook(data, day) : null;

  const health: HealthItem[] = (() => {
    if (!data || !day) return [];
    const nowHour = data.now.slice(0, 13);
    const curHour = isToday ? day.hours.find((h) => h.time.startsWith(nowHour)) : undefined;
    const daytime = day.hours.filter((h) => hourOf(h.time) >= 6 && hourOf(h.time) <= 18);
    const wbgtMax = Math.max(...(daytime.length ? daytime : day.hours).map((h) => h.wbgt));
    const air = data.air[day.date];
    const pm25 = isToday && data.current.pm25 != null ? data.current.pm25 : air?.pm25Avg;
    const measured = data.pollen?.[day.date];
    const pollen = measured
      ? pollenMeasured(measured)
      : data.place.country === "JP"
        ? pollenEstimate(day, data.days[dayIndex - 1])
        : null;

    return [
      {
        icon: "☀️",
        title: "紫外線",
        value: curHour ? `いま UV ${Math.round(curHour.uv)}・最大 ${Math.round(day.uvMax)}` : `最大 UV ${Math.round(day.uvMax)}`,
        level: uvLevel(day.uvMax),
      },
      {
        icon: "🌡️",
        title: "熱中症",
        value: `暑さ指数 最大 ${Math.round(wbgtMax)}`,
        level: heatLevel(wbgtMax),
        note: "気温・湿度・日射から推定",
      },
      {
        icon: "😷",
        title: "PM2.5",
        value: pm25 != null ? `${isToday ? "いま" : "平均"} ${Math.round(pm25)} μg/m³` : "—",
        level: pm25 != null ? pm25Level(pm25) : null,
      },
      {
        icon: "🌼",
        title: "花粉",
        value: pollen?.main ? pollen.main : pollen ? "主な花粉の時期ではありません" : "—",
        level: pollen?.level ?? null,
        note: measured ? undefined : pollen ? "季節と天気からの目安です" : "この地域の花粉データはありません",
      },
    ];
  })();

  const nowHourNum = data && isToday ? hourOf(data.now) : null;
  const visibleHours = day ? (nowHourNum !== null ? day.hours.filter((h) => hourOf(h.time) >= nowHourNum) : day.hours) : [];
  const curPop = isToday ? (visibleHours[0]?.pop ?? 0) : 0;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-8 pb-12">
      <header className="relative mb-6 text-center">
        <h1 className="text-3xl font-bold">☁️ そらもよう</h1>
        <p className="mt-1 text-sm text-muted">ゆるっと天気予報</p>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          aria-label="設定"
          title="アラート・お気に入りの設定"
          className="absolute top-0 right-0 rounded-full bg-card px-3 py-2 text-xl shadow-soft"
        >
          ⚙️
        </button>
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
        {favorites.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => load({ lat: f.lat, lon: f.lon, name: f.name, country: f.country })}
            className={`rounded-full bg-pink px-3 py-1 text-sm hover:opacity-80 ${f.id === currentId ? "ring-2 ring-accent" : ""}`}
          >
            ★ {f.label}
          </button>
        ))}
        {PRESETS.filter((c) => !favorites.some((f) => f.name.startsWith(c))).map((c) => (
          <button key={c} type="button" onClick={() => load({ q: c })} className="rounded-full bg-lavender px-3 py-1 text-sm hover:opacity-80">
            {c}
          </button>
        ))}
      </div>

      <p role="status" className={`mt-3 min-h-6 text-center text-sm ${status?.error ? "text-rose" : "text-muted"}`}>
        {status?.text}
      </p>

      {data && <AlertBanner alerts={alerts} />}

      {data && day && rain && (
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
          {/* 選んだ日の天気 */}
          <section className="min-w-0 rounded-3xl border border-line bg-gradient-to-br from-sky to-lavender p-5 shadow-soft">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold">{data.place.name}</h2>
                <p className="text-sm opacity-75">
                  {formatDate(selected)}
                  {isToday ? `　${data.current.time} 時点` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleFavorite}
                aria-pressed={isFavorite}
                title={isFavorite ? "お気に入りから外す" : "お気に入りに追加"}
                className="shrink-0 rounded-full bg-card px-3 py-1 text-sm"
              >
                {isFavorite ? "★ 登録済み" : "☆ お気に入り"}
              </button>
            </div>

            <div className="my-4 flex items-center gap-4">
              <span className="text-7xl leading-none">{isToday ? weatherEmoji(data.current.icon) : codeEmoji(day.code)}</span>
              <div>
                {isToday ? (
                  <p className="text-5xl font-bold">{Math.round(data.current.temp)}°C</p>
                ) : (
                  <p className="text-4xl font-bold">
                    {Math.round(day.max)}°<span className="text-2xl opacity-60"> / {Math.round(day.min)}°</span>
                  </p>
                )}
                <p className="mt-1 text-lg">{isToday ? data.current.description : codeText(day.code)}</p>
                {isToday && (
                  <p className="text-sm opacity-75">
                    最高 {Math.round(day.max)}° / 最低 {Math.round(day.min)}°
                  </p>
                )}
              </div>
            </div>

            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(isToday
                ? [
                    ["体感", `${Math.round(data.current.feelsLike)}°C`],
                    ["湿度", `${data.current.humidity}%`],
                    ["降水確率", `${curPop}%`],
                    ["風速", `${data.current.wind.toFixed(1)} m/s`],
                  ]
                : [
                    ["平均湿度", `${day.humidity}%`],
                    ["降水確率", `${day.pop}%`],
                    ["降水量", `${day.precipSum} mm`],
                    ["最大風速", `${day.windMax.toFixed(1)} m/s`],
                  ]
              ).map(([label, value]) => (
                <li key={label} className="flex flex-col rounded-2xl bg-card p-3 text-center">
                  <span className="text-xs opacity-75">{label}</span>
                  <strong>{value}</strong>
                </li>
              ))}
            </ul>

            <h3 className="mt-5 mb-2 text-sm font-bold">1時間ごとの予報</h3>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {visibleHours.map((h, i) => (
                <div
                  key={h.time}
                  className={`flex w-14 shrink-0 flex-col items-center rounded-2xl py-2 ${["bg-mint", "bg-peach", "bg-lemon"][i % 3]}`}
                >
                  <span className="text-xs opacity-75">{i === 0 && isToday ? "いま" : `${hourOf(h.time)}時`}</span>
                  <span className="my-1 text-xl" title={codeText(h.code)}>
                    {codeEmoji(h.code)}
                  </span>
                  <span className="font-bold">{Math.round(h.temp)}°</span>
                  <span className="text-[11px] opacity-75">☂ {h.pop}%</span>
                </div>
              ))}
            </div>
          </section>

          {/* カレンダー */}
          <section className="rounded-3xl border border-line bg-card p-5 shadow-soft">
            <h3 className="mb-2 text-sm font-bold">📅 日付をえらぶ</h3>
            <Calendar key={currentId} days={data.days} today={data.today} selected={selected} onSelect={setSelected} />
          </section>

          <div className="min-w-0 md:col-span-2">
            <RainCard day={day} rain={rain} nowHour={nowHourNum} />
          </div>

          <div className="grid min-w-0 gap-4 md:col-span-2 md:grid-cols-2">
            <OutfitCard items={outfit(day, rain)} />
            <HealthCard items={health} />
          </div>

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
                    <span className="text-xl" title={codeText(d.code)}>
                      {codeEmoji(d.code)}
                    </span>
                    <span className="truncate text-xs text-muted">
                      ☂ {d.pop}%　{d.precipSum}mm　UV {Math.round(d.uvMax)}
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

      {showSettings && (
        <SettingsPanel
          settings={settings}
          favorites={favorites}
          onClose={() => setShowSettings(false)}
          onSave={(s, f) => {
            setSettings(s);
            saveSettings(s);
            setFavorites(f);
            saveFavorites(f);
            setShowSettings(false);
          }}
        />
      )}

      <footer className="mt-8 text-center text-xs text-muted">
        データ提供：
        <a href="https://openweathermap.org/" target="_blank" rel="noopener noreferrer" className="text-accent underline">
          OpenWeatherMap
        </a>
        ・
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="text-accent underline">
          Open-Meteo
        </a>
        <br />
        暑さ指数・日本の花粉は推定値です
      </footer>
    </main>
  );
}
