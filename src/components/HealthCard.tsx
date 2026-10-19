import type { Level, Tone } from "@/lib/insights";

export type HealthItem = {
  icon: string;
  title: string;
  value: string; // 例 "UV 6"
  level: Level | null;
  note?: string;
};

const TONE: Record<Tone, string> = {
  good: "bg-tone-good",
  fair: "bg-tone-fair",
  warn: "bg-tone-warn",
  bad: "bg-tone-bad",
  danger: "bg-tone-danger",
};

// 紫外線・熱中症・PM2.5・花粉
export default function HealthCard({ items }: { items: HealthItem[] }) {
  return (
    <section className="rounded-3xl border border-line bg-card p-5 shadow-soft">
      <h3 className="mb-3 text-sm font-bold">🌿 からだと空気</h3>
      <ul className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <li key={it.title} className="flex flex-col gap-1 rounded-2xl border border-line p-3">
            <span className="text-xs text-muted">
              {it.icon} {it.title}
            </span>
            {it.level ? (
              <span className={`self-start rounded-full px-2.5 py-0.5 text-sm font-bold ${TONE[it.level.tone]}`}>
                {it.level.label}
              </span>
            ) : (
              <span className="text-sm text-muted">データなし</span>
            )}
            <span className="text-xs">{it.value}</span>
            {it.note && <span className="text-[11px] leading-snug text-muted">{it.note}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
