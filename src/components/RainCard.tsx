"use client";

import { useState } from "react";
import type { Day } from "@/lib/types";
import type { RainOutlook } from "@/lib/insights";
import { hourOf } from "@/lib/icons";

type Props = { day: Day; rain: RainOutlook; nowHour: number | null };

const UMBRELLA_STYLE = {
  need: "bg-tone-warn",
  folding: "bg-tone-fair",
  none: "bg-tone-good",
} as const;
const UMBRELLA_ICON = { need: "☂️", folding: "🌂", none: "🙆" } as const;

// 雨の見通し ＋ 1時間ごとの降水確率グラフ
export default function RainCard({ day, rain, nowHour }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? null;
  const h = active !== null ? day.hours[active] : null;

  return (
    <section className="rounded-3xl border border-line bg-card p-5 shadow-soft">
      <h3 className="mb-3 text-sm font-bold">🌧️ 雨の予報</h3>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold">{rain.headline}</p>
          {rain.detail && <p className="mt-0.5 text-sm text-muted">{rain.detail}</p>}
        </div>
        <p className={`rounded-full px-4 py-1.5 text-sm font-bold ${UMBRELLA_STYLE[rain.umbrella]}`}>
          {UMBRELLA_ICON[rain.umbrella]} {rain.umbrellaText}
        </p>
      </div>

      {/* 1時間ごとの降水確率（1系列の棒グラフ） */}
      <div className="mt-5">
        <div className="mb-1 flex items-baseline justify-between text-xs text-muted">
          <span>1時間ごとの降水確率</span>
          <span aria-live="polite" className="text-ink">
            {h
              ? `${hourOf(h.time)}時　降水確率 ${h.pop}%・降水量 ${h.precip.toFixed(1)}mm`
              : `合計降水量 約${day.precipSum}mm`}
          </span>
        </div>
        <div className="relative h-28" onMouseLeave={() => setHover(null)}>
          {/* 50% の目安線 */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
          <span className="pointer-events-none absolute top-1/2 left-0 -translate-y-full bg-card px-1 text-[10px] text-muted">50%</span>
          <div className="flex h-full items-end gap-[2px]">
            {day.hours.map((x, i) => {
              const past = nowHour !== null && hourOf(x.time) < nowHour;
              return (
                <button
                  key={x.time}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  onClick={() => setHover(i)}
                  aria-label={`${hourOf(x.time)}時 降水確率${x.pop}% 降水量${x.precip.toFixed(1)}mm`}
                  className="group flex h-full flex-1 items-end"
                >
                  <span
                    className={`block w-full rounded-t-[4px] transition ${past ? "bg-bar/35" : "bg-bar"} ${
                      active === i ? "ring-2 ring-accent" : ""
                    }`}
                    style={{ height: `${Math.max(x.pop, 2)}%` }}
                  />
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-1 flex gap-[2px] text-[10px] text-muted">
          {day.hours.map((x) => (
            <span key={x.time} className="flex-1 text-center">
              {hourOf(x.time) % 3 === 0 ? hourOf(x.time) : ""}
            </span>
          ))}
        </div>

        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs text-muted">数値で見る</summary>
          <div className="mt-2 max-h-56 overflow-y-auto">
            <table className="w-full text-center text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="py-1">時刻</th>
                  <th>降水確率</th>
                  <th>降水量</th>
                  <th>気温</th>
                </tr>
              </thead>
              <tbody>
                {day.hours.map((x) => (
                  <tr key={x.time} className="border-t border-line">
                    <td className="py-1">{hourOf(x.time)}時</td>
                    <td>{x.pop}%</td>
                    <td>{x.precip.toFixed(1)}mm</td>
                    <td>{Math.round(x.temp)}℃</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  );
}
