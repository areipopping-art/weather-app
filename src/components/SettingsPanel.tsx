"use client";

import { useState } from "react";
import type { AlertSettings, Favorite } from "@/lib/settings";
import { DEFAULT_SETTINGS } from "@/lib/settings";

type Props = {
  settings: AlertSettings;
  favorites: Favorite[];
  onSave: (settings: AlertSettings, favorites: Favorite[]) => void;
  onClose: () => void;
};

type NumKey = "heat" | "cold" | "rain" | "change" | "wind" | "uv";
const ROWS: { key: NumKey; field: string; label: (v: number) => string; unit: string; min: number; max: number }[] = [
  { key: "heat", field: "max", label: () => "猛暑：最高気温が", unit: "℃ 以上", min: 25, max: 45 },
  { key: "cold", field: "min", label: () => "寒さ：最低気温が", unit: "℃ 以下", min: -20, max: 15 },
  { key: "rain", field: "pop", label: () => "雨：降水確率が", unit: "% 以上", min: 10, max: 100 },
  { key: "change", field: "diff", label: () => "気温差：明日の最高気温が今日より", unit: "℃ 以上変わる", min: 2, max: 15 },
  { key: "wind", field: "speed", label: () => "強風：最大風速が", unit: "m/s 以上", min: 5, max: 30 },
  { key: "uv", field: "index", label: () => "紫外線：UV指数が", unit: "以上", min: 3, max: 11 },
];

export default function SettingsPanel({ settings, favorites, onSave, onClose }: Props) {
  const [s, setS] = useState<AlertSettings>(settings);
  const [favs, setFavs] = useState<Favorite[]>(favorites);
  const [notifyMsg, setNotifyMsg] = useState("");

  const setRow = (key: NumKey, patch: Record<string, number | boolean>) =>
    setS((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const toggleNotify = async (on: boolean) => {
    if (!on) return setS((p) => ({ ...p, notify: false }));
    if (!("Notification" in window)) return setNotifyMsg("このブラウザは通知に対応していません");
    const perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (perm === "granted") {
      setS((p) => ({ ...p, notify: true }));
      setNotifyMsg("");
    } else {
      setNotifyMsg("通知がブロックされています。ブラウザのサイト設定から許可してください");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/20 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="設定"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[var(--bg)] p-5 shadow-soft sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">⚙️ 設定</h2>
          <button type="button" onClick={onClose} aria-label="閉じる" className="rounded-full px-3 py-1 text-xl">
            ×
          </button>
        </div>

        <h3 className="mb-2 text-sm font-bold">🔔 アラートの条件</h3>
        <ul className="space-y-2">
          {ROWS.map((row) => {
            const cur = s[row.key] as unknown as { on: boolean } & Record<string, number>;
            return (
              <li key={row.key} className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-3 text-sm">
                <input
                  type="checkbox"
                  checked={cur.on}
                  onChange={(e) => setRow(row.key, { on: e.target.checked })}
                  className="size-4 accent-[var(--accent)]"
                  aria-label={`${row.label(0)}アラート`}
                />
                <span>{row.label(cur[row.field])}</span>
                <input
                  type="number"
                  value={cur[row.field]}
                  min={row.min}
                  max={row.max}
                  disabled={!cur.on}
                  onChange={(e) => setRow(row.key, { [row.field]: Number(e.target.value) })}
                  className="w-16 rounded-lg border border-line bg-[var(--bg)] px-2 py-1 text-center disabled:opacity-50"
                />
                <span>{row.unit}</span>
              </li>
            );
          })}
          <li className="flex items-center gap-2 rounded-2xl bg-card p-3 text-sm">
            <input
              type="checkbox"
              checked={s.rainSoon.on}
              onChange={(e) => setS((p) => ({ ...p, rainSoon: { on: e.target.checked } }))}
              className="size-4 accent-[var(--accent)]"
              id="rainSoon"
            />
            <label htmlFor="rainSoon">雨雲：1時間以内に雨が降りそうなとき</label>
          </li>
        </ul>

        <label className="mt-3 flex items-center gap-2 rounded-2xl bg-lavender/60 p-3 text-sm">
          <input
            type="checkbox"
            checked={s.notify}
            onChange={(e) => toggleNotify(e.target.checked)}
            className="size-4 accent-[var(--accent)]"
          />
          ブラウザの通知でも知らせる（アプリを開いている間）
        </label>
        {notifyMsg && <p className="mt-1 text-xs text-rose">{notifyMsg}</p>}

        <h3 className="mt-6 mb-2 text-sm font-bold">⭐ お気に入り</h3>
        {favs.length === 0 ? (
          <p className="text-sm text-muted">都市を表示して ☆ を押すと追加できます</p>
        ) : (
          <ul className="space-y-2">
            {favs.map((f, i) => (
              <li key={f.id} className="flex items-center gap-2 rounded-2xl bg-card p-2 pl-3 text-sm">
                <input
                  value={f.label}
                  maxLength={20}
                  onChange={(e) => setFavs((list) => list.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))}
                  aria-label={`${f.name} の表示名`}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-[var(--bg)] px-2 py-1"
                />
                <span className="hidden text-xs text-muted sm:inline">{f.name}</span>
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => setFavs((list) => [...list.slice(0, i - 1), list[i], list[i - 1], ...list.slice(i + 1)])}
                  aria-label="上へ"
                  className="px-1 disabled:opacity-25"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => setFavs((list) => list.filter((x) => x.id !== f.id))}
                  aria-label={`${f.label} を削除`}
                  className="rounded-full bg-tone-bad px-2.5 py-0.5 text-xs"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-muted">表示名は「勤務先」「実家」など自由に変えられます</p>

        <div className="mt-6 flex justify-between gap-2">
          <button type="button" onClick={() => setS(DEFAULT_SETTINGS)} className="rounded-full px-4 py-2 text-sm text-muted">
            条件を初期値に戻す
          </button>
          <button
            type="button"
            onClick={() => onSave(s, favs.map((f) => ({ ...f, label: f.label.trim() || f.name })))}
            className="rounded-full bg-accent px-6 py-2 font-bold text-accent-ink"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
