import type { CSSProperties, ReactNode } from 'react';

/** One loading block. `delay` (seconds) offsets its light sweep so groups ripple instead of blinking together. */
export function Skeleton({ className = '', delay = 0 }: { className?: string; delay?: number }) {
  return <span aria-hidden="true" className={`skeleton block ${className}`} style={{ '--skeleton-delay': `${delay}s` } as CSSProperties} />;
}

function Loading({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <div role="status" aria-label={label} className={className}>{children}</div>;
}

/** Mirrors the booking form: a section of car choices, then sections of fields. */
export function FormSkeleton() {
  return (
    <Loading label="Loading prices and options" className="space-y-6">
      {[0, 1, 2].map((section) => (
        <div key={section} className="card p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" delay={section * 0.18} />
            <Skeleton className="h-5 w-40" delay={section * 0.18 + 0.06} />
          </div>
          {section === 0 ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((card) => (
                <div key={card} className="rounded-2xl border border-outline p-4">
                  <Skeleton className="h-8 w-8 rounded-lg" delay={card * 0.12} />
                  <Skeleton className="mt-4 h-4 w-2/3" delay={card * 0.12 + 0.06} />
                  <Skeleton className="mt-2 h-4 w-1/2" delay={card * 0.12 + 0.12} />
                  <Skeleton className="mt-4 h-3 w-full" delay={card * 0.12 + 0.18} />
                  <Skeleton className="mt-2 h-3 w-4/5" delay={card * 0.12 + 0.24} />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {(section === 1 ? [0, 1, 2, 3] : [0, 1]).map((field) => (
                <div key={field}>
                  <Skeleton className="h-3 w-24" delay={section * 0.18 + field * 0.08} />
                  <Skeleton className="mt-2 h-12 rounded-xl" delay={section * 0.18 + field * 0.08 + 0.06} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </Loading>
  );
}

/** Mirrors the price summary rows and total. */
export function PriceSkeleton() {
  return (
    <Loading label="Loading price" className="space-y-4">
      {['w-24', 'w-32', 'w-20'].map((width, index) => (
        <div key={width} className="flex items-center justify-between">
          <Skeleton className={`h-4 ${width}`} delay={index * 0.1} />
          <Skeleton className="h-4 w-16" delay={index * 0.1 + 0.08} />
        </div>
      ))}
      <div className="flex items-end justify-between border-t border-outline pt-4">
        <Skeleton className="h-5 w-14" delay={0.34} />
        <Skeleton className="h-9 w-36" delay={0.42} />
      </div>
    </Loading>
  );
}

/** Mirrors booking and review rows. */
export function ListSkeleton({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <Loading label={label} className="space-y-4">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="card flex items-center gap-4 p-5">
          <Skeleton className="h-12 w-12 shrink-0 rounded-2xl" delay={row * 0.14} />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-2/5" delay={row * 0.14 + 0.06} />
            <Skeleton className="mt-3 h-3 w-3/4" delay={row * 0.14 + 0.12} />
          </div>
          <Skeleton className="h-7 w-20 shrink-0 rounded-full" delay={row * 0.14 + 0.18} />
        </div>
      ))}
    </Loading>
  );
}

/** A card with a heading and a few lines, for checkout and tracking panels. */
export function PanelSkeleton({ lines = 5, delay = 0 }: { lines?: number; delay?: number }) {
  return (
    <Loading label="Loading" className="card p-6 sm:p-8">
      <Skeleton className="h-6 w-1/2" delay={delay} />
      <div className="mt-6 space-y-4">
        {Array.from({ length: lines }, (_, line) => (
          <div key={line} className="flex items-center gap-4">
            <Skeleton className="h-9 w-9 shrink-0 rounded-xl" delay={delay + line * 0.1} />
            <Skeleton className={`h-4 ${['w-4/5', 'w-3/5', 'w-2/3'][line % 3]}`} delay={delay + line * 0.1 + 0.06} />
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** Shown while a page's code is still downloading. */
export function PageSkeleton() {
  return (
    <Loading label="Loading page" className="container-page py-16">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-10 w-3/4 sm:w-1/3" delay={0.06} />
      <Skeleton className="mt-4 h-4 w-full sm:w-1/2" delay={0.12} />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {[0, 1, 2].map((card) => (
          <div key={card} className="card p-7">
            <Skeleton className="h-14 w-14 rounded-2xl" delay={card * 0.14} />
            <Skeleton className="mt-8 h-5 w-1/2" delay={card * 0.14 + 0.06} />
            <Skeleton className="mt-4 h-3 w-full" delay={card * 0.14 + 0.12} />
            <Skeleton className="mt-2 h-3 w-4/5" delay={card * 0.14 + 0.18} />
          </div>
        ))}
      </div>
    </Loading>
  );
}
