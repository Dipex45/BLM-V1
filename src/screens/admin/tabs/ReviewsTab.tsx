import EmptyState from "../components/EmptyState";

export default function ReviewsTab({ reviews }: { reviews: any[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-outline bg-white shadow-sm">
      <div className="border-b border-outline px-5 py-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
          Verified customer feedback
        </h2>
      </div>
      <div className="divide-y divide-outline">
        {reviews.map((review) => (
          <article
            key={review.id}
            className="px-5 py-4 hover:bg-surface-container/60"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">
                  {review.title ||
                    `Booking ${String(review.bookingId || "").slice(-6)}`}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {review.customerName || "Verified customer"} /{" "}
                  {review.serviceType || "Service"}
                </p>
              </div>
              <span className="text-sm font-bold text-amber-700">
                {review.rating}/5
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-on-surface">
              {review.comment}
            </p>
          </article>
        ))}
        {reviews.length === 0 && (
          <EmptyState
            icon="reviews"
            title="No reviews yet"
            description="Completed-booking reviews will appear here after customer submission."
          />
        )}
      </div>
    </section>
  );
}
