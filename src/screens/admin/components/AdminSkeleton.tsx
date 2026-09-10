export default function AdminSkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-label="Loading admin data">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-24 rounded-lg border border-outline bg-white"
          />
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-outline bg-white">
        <div className="h-12 border-b border-outline bg-surface-container" />
        {[0, 1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="mx-5 h-16 border-b border-outline last:border-b-0"
          />
        ))}
      </div>
    </div>
  );
}
