import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { ACTIVE_STATUSES, BookingRecord, STATUS_FLOW, statusLabel, statusTone, useMyBookings } from '../hooks/useMyBookings';
import { useCurrency } from '../contexts/CurrencyContext';
import SessionManager from '../components/SessionManager';
import { AnimatedNumber, easeOutExpo, Stagger, StaggerItem } from '../components/ui/motion';
import ReviewDialog from '../components/ReviewDialog';

export default function Dashboard() {
  const { user } = useAuth();
  const { bookings, loading, error } = useMyBookings();
  const { formatPrice } = useCurrency();
  const [reviewing, setReviewing] = useState<BookingRecord | null>(null);

  const active = bookings.filter((booking) => ACTIVE_STATUSES.includes(booking.status));
  const unpaid = bookings.filter((booking) => ['Quoted', 'Booked'].includes(booking.status));
  const toReview = bookings.filter((booking) => booking.status === 'Completed' && !booking.reviewId);
  const spent = bookings.filter((booking) => [...ACTIVE_STATUSES, 'Completed'].includes(booking.status)).reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0);
  const firstName = (user?.displayName || '').split(' ')[0];

  const stats = [
    { label: 'Active trips', value: active.length, icon: 'local_taxi' },
    { label: 'Not paid yet', value: unpaid.length, icon: 'payments' },
    { label: 'Completed', value: bookings.filter((booking) => booking.status === 'Completed').length, icon: 'task_alt' },
  ];

  return (
    <div className="container-page py-10 sm:py-14">
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOutExpo }} className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-5xl">{firstName ? `Hello, ${firstName}.` : 'Welcome back.'}</h1>
          <p className="mt-2 text-on-surface-variant">Your trips, payments and tracking in one place.</p>
        </div>
        <Link to="/services" className="btn-primary btn-lg"><span className="material-symbols-outlined">add</span> New booking</Link>
      </motion.header>

      {error && <p className="alert-error mt-8">{error}</p>}

      <Stagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StaggerItem key={stat.label} className="card p-6">
            <span className="material-symbols-outlined rounded-xl bg-primary-soft p-2 text-primary">{stat.icon}</span>
            <p className="mt-5 text-sm text-on-surface-variant">{stat.label}</p>
            <p className="mt-1 text-3xl font-extrabold">{loading ? <span className="skeleton inline-block h-8 w-10" /> : <AnimatedNumber value={stat.value} format={String} />}</p>
          </StaggerItem>
        ))}
        <StaggerItem className="card bg-secondary p-6 text-white">
          <span className="material-symbols-outlined rounded-xl bg-white/10 p-2">account_balance_wallet</span>
          <p className="mt-5 text-sm text-white/65">Total paid</p>
          <p className="mt-1 text-3xl font-extrabold">{loading ? '—' : formatPrice(spent)}</p>
        </StaggerItem>
      </Stagger>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Your bookings</h2>
            <Link to="/bookings" className="text-sm font-bold text-primary hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="space-y-4">{[0, 1].map((key) => <div key={key} className="skeleton h-40 rounded-2xl" />)}</div>
          ) : [...unpaid, ...active].length === 0 ? (
            <div className="card flex flex-col items-center p-12 text-center">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant/50">route</span>
              <p className="mt-4 font-bold">No upcoming trips</p>
              <p className="mt-1 text-sm text-on-surface-variant">Book a ride, tour, car or delivery to get started.</p>
              <Link to="/services" className="btn-primary mt-6">Explore services</Link>
            </div>
          ) : (
            <Stagger className="space-y-4">
              {[...unpaid, ...active].map((booking) => <BookingCard key={booking.id} booking={booking} formatPrice={formatPrice} />)}
            </Stagger>
          )}
        </section>

        <aside className="space-y-6">
          {toReview.length > 0 && (
            <div className="card p-6">
              <h2 className="font-bold">Rate your recent trips</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Your review helps other customers.</p>
              <div className="mt-4 space-y-2">
                {toReview.slice(0, 3).map((booking) => (
                  <button key={booking.id} type="button" onClick={() => setReviewing(booking)} className="flex w-full items-center justify-between rounded-xl border border-outline px-4 py-3 text-left text-sm hover:border-primary">
                    <span className="min-w-0"><span className="block truncate font-semibold">{booking.serviceType}</span><span className="text-xs text-on-surface-variant">{booking.date}</span></span>
                    <span className="material-symbols-outlined text-amber-500">star</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="card p-6">
            <h2 className="font-bold">Need help?</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Send us a message and we’ll reply by email or WhatsApp.</p>
            <Link to="/support" className="btn-outline mt-4 w-full">Get help</Link>
          </div>
          <SessionManager />
        </aside>
      </div>

      <AnimatePresence>{reviewing && <ReviewDialog booking={reviewing} onClose={() => setReviewing(null)} />}</AnimatePresence>
    </div>
  );
}

function BookingCard({ booking, formatPrice }: { booking: BookingRecord; formatPrice: (amount: number) => string }) {
  const stepIndex = STATUS_FLOW.indexOf(booking.status);
  const unpaid = ['Quoted', 'Booked'].includes(booking.status);
  return (
    <StaggerItem className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold text-primary">{booking.trackingId || booking.id}</p>
          <h3 className="mt-1 truncate text-lg font-bold">{booking.pickup} → {booking.destination}</h3>
          <p className="mt-1 text-sm text-on-surface-variant">{booking.serviceType} · {booking.vehicleClass} · {booking.date} {booking.time}</p>
        </div>
        <div className="text-right">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone(booking.status)}`}>{statusLabel(booking.status)}</span>
          <p className="mt-2 font-bold">{formatPrice(Number(booking.totalAmount || 0))}</p>
        </div>
      </div>
      <div className="mt-5 flex gap-1.5">
        {STATUS_FLOW.map((step, index) => (
          <motion.span key={step} className="h-1.5 flex-1 rounded-full" initial={{ backgroundColor: '#e2e3df' }} animate={{ backgroundColor: index <= stepIndex ? '#c1121f' : '#e2e3df' }} transition={{ delay: index * 0.08 }} title={statusLabel(step)} />
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {unpaid ? (
          <Link to={`/checkout/${booking.id}`} className="btn-primary py-2.5">Pay now</Link>
        ) : (
          <Link to={`/tracking?booking=${encodeURIComponent(booking.trackingId || booking.id)}`} className="btn-primary py-2.5">Track</Link>
        )}
        <Link to={`/checkout/${booking.id}`} className="btn-outline py-2.5">Details</Link>
      </div>
    </StaggerItem>
  );
}
