"use client";

import { useState } from "react";
import type { Day } from "@/lib/types";
import { WEEK, codeEmoji, codeText } from "@/lib/icons";

type Props = {
  days: Day[];
  today: string;
  selected: string;
  onSelect: (date: string) => void;
};

const pad = (n: number) => String(n).padStart(2, "0");

// 予報がある日だけ選べる月カレンダー
export default function Calendar({ days, today, selected, onSelect }: Props) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const [ty, tm] = today.split("-").map(Number);
  const last = days[days.length - 1]?.date ?? today;
  const [ly, lm] = last.split("-").map(Number);

  // 表示中の月（予報が月をまたぐときだけ切り替えられる）
  const [view, setView] = useState({ y: ty, m: tm });
  const canPrev = view.y > ty || (view.y === ty && view.m > tm);
  const canNext = view.y < ly || (view.y === ly && view.m < lm);
  const move = (diff: number) => {
    const d = new Date(view.y, view.m - 1 + diff, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() + 1 });
  };

  const firstWeekday = new Date(view.y, view.m - 1, 1).getDay();
  const daysInMonth = new Date(view.y, view.m, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={!canPrev}
          className="rounded-full px-3 py-1 text-lg disabled:opacity-25"
          aria-label="前の月"
        >
          ‹
        </button>
        <p className="font-bold">
          {view.y}年 {view.m}月
        </p>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={!canNext}
          className="rounded-full px-3 py-1 text-lg disabled:opacity-25"
          aria-label="次の月"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {WEEK.map((w, i) => (
          <div key={w} className={`pb-1 font-bold ${i === 0 ? "text-rose" : i === 6 ? "text-sky-ink" : "text-muted"}`}>
            {w}
          </div>
        ))}

        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const date = `${view.y}-${pad(view.m)}-${pad(day)}`;
          const info = byDate.get(date);
          const isSelected = date === selected;
          const isToday = date === today;

          if (!info) {
            return (
              <div key={date} className="flex aspect-square flex-col items-center justify-center rounded-xl text-muted/50">
                {day}
              </div>
            );
          }
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-pressed={isSelected}
              aria-label={`${view.m}月${day}日 ${codeText(info.code)}`}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl transition ${
                isSelected
                  ? "bg-lavender font-bold shadow-sm ring-2 ring-accent"
                  : "bg-mint/70 hover:bg-mint"
              }`}
            >
              <span className={isToday ? "underline decoration-2 underline-offset-2" : ""}>{day}</span>
              <span className="text-base leading-none sm:text-lg">{codeEmoji(info.code)}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-muted">色のついた日（今日〜6日後）の予報を選べます</p>
    </div>
  );
}
