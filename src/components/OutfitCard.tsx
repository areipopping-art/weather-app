import type { Suggestion } from "@/lib/insights";

// 服装・持ち物の提案
export default function OutfitCard({ items }: { items: Suggestion[] }) {
  return (
    <section className="rounded-3xl border border-line bg-card p-5 shadow-soft">
      <h3 className="mb-3 text-sm font-bold">👗 服装・持ち物</h3>
      <ul className="space-y-2">
        {items.map((s) => (
          <li key={s.text} className="flex items-center gap-3 rounded-2xl bg-peach/60 px-3 py-2">
            <span className="text-2xl">{s.icon}</span>
            <span className="text-sm">{s.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
