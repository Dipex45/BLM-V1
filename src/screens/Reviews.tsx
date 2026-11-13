import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { apiErrorMessage, apiGet } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { BookingRecord, useMyBookings } from '../hooks/useMyBookings';
import { company } from '../lib/company';
import ReviewDialog from '../components/ReviewDialog';
import { easeOutExpo, Reveal, Stagger, StaggerItem } from '../components/ui/motion';

type Review = { id: string; customerName: string; serviceType: string; rating: number; title: string; comment: string; photoUrls: string[]; createdAt: string | null };

function Stars({ value, size = 'text-lg' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => <span key={star} className={`material-symbols-outlined ${size} ${star <= Math.round(value) ? 'fill-icon text-amber-500' : 'text-outline-variant'}`}>star</span>)}
    </span>
  );
}

function EligibleTrips({ onPick }: { onPick: (booking: BookingRecord) => void }) {
  const { bookings, loading } = useMyBookings();
  const eligible = bookings.filter((booking) => booking.status === 'Completed' && !booking.reviewId);
  if (loading) return <div className="skeleton h-16" />;
  if (!eligible.length) return <p className="text-sm text-on-surface-variant">You can review a trip after it’s finished.</p>;
  return (
    <div className="space-y-2">
      {eligible.map((booking) => (
        <button key={booking.id} type="button" onClick={() => onPick(booking)} className="flex w-full items-center justify-between rounded-xl border border-outline px-4 py-3 text-left text-sm hover:border-primary">
          <span><span className="block font-semibold">{booking.serviceType}</span><span className="text-xs text-on-surface-variant">{booking.date} · {booking.trackingId}</span></span>
          <span className="text-xs font-bold text-primary">Review</span>
        </button>
      ))}
    </div>
  );
}

export default function Reviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [service, setService] = useState('All');
  const [reviewing, setReviewing] = useState<BookingRecord | null>(null);

  const load = useCallback(() => {
    apiGet<{ reviews: Review[] }>('/api/reviews')
      .then((response) => { setReviews(response.data.reviews); setError(null); })
      .catch((err) => setError(apiErrorMessage(err, 'We couldn’t load reviews right now.')));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => (reviews || []).filter((review) => service === 'All' || review.serviceType === service), [reviews, service]);
  const average = reviews?.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const distribution = [5, 4, 3, 2, 1].map((star) => ({ star, count: (reviews || []).filter((review) => review.rating === star).length }));

  return (
    <div className="container-page py-12 sm:py-16">
      <div className="grid gap-10 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
          <Reveal className="card p-6">
            <p className="eyebrow">Real customer reviews</p>
            <div className="mt-4 flex items-end gap-3">
              <span className="text-6xl font-extrabold">{average ? average.toFixed(1) : '—'}</span>
              <div className="pb-2"><Stars value={average} /><p className="text-xs text-on-surface-variant">{reviews?.length || 0} reviews</p></div>
            </div>
            <div className="mt-6 space-y-2">
              {distribution.map(({ star, count }) => (
                <div key={star} className="flex items-center gap-3 text-xs">
                  <span className="w-3 font-bold">{star}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container">
                    <motion.div className="h-full rounded-full bg-amber-500" initial={{ width: 0 }} whileInView={{ width: `${reviews?.length ? (count / reviews.length) * 100 : 0}%` }} viewport={{ once: true }} transition={{ duration: 0.9, ease: easeOutExpo }} />
                  </div>
                  <span className="w-6 text-right text-on-surface-variant">{count}</span>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-on-surface-variant">Only customers who’ve finished a trip with us can post a review.</p>
          </Reveal>
          <div className="card p-6">
            <h2 className="font-bold">Tell us how it went</h2>
            <div className="mt-4">
              {user ? <EligibleTrips onPick={setReviewing} /> : <Link to="/login" state={{ from: '/reviews' }} className="btn-primary w-full">Sign in to review</Link>}
            </div>
          </div>
        </aside>

        <section>
          <h1 className="text-4xl font-extrabold sm:text-5xl">What our customers say</h1>
          <div className="mt-6 flex flex-wrap gap-2">
            {['All', ...company.services.map((item) => item.title)].map((item) => (
              <button key={item} type="button" className="chip" data-active={service === item} onClick={() => setService(item)}>{item}</button>
            ))}
          </div>
          {error && <p className="alert-error mt-6">{error}</p>}
          {!reviews && !error ? (
            <div className="mt-8 space-y-4">{[0, 1, 2].map((key) => <div key={key} className="skeleton h-36 rounded-2xl" />)}</div>
          ) : visible.length === 0 ? (
            <div className="card mt-8 p-12 text-center text-on-surface-variant">No reviews yet for this service.</div>
          ) : (
            <Stagger className="mt-8 grid gap-4 md:grid-cols-2">
              {visible.map((review) => (
                <StaggerItem key={review.id} className="card flex flex-col p-6">
                  <div className="flex items-center justify-between"><Stars value={review.rating} size="text-base" /><span className="text-xs text-on-surface-variant">{review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}</span></div>
                  <h3 className="mt-3 font-bold">{review.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-on-surface-variant">{review.comment}</p>
                  {review.photoUrls.length > 0 && (
                    <div className="mt-4 flex gap-2">{review.photoUrls.map((url) => <img key={url} src={url} alt="" loading="lazy" className="h-16 w-16 rounded-xl object-cover" />)}</div>
                  )}
                  <div className="mt-5 flex items-center gap-3 border-t border-outline pt-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">{review.customerName.charAt(0).toUpperCase()}</span>
                    <div><p className="text-sm font-semibold">{review.customerName}</p><p className="flex items-center gap-1 text-xs text-success"><span className="material-symbols-outlined text-sm">verified</span>{review.serviceType}</p></div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </section>
      </div>
      <AnimatePresence>{reviewing && <ReviewDialog booking={reviewing} onClose={() => setReviewing(null)} onSubmitted={load} />}</AnimatePresence>
    </div>
  );
}
