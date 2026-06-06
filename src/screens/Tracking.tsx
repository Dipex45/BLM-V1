import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { apiGet } from '../lib/api';
import { company } from '../lib/company';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

type TrackingRecord = {
  id: string;
  pickup: string | null;
  destination: string | null;
  status: string;
  assignedDriverId: string | null;
  vehicleClass: string | null;
  date: string | null;
  time: string | null;
  updatedAt: string | null;
  events: Array<{ id: string; type: string; createdAt: string | null; metadata: Record<string, unknown> }>;
};

const progressByStatus: Record<string, number> = {
  Quoted: 10,
  Booked: 25,
  Paid: 40,
  Confirmed: 55,
  Dispatched: 70,
  InTransit: 85,
  Completed: 100,
  Cancelled: 100,
};

const defaultTrackingLocations = [
  'Package in Badagry',
  'Package on route to Cotonou',
  'Package in Ikeja',
  'Package on route to Togo',
];

function labelEvent(type: string) {
  return type.replace(/[._]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function Tracking() {
  const [searchParams] = useSearchParams();
  const [trackingId, setTrackingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState<TrackingRecord | null>(null);
  const [trackingLocations, setTrackingLocations] = useState<string[]>(defaultTrackingLocations);
  const [activeLocationIndex, setActiveLocationIndex] = useState(0);
  const [error, setError] = useState('');

  const loadTracking = async (reference: string) => {
    if (!reference) return;

    setLoading(true);
    setError('');
    setRecord(null);

    try {
      const { data } = await apiGet<TrackingRecord>(`/api/tracking/${encodeURIComponent(reference)}`);
      setRecord(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Tracking reference was not found. Check the booking ID and try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadTrackingLocations = async () => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'tracking_locations'));
      if (snap.exists()) {
        const value = snap.data().value;
        if (Array.isArray(value) && value.length > 0) {
          setTrackingLocations(value);
          return;
        }
      }
    } catch (err) {
      console.warn('Could not load tracking locations from settings', err);
    }
    setTrackingLocations(defaultTrackingLocations);
  };

  useEffect(() => {
    const reference = searchParams.get('booking');
    if (reference) {
      setTrackingId(reference);
      loadTracking(reference);
    }
    loadTrackingLocations();
  }, [searchParams]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveLocationIndex((prev) => (prev + 1) % trackingLocations.length);
    }, 3500);
    return () => window.clearInterval(interval);
  }, [trackingLocations.length]);

  const handleTrack = async (e: FormEvent) => {
    e.preventDefault();
    await loadTracking(trackingId.trim());
  };

  const progress = record ? progressByStatus[record.status] || 35 : 0;

  return (
    <div className="min-h-screen bg-background px-4 py-10 md:px-8 md:py-14">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <header className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-bold text-primary">Booking tracking</p>
            <h1 className="text-4xl font-bold leading-tight text-on-surface md:text-6xl">Track a real BLM booking.</h1>
            <p className="mt-5 text-base leading-7 text-on-surface-variant">
              Enter the booking ID from checkout or your dashboard to see the latest recorded status.
            </p>
          </div>
          <a href={`tel:${company.whatsapp}`} className="inline-flex items-center justify-center gap-2 rounded-md border border-outline bg-white px-5 py-3 text-sm font-bold text-on-surface hover:border-primary hover:text-primary">
            <span className="material-symbols-outlined text-base">call</span>
            {company.whatsapp}
          </a>
        </header>

        <form onSubmit={handleTrack} className="flex w-full max-w-3xl flex-col gap-3 rounded-lg border border-outline bg-white p-3 shadow-sm sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Booking reference</span>
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">location_searching</span>
            <input
              type="text"
              placeholder="Enter booking ID"
              className="w-full rounded-md border border-transparent bg-surface-container py-4 pl-12 pr-4 text-sm font-medium text-on-surface transition-colors focus:border-primary/30 focus:bg-white"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
            />
          </label>
          <button
            disabled={loading || !trackingId.trim()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-7 py-4 text-sm font-bold text-white transition-colors hover:bg-primary-container disabled:opacity-60"
          >
            {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : 'Track booking'}
          </button>
        </form>

        {error && (
          <div className="max-w-3xl rounded-lg border border-error/20 bg-error-container p-5 text-sm font-bold text-on-error-container">
            {error}
          </div>
        )}

        {!record && !error && trackingId.trim() === '' && (
          <div className="grid max-w-3xl gap-4 rounded-lg border border-outline bg-white p-6 text-sm text-on-surface-variant shadow-sm">
            <h2 className="text-base font-bold text-on-surface">Available package locations</h2>
            <p className="text-sm text-on-surface-variant">The tracking page shows status updates for current routes and package movement.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {trackingLocations.map((location, index) => (
                <motion.div
                  key={location}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: index === activeLocationIndex ? 1 : 0.45, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className={`rounded-2xl border border-outline p-4 text-sm font-medium ${index === activeLocationIndex ? 'bg-primary/5 text-on-surface' : 'bg-surface-container text-on-surface-variant'}`}
                >
                  {location}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {record && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_0.85fr]"
            >
              <section className="rounded-lg border border-outline bg-white shadow-sm">
                <div className="border-b border-outline p-6 md:p-8">
                  <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-bold text-primary">{record.status}</p>
                      <h2 className="mt-2 text-3xl font-bold text-on-surface">Booking status is recorded</h2>
                      <p className="mt-2 text-sm text-on-surface-variant">
                        Last update: {record.updatedAt ? new Date(record.updatedAt).toLocaleString() : 'Awaiting dispatch update'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-outline bg-surface-container p-4 text-left md:text-right">
                      <p className="text-sm text-on-surface-variant">Booking ID</p>
                      <p className="mt-1 break-all font-mono text-lg font-bold text-on-surface">{record.id}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 md:p-8">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                    <div className="rounded-lg border border-outline bg-surface-container p-5">
                      <p className="text-sm font-bold text-primary">Pickup</p>
                      <p className="mt-2 text-lg font-bold text-on-surface">{record.pickup || 'Not recorded'}</p>
                    </div>
                    <div className="hidden h-px w-24 bg-outline md:block" />
                    <div className="rounded-lg border border-outline bg-surface-container p-5">
                      <p className="text-sm font-bold text-primary">Destination</p>
                      <p className="mt-2 text-lg font-bold text-on-surface">{record.destination || 'Not recorded'}</p>
                    </div>
                  </div>

                  <div className="mt-8">
                    <div className="mb-3 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-on-surface">Lifecycle progress</p>
                        <p className="text-sm text-on-surface-variant">Calculated from the current booking status.</p>
                      </div>
                      <p className="text-2xl font-bold text-primary">{progress}%</p>
                    </div>
                    <div className="h-3 overflow-hidden rounded-md bg-surface-container-low">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full rounded-md bg-primary"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <aside className="space-y-6">
                <div className="rounded-lg border border-outline bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-on-surface">Trip details</h3>
                  <dl className="mt-5 space-y-5">
                    <div>
                      <dt className="text-sm font-semibold text-on-surface-variant">Vehicle class</dt>
                      <dd className="mt-1 text-sm font-bold text-on-surface">{record.vehicleClass || 'Not assigned'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-semibold text-on-surface-variant">Date and time</dt>
                      <dd className="mt-1 text-sm font-bold text-on-surface">
                        {[record.date, record.time].filter(Boolean).join(' ') || 'Not recorded'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-semibold text-on-surface-variant">Driver</dt>
                      <dd className="mt-1 break-all text-sm font-bold text-on-surface">{record.assignedDriverId || 'Awaiting assignment'}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-lg border border-outline bg-white shadow-sm">
                  <div className="border-b border-outline p-6">
                    <h3 className="text-lg font-bold text-on-surface">Recorded updates</h3>
                  </div>
                  <div className="p-6">
                    {record.events.length > 0 ? (
                      <ol className="relative space-y-6 border-l border-outline pl-6">
                        {record.events.map((event) => (
                          <li key={event.id} className="relative">
                            <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-md bg-primary" />
                            <p className="text-sm font-bold text-primary">
                              {event.createdAt ? new Date(event.createdAt).toLocaleString() : 'Recorded'}
                            </p>
                            <p className="mt-1 text-sm font-bold text-on-surface">{labelEvent(event.type)}</p>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-sm font-medium text-on-surface-variant">No operational events have been recorded for this booking yet.</p>
                    )}
                  </div>
                </div>
              </aside>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
