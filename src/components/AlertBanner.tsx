import type { Alert, Tone } from "@/lib/insights";

const TONE: Record<Tone, string> = {
  good: "bg-tone-good",
  fair: "bg-tone-fair",
  warn: "bg-tone-warn",
  bad: "bg-tone-bad",
  danger: "bg-tone-danger",
};

// 雨・猛暑・寒さなどのアラート
export default function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return null;
  return (
    <ul className="mt-2 space-y-2" aria-label="アラート">
      {alerts.map((a) => (
        <li key={a.id} className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-bold ${TONE[a.tone]}`}>
          <span className="text-xl">{a.icon}</span>
          <span>{a.text}</span>
        </li>
      ))}
    </ul>
  );
}
