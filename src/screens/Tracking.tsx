import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { company } from '../lib/company';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';

type TrackingRecord = {
  id: string;
  trackingId?: string;
  paymentReference?: string;
  pickup: string | null;
  destination: string | null;
  status: string;
  assignedDriverId: string | null;
  driverName?: string;
  driverPhone?: string;
  vehicleClass: string | null;
  serviceType?: string;
  currentCheckpoint?: string;
  date: string | null;
  time: string | null;
  updatedAt: string | null;
  events: Array<{ id: string; type: string; createdAt: string | null; location?: string; notes?: string }>;
};

const progressByStatus: Record<string, number> = {
  Quoted: 15,
  Booked: 30,
  Paid: 45,
  Confirmed: 60,
  Dispatched: 75,
  InTransit: 85,
  Completed: 100,
  Delivered: 100,
  Cancelled: 100,
};

const defaultTrackingLocations = [
  'Lagos Central Logistics Depot',
  'Ikeja Transit Hub',
  'Lagos-Ibadan Expressway Checkpoint',
  'Seme Border Clearance Station',
  'Cotonou International Transit Office',
  'Port Harcourt Aba Road Hub',
  'Abuja Central Distribution Terminal',
];

function labelEvent(type: string) {
  return type.replace(/[._]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function Tracking() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [trackingInput, setTrackingInput] = useState('');
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
      const cleanRef = reference.trim();
      let foundData: any = null;
      let foundId = '';

      // 1. Try finding booking by direct Document ID
      try {
        const directSnap = await getDoc(doc(db, 'bookings', cleanRef));
        if (directSnap.exists()) {
          foundData = directSnap.data();
          foundId = directSnap.id;
        }
      } catch (e) {
        // Continue to query
      }

      // 2. Try query by trackingId
      if (!foundData) {
        const qTrack = query(collection(db, 'bookings'), where('trackingId', '==', cleanRef));
        const snapTrack = await getDocs(qTrack);
        if (!snapTrack.empty) {
          foundData = snapTrack.docs[0].data();
          foundId = snapTrack.docs[0].id;
        }
      }

      // 3. Try query by paymentReference
      if (!foundData) {
        const qPay = query(collection(db, 'bookings'), where('paymentReference', '==', cleanRef));
        const snapPay = await getDocs(qPay);
        if (!snapPay.empty) {
          foundData = snapPay.docs[0].data();
          foundId = snapPay.docs[0].id;
        }
      }

      // 4. Try lookup in payments collection
      if (!foundData) {
        const qPayments = query(collection(db, 'payments'), where('paymentReference', '==', cleanRef));
        const snapP = await getDocs(qPayments);
        if (!snapP.empty) {
          const pData = snapP.docs[0].data();
          if (pData.bookingId) {
            const bSnap = await getDoc(doc(db, 'bookings', pData.bookingId));
            if (bSnap.exists()) {
              foundData = bSnap.data();
              foundId = bSnap.id;
            }
          }
        }
      }

      if (foundData) {
        const eventsList = Array.isArray(foundData.events) ? foundData.events : [];
        // Add default status milestone if no events yet
        if (eventsList.length === 0) {
          eventsList.push({
            id: 'evt-init',
            type: `Order ${foundData.status || 'Received'}`,
            createdAt: foundData.createdAt || new Date().toISOString(),
            notes: `Booking recorded with tracking ID ${foundData.trackingId || foundId}`,
          });
        }

        setRecord({
          id: foundId,
          trackingId: foundData.trackingId || foundId,
          paymentReference: foundData.paymentReference,
          pickup: foundData.pickup || 'Pickup Terminal',
          destination: foundData.destination || 'Destination Hub',
          status: foundData.status || 'Quoted',
          assignedDriverId: foundData.assignedDriverId || null,
          driverName: foundData.driverName,
          driverPhone: foundData.driverPhone,
          vehicleClass: foundData.vehicleClass || 'Standard Transit',
          serviceType: foundData.serviceType,
          currentCheckpoint: foundData.currentCheckpoint || foundData.pickup || 'En route',
          date: foundData.date || null,
          time: foundData.time || null,
          updatedAt: foundData.updatedAt || foundData.createdAt || null,
          events: eventsList,
        });
      } else {
        setError('No tracking record found for this Reference / Tracking ID. Please double check and try again.');
      }
    } catch (err: any) {
      console.error('Tracking query error:', err);
      setError('Unable to load tracking details. Please check connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadTrackingLocations = async () => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'tracking_locations'));
      if (snap.exists() && Array.isArray(snap.data()?.value) && snap.data()?.value.length > 0) {
        setTrackingLocations(snap.data()?.value);
        return;
      }
    } catch (err) {
      console.warn('Could not load tracking locations', err);
    }
    setTrackingLocations(defaultTrackingLocations);
  };

  useEffect(() => {
    const reference = searchParams.get('booking') || searchParams.get('track');
    if (reference) {
      setTrackingInput(reference);
      loadTracking(reference);
    }
    loadTrackingLocations();
  }, [searchParams]);

  useEffect(() => {
    if (trackingLocations.length === 0) return;
    const interval = window.setInterval(() => {
      setActiveLocationIndex((prev) => (prev + 1) % trackingLocations.length);
    }, 3500);
    return () => window.clearInterval(interval);
  }, [trackingLocations.length]);

  const handleTrack = async (e: FormEvent) => {
    e.preventDefault();
    if (!trackingInput.trim()) return;
    setSearchParams({ booking: trackingInput.trim() });
    await loadTracking(trackingInput.trim());
  };

  const progress = record ? progressByStatus[record.status] || 40 : 0;

  return (
    <div className="min-h-screen bg-background px-4 py-10 md:px-8 md:py-14">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <header className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary mb-3">
              <span className="material-symbols-outlined text-sm">location_searching</span>
              <span>Live Tracking & Transit Status</span>
            </div>
            <h1 className="text-3xl font-black leading-tight text-on-surface sm:text-4xl md:text-5xl">
              Track Your BLM Booking or Shipment
            </h1>
            <p className="mt-4 text-base leading-relaxed text-on-surface-variant">
              Enter your unique Tracking ID or Booking Reference to view live transit milestones, assigned drivers, and dispatch progress.
            </p>
          </div>
          <a
            href={`tel:${company.phone}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline bg-white px-5 py-3.5 text-sm font-bold text-on-surface shadow-sm transition-colors hover:border-primary hover:text-primary"
          >
            <span className="material-symbols-outlined text-base text-primary">call</span>
            <span>24/7 Dispatch Hotline</span>
          </a>
        </header>

        {/* Tracking Search Form */}
        <form onSubmit={handleTrack} className="flex w-full max-w-3xl flex-col gap-3 rounded-2xl border border-outline bg-white p-3 shadow-md sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Tracking or Booking Reference</span>
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">search</span>
            <input
              type="text"
              placeholder="e.g. BLM-TRK-2026-ABC12 or booking ID"
              className="w-full rounded-xl border border-transparent bg-surface-container py-4 pl-12 pr-4 text-sm font-medium text-on-surface transition-colors focus:border-primary focus:bg-white focus:outline-none"
              value={trackingInput}
              onChange={(e) => setTrackingInput(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={loading || !trackingInput.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-container disabled:opacity-60"
          >
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span className="material-symbols-outlined text-base">radar</span>
                <span>Track Movement</span>
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="max-w-3xl rounded-2xl border border-error/20 bg-error-container p-5 text-sm font-bold text-on-error-container">
            {error}
          </div>
        )}

        {/* Real-time Tracking Result View */}
        <AnimatePresence>
          {record && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_0.85fr]"
            >
              {/* Left Main Tracking Card */}
              <section className="rounded-3xl border border-outline bg-white shadow-sm overflow-hidden">
                <div className="border-b border-outline p-6 md:p-8 bg-surface-container/20">
                  <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                        <p className="text-xs font-bold uppercase tracking-wider text-primary">{record.status}</p>
                      </div>
                      <h2 className="text-2xl font-bold text-on-surface sm:text-3xl">{record.serviceType || 'Transit Service'}</h2>
                      <p className="mt-1.5 text-xs text-on-surface-variant">
                        Last Checkpoint: <strong className="text-on-surface font-semibold">{record.currentCheckpoint}</strong>
                      </p>
                    </div>
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-left md:text-right">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Live Tracking ID</p>
                      <p className="mt-1 font-mono text-lg font-black text-on-surface">{record.trackingId}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 md:p-8 space-y-8">
                  {/* Route Overview */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                    <div className="rounded-2xl border border-outline bg-surface-container/40 p-5">
                      <div className="flex items-center gap-2 text-xs font-bold text-primary mb-1">
                        <span className="material-symbols-outlined text-base">trip_origin</span>
                        <span>Pickup Location</span>
                      </div>
                      <p className="text-base font-bold text-on-surface break-words">{record.pickup || 'Designated Pickup Point'}</p>
                    </div>
                    <div className="hidden h-px w-16 bg-outline md:block" />
                    <div className="rounded-2xl border border-outline bg-surface-container/40 p-5">
                      <div className="flex items-center gap-2 text-xs font-bold text-primary mb-1">
                        <span className="material-symbols-outlined text-base">location_on</span>
                        <span>Destination Point</span>
                      </div>
                      <p className="text-base font-bold text-on-surface break-words">{record.destination || 'Destination Hub'}</p>
                    </div>
                  </div>

                  {/* Lifecycle Progress Bar */}
                  <div className="space-y-3">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-on-surface">Transit & Fulfillment Progress</p>
                        <p className="text-xs text-on-surface-variant">Updated in real-time by BLM operations dispatch.</p>
                      </div>
                      <p className="text-2xl font-black text-primary">{progress}%</p>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-surface-container">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-full bg-primary"
                      />
                    </div>
                  </div>

                  {/* Drop Review CTA */}
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-on-surface">How was your service experience?</h4>
                      <p className="text-xs text-on-surface-variant mt-0.5">Share your feedback to help us maintain elite transit quality.</p>
                    </div>
                    <Link
                      to={`/reviews?service=${encodeURIComponent(record.serviceType || '')}&booking=${encodeURIComponent(record.id)}`}
                      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-bold text-white shadow-md transition-all hover:bg-primary-container"
                    >
                      <span className="material-symbols-outlined text-base">star</span>
                      <span>Drop a Review</span>
                    </Link>
                  </div>
                </div>
              </section>

              {/* Right Side: Assignment & Event Milestones */}
              <aside className="space-y-6">
                {/* Trip Specs */}
                <div className="rounded-3xl border border-outline bg-white p-6 shadow-sm">
                  <h3 className="text-base font-bold text-on-surface mb-4">Trip Information</h3>
                  <dl className="space-y-4 text-xs">
                    <div>
                      <dt className="font-semibold text-on-surface-variant">Vehicle Class / Package</dt>
                      <dd className="mt-1 font-bold text-on-surface text-sm">{record.vehicleClass}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-on-surface-variant">Schedule Date & Time</dt>
                      <dd className="mt-1 font-bold text-on-surface text-sm">
                        {[record.date, record.time].filter(Boolean).join(' at ') || 'Scheduled Route'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-on-surface-variant">Assigned Chauffeur / Driver</dt>
                      <dd className="mt-1 font-bold text-on-surface text-sm">
                        {record.driverName || record.assignedDriverId || 'Assigned on Dispatch'}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Tracking Milestones Timeline */}
                <div className="rounded-3xl border border-outline bg-white p-6 shadow-sm">
                  <h3 className="text-base font-bold text-on-surface mb-4">Transit Milestones</h3>
                  {record.events && record.events.length > 0 ? (
                    <ol className="relative space-y-6 border-l-2 border-primary/30 pl-5 ml-2">
                      {record.events.map((event, idx) => (
                        <li key={event.id || idx} className="relative">
                          <span className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-primary shadow-sm" />
                          <p className="text-[11px] font-bold text-primary">
                            {event.createdAt ? new Date(event.createdAt).toLocaleString() : 'Recorded Milestone'}
                          </p>
                          <p className="mt-0.5 text-xs font-bold text-on-surface">{labelEvent(event.type)}</p>
                          {event.notes && <p className="mt-1 text-xs text-on-surface-variant leading-relaxed">{event.notes}</p>}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs font-medium text-on-surface-variant">No tracking events recorded yet.</p>
                  )}
                </div>
              </aside>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Animated Movement Hubs */}
        <div className="rounded-3xl border border-outline bg-white p-7 shadow-sm">
          <h2 className="text-base font-bold text-on-surface mb-2">Operational Checkpoints & Transit Nodes</h2>
          <p className="text-xs text-on-surface-variant mb-6">
            Real-time movement milestones tracked across BLM inter-state and cross-border corridors.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {trackingLocations.map((location, index) => (
              <motion.div
                key={location}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: index === activeLocationIndex ? 1 : 0.5, y: 0 }}
                transition={{ duration: 0.4 }}
                className={`rounded-2xl border p-4 text-xs font-medium transition-all ${
                  index === activeLocationIndex
                    ? 'border-primary bg-primary/5 text-primary shadow-sm ring-1 ring-primary/20'
                    : 'border-outline bg-surface-container/30 text-on-surface-variant'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">
                    {index === activeLocationIndex ? 'my_location' : 'pin_drop'}
                  </span>
                  <span className="font-bold">{location}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
