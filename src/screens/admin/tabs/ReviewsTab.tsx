import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";

export default function ReviewsTab({
  reviews,
  canModerate,
  onStatus,
}: {
  reviews: any[];
  canModerate: boolean;
  onStatus: (review: any, status: "published" | "hidden") => Promise<void>;
}) {
  const published = reviews.filter((review) => review.status !== "hidden");
  const average = published.length ? published.reduce((sum, review) => sum + Number(review.rating || 0), 0) / published.length : 0;
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline px-5 py-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">Customer reviews</h2>
        <p className="text-sm font-semibold">{average ? `${average.toFixed(1)} / 5 average · ` : ""}{published.length} published · {reviews.length - published.length} hidden</p>
      </div>
      <div className="divide-y divide-outline">
        {reviews.map((review) => (
          <article key={review.id} className={`px-5 py-4 ${review.status === "hidden" ? "bg-surface-container/50 opacity-70" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{review.title || "Untitled review"}</p>
                <p className="mt-1 text-xs text-on-surface-variant">{review.customerName || "Customer"} · {review.serviceType || "Service"} · booking {String(review.bookingId || "").slice(-8)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-amber-700">{"★".repeat(Number(review.rating || 0))}</span>
                <StatusBadge status={review.status || "published"} />
                {canModerate && (
                  <button
                    type="button"
                    onClick={() => onStatus(review, review.status === "hidden" ? "published" : "hidden")}
                    className="h-8 rounded-md border border-outline px-3 text-xs font-bold hover:border-primary hover:text-primary"
                  >
                    {review.status === "hidden" ? "Publish" : "Hide"}
                  </button>
                )}
              </div>
            </div>
            <p className="mt-3 text-sm leading-6">{review.comment}</p>
            {Array.isArray(review.photoUrls) && review.photoUrls.length > 0 && (
              <div className="mt-3 flex gap-2">{review.photoUrls.map((url: string) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="" className="h-14 w-14 rounded-lg object-cover" /></a>)}</div>
            )}
          </article>
        ))}
        {reviews.length === 0 && <EmptyState icon="reviews" title="No reviews yet" description="Reviews from finished trips will show up here." />}
      </div>
    </section>
  );
}
