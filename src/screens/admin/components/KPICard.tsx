export default function KPICard({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  icon: string;
  tone?: "neutral" | "blue" | "green" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "bg-green-50 text-green-700"
      : tone === "red"
        ? "bg-red-50 text-red-700"
        : tone === "blue"
          ? "bg-blue-50 text-blue-700"
          : "bg-surface-container text-on-surface";
  return (
    <article className="rounded-lg border border-outline bg-white p-5 shadow-sm">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-md ${toneClass}`}
      >
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-on-surface">{value}</p>
    </article>
  );
}
