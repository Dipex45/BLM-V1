import { Skeleton } from '../../../components/ui/Skeleton';

export default function AdminSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading admin data">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="rounded-lg border border-outline bg-white p-5">
            <Skeleton className="h-3 w-20" delay={item * 0.12} />
            <Skeleton className="mt-4 h-8 w-28" delay={item * 0.12 + 0.06} />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-outline bg-white">
        <div className="border-b border-outline bg-surface-container px-5 py-4">
          <Skeleton className="h-4 w-40" />
        </div>
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="flex items-center gap-4 border-b border-outline px-5 py-4 last:border-b-0">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" delay={item * 0.1} />
            <Skeleton className="h-4 w-1/3" delay={item * 0.1 + 0.06} />
            <Skeleton className="ml-auto h-4 w-20" delay={item * 0.1 + 0.12} />
          </div>
        ))}
      </div>
    </div>
  );
}
