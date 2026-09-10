export default function EmptyState({
  icon = "inbox",
  title,
  description,
}: {
  icon?: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center px-6 py-12 text-center">
      <span className="material-symbols-outlined text-4xl text-on-surface-variant/45">
        {icon}
      </span>
      <h3 className="mt-3 text-sm font-bold text-on-surface">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-on-surface-variant">
        {description}
      </p>
    </div>
  );
}
