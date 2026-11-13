import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { company } from '../lib/company';
import { apiErrorMessage, apiGet } from '../lib/api';
import LiveTrackingMap from '../components/LiveTrackingMap';
import { useLocale } from '../contexts/LocaleContext';
import { STATUS_FLOW, statusLabel } from '../hooks/useMyBookings';
import { easeOutExpo, Spinner } from '../components/ui/motion';

type TrackingEvent = { id: string; type: string; location: string | null; notes: string | null; status: string | null; createdAt: string | null };

type TrackingRecord = {
  id: string;
  trackingId: string;
  pickup: string | null;
  destination: string | null;
  status: string;
  serviceType: string | null;
  vehicleClass: string | null;
  currentCheckpoint: string | null;
  date: string | null;
  time: string | null;
  updatedAt: string | null;
  driver: { name: string; photoUrl?: string | null; rating?: number | null; ratingCount?: number; verificationStatus?: string } | null;
  liveLocation: { latitude: number; longitude: number; heading?: number | null; heartbeatAt?: string | null } | null;
  liveTrackingEnabled: boolean;
  routeMetadata: { distanceText?: string; durationText?: string } | null;
  events: TrackingEvent[];
};

const EVENT_LABELS: Record<string, string> = {
  'booking.booked': 'Booking received',
  'payment.succeeded': 'Payment received',
  'booking.paid': 'Payment received',
  'booking.confirmed': 'Driver assigned',
  'dispatch.assigned': 'Driver assigned',
  'dispatch.manually_assigned': 'Driver assigned',
  'driver.accept': 'Driver accepted the trip',
  'driver.arrived': 'Driver arrived at pickup',
  'driver.in_transit': 'Trip started',
  'driver.completed': 'Trip completed',
  'booking.dispatched': 'Driver on the way to pickup',
  'booking.intransit': 'Trip started',
  'booking.completed': 'Completed',
  'booking.cancelled': 'Booking cancelled',
  'booking.checkpoint_updated': 'Location update',
};

const labelEvent = (type: string) => EVENT_LABELS[type] || type.replace(/[._]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function Tracking() {
  const { t } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const reference = searchParams.get('booking') || searchParams.get('track') || '';
  const [input, setInput] = useState(reference);
  const [record, setRecord] = useState<TrackingRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (value: string, silent = false) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const { data } = await apiGet<TrackingRecord>(`/api/tracking/${encodeURIComponent(value)}`);
      setRecord(data);
      setError('');
    } catch (err: any) {
      if (!silent) {
        setRecord(null);
        setError(err?.response?.status === 404 ? 'We couldn’t find that booking. Please check the tracking number on your confirmation.' : apiErrorMessage(err, 'Tracking isn’t working right now. Please try again shortly.'));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (reference) {
      setInput(reference);
      void load(reference);
    }
  }, [load, reference]);

  // Refresh active trips every 20 seconds while the page is open.
  useEffect(() => {
    if (!record || ['Completed', 'Cancelled'].includes(record.status)) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(record.trackingId || record.id, true);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [load, record]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    if (value) setSearchParams({ booking: value });
  };

  const stepIndex = record ? STATUS_FLOW.indexOf(record.status) : -1;

  return (
    <div>
      <section className="relative overflow-hidden bg-secondary text-white">
        <div className="hero-grid absolute inset-0" />
        <div className="absolute -right-32 top-0 h-96 w-96 rounded-full bg-primary/25 blur-3xl" />
        <div className="container-page relative py-16 sm:py-20">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: easeOutExpo }} className="max-w-3xl">
            <p className="eyebrow">Live tracking</p>
            <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">{t('trackingTitle')}</h1>
            <p className="mt-4 text-white/70">{t('trackingBody')}</p>
          </motion.div>
          <motion.form onSubmit={submit} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7, ease: easeOutExpo }} className="mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-2xl sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Tracking number</span>
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">search</span>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. BLM-TRK-8F2A91C0" className="h-12 w-full rounded-xl pl-12 pr-4 font-mono text-sm font-semibold text-on-surface outline-none" />
            </label>
            <button type="submit" disabled={loading} className="btn-primary h-12">{loading ? <Spinner /> : t('trackingAction')}</button>
          </motion.form>
        </div>
      </section>

      <div className="container-page py-12">
        <AnimatePresence mode="wait">
          {error && <motion.p key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="alert-error"><span className="material-symbols-outlined">search_off</span>{error}</motion.p>}
          {loading && !record && <motion.div key="loading" className="grid gap-6 lg:grid-cols-[1.3fr_1fr]"><div className="skeleton h-80 rounded-2xl" /><div className="skeleton h-80 rounded-2xl" /></motion.div>}
          {record && (
            <motion.div key={record.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOutExpo }} className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
              <section className="card p-6 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-sm font-bold text-primary">{record.trackingId}</p>
                    <h2 className="mt-1 text-2xl font-extrabold">{record.pickup} → {record.destination}</h2>
                    <p className="mt-1 text-sm text-on-surface-variant">{record.serviceType} · {record.vehicleClass} · {record.date} {record.time}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${record.status === 'Cancelled' ? 'bg-red-100 text-red-800' : 'bg-primary-soft text-primary'}`}>{statusLabel(record.status)}</span>
                </div>

                {record.status !== 'Cancelled' && (
                  <ol className="mt-8 grid grid-cols-6 gap-1">
                    {STATUS_FLOW.map((step, index) => (
                      <li key={step} className="text-center">
                        <motion.div className="h-1.5 rounded-full" initial={{ backgroundColor: '#e2e3df' }} animate={{ backgroundColor: index <= stepIndex ? '#c1121f' : '#e2e3df' }} transition={{ delay: index * 0.1 }} />
                        <p className={`mt-2 text-[10px] font-bold uppercase tracking-wide sm:text-xs ${index <= stepIndex ? 'text-on-surface' : 'text-on-surface-variant/60'}`}>{statusLabel(step)}</p>
                      </li>
                    ))}
                  </ol>
                )}

                {record.currentCheckpoint && (
                  <div className="mt-8 flex items-center gap-3 rounded-2xl bg-surface-container p-4">
                    <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-primary" /></span>
                    <div><p className="text-xs text-on-surface-variant">Last seen at</p><p className="font-bold">{record.currentCheckpoint}</p></div>
                  </div>
                )}

                {record.liveTrackingEnabled && record.liveLocation && (
                  <div className="mt-6"><LiveTrackingMap location={record.liveLocation} /></div>
                )}

                <h3 className="mt-8 text-sm font-bold uppercase tracking-wider text-on-surface-variant">Updates</h3>
                {record.events.length === 0 ? (
                  <p className="mt-3 text-sm text-on-surface-variant">No updates yet. They’ll show here as your booking moves along.</p>
                ) : (
                  <ol className="relative mt-4 space-y-5 border-l-2 border-outline pl-6">
                    {record.events.map((event, index) => (
                      <motion.li key={event.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className="relative">
                        <span className={`absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white ${index === 0 ? 'bg-primary' : 'bg-outline-variant'}`} />
                        <p className="font-semibold">{labelEvent(event.type)}{event.location ? ` · ${event.location}` : ''}</p>
                        {event.notes && <p className="text-sm text-on-surface-variant">{event.notes}</p>}
                        {event.createdAt && <p className="text-xs text-on-surface-variant">{new Date(event.createdAt).toLocaleString()}</p>}
                      </motion.li>
                    ))}
                  </ol>
                )}
              </section>

              <aside className="space-y-6">
                <div className="card p-6">
                  <h3 className="font-bold">Your driver</h3>
                  {record.driver ? (
                    <div className="mt-4 flex items-center gap-4">
                      {record.driver.photoUrl ? <img src={record.driver.photoUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"><span className="material-symbols-outlined">person</span></span>}
                      <div>
                        <p className="font-bold">{record.driver.name}</p>
                        <p className="text-sm text-on-surface-variant">{record.driver.rating ? `★ ${record.driver.rating.toFixed(1)} (${record.driver.ratingCount})` : 'Checked by BLM'}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-on-surface-variant">We’ll assign a driver once your payment is confirmed.</p>
                  )}
                </div>
                {record.routeMetadata?.distanceText && (
                  <div className="card p-6">
                    <h3 className="font-bold">Journey</h3>
                    <p className="mt-2 text-sm text-on-surface-variant">{record.routeMetadata.distanceText} · about {record.routeMetadata.durationText}</p>
                  </div>
                )}
                <div className="card p-6">
                  <h3 className="font-bold">Questions about this trip?</h3>
                  <div className="mt-4 grid gap-2">
                    <a href={`tel:${company.phone}`} className="btn-outline"><span className="material-symbols-outlined text-lg">call</span> {company.phoneDisplay}</a>
                    <a href={`https://wa.me/${company.whatsapp.replace('+', '')}?text=${encodeURIComponent(`Good day BLM, I have a question about booking ${record.trackingId}.`)}`} target="_blank" rel="noreferrer" className="btn bg-[#25D366] text-white">WhatsApp us</a>
                  </div>
                  {record.updatedAt && <p className="mt-4 text-xs text-on-surface-variant">Last updated {new Date(record.updatedAt).toLocaleString()}</p>}
                </div>
              </aside>
            </motion.div>
          )}
          {!record && !loading && !error && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4 sm:grid-cols-3">
              {[['receipt_long', 'Find your number', 'It’s in your confirmation email, your SMS and on the payment page.'], ['travel_explore', 'See each step', 'Payment, driver assigned, on the way and arrived.'], ['my_location', 'See it on a map', 'Watch the car on a map once it’s on the road.']].map(([icon, title, body]) => (
                <div key={title} className="card p-6"><span className="material-symbols-outlined text-primary">{icon}</span><p className="mt-3 font-bold">{title}</p><p className="mt-1 text-sm text-on-surface-variant">{body}</p></div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
