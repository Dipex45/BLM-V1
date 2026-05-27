import { FormEvent, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type Shipment = {
  id: string;
  origin: string;
  destination: string;
  status: string;
  carrier: string;
  eta: string;
  progress: number;
  logs: Array<{ time: string; event: string; location: string }>;
};

export default function Tracking() {
  const [trackingId, setTrackingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [shipment, setShipment] = useState<Shipment | null>(null);

  const handleTrack = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      setShipment({
        id: trackingId || 'BLM-98214',
        origin: 'Cape Town depot',
        destination: 'Johannesburg delivery address',
        status: 'In transit',
        carrier: 'BLM Fleet 08 - Mercedes Sprinter',
        eta: 'Today, 4:45 PM',
        progress: 72,
        logs: [
          { time: '09:00', event: 'Picked up and checked in', location: 'Cape Town depot' },
          { time: '11:35', event: 'Driver departed regional handoff', location: 'N1 northbound' },
          { time: '14:10', event: 'Delivery window confirmed', location: 'Central transit route' },
        ],
      });
      setLoading(false);
    }, 900);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10 md:px-8 md:py-14">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <header className="max-w-3xl">
          <p className="mb-3 text-sm font-bold text-primary">Delivery tracking</p>
          <h1 className="text-4xl font-bold leading-tight text-on-surface md:text-6xl">Know where the job stands.</h1>
          <p className="mt-5 text-base leading-7 text-on-surface-variant">
            Enter your booking or tracking reference to see the current status, estimated arrival, and latest driver updates.
          </p>
        </header>

        <form onSubmit={handleTrack} className="flex w-full max-w-3xl flex-col gap-3 rounded-lg border border-outline bg-white p-3 shadow-sm sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Tracking reference</span>
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">location_searching</span>
            <input
              type="text"
              placeholder="Enter tracking ID, for example BLM-12345"
              className="w-full rounded-md border border-transparent bg-surface-container py-4 pl-12 pr-4 text-sm font-medium text-on-surface transition-colors focus:border-primary/30 focus:bg-white"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
            />
          </label>
          <button
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md bg-primary px-7 py-4 text-sm font-bold text-white transition-colors hover:bg-primary-container disabled:opacity-60"
          >
            {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : 'Track delivery'}
          </button>
        </form>

        <AnimatePresence>
          {shipment && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_0.85fr]"
            >
              <section className="rounded-lg border border-outline bg-white shadow-sm">
                <div className="border-b border-outline p-6 md:p-8">
                  <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-bold text-primary">{shipment.status}</p>
                      <h2 className="mt-2 text-3xl font-bold text-on-surface">Delivery is on the way</h2>
                      <p className="mt-2 text-sm text-on-surface-variant">Estimated arrival: {shipment.eta}</p>
                    </div>
                    <div className="rounded-lg border border-outline bg-surface-container p-4 text-left md:text-right">
                      <p className="text-sm text-on-surface-variant">Tracking ID</p>
                      <p className="mt-1 font-mono text-lg font-bold text-on-surface">{shipment.id}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 md:p-8">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                    <div className="rounded-lg border border-outline bg-surface-container p-5">
                      <p className="text-sm font-bold text-primary">Pickup</p>
                      <p className="mt-2 text-lg font-bold text-on-surface">{shipment.origin}</p>
                    </div>
                    <div className="hidden h-px w-24 bg-outline md:block" />
                    <div className="rounded-lg border border-outline bg-surface-container p-5">
                      <p className="text-sm font-bold text-primary">Destination</p>
                      <p className="mt-2 text-lg font-bold text-on-surface">{shipment.destination}</p>
                    </div>
                  </div>

                  <div className="mt-8">
                    <div className="mb-3 flex items-end justify-between">
                      <div>
                        <p className="text-sm font-bold text-on-surface">Trip progress</p>
                        <p className="text-sm text-on-surface-variant">Based on the latest driver update.</p>
                      </div>
                      <p className="text-2xl font-bold text-primary">{shipment.progress}%</p>
                    </div>
                    <div className="h-3 overflow-hidden rounded-md bg-surface-container-low">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${shipment.progress}%` }}
                        className="h-full rounded-md bg-primary"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <aside className="space-y-6">
                <div className="rounded-lg border border-outline bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-on-surface">Shipment details</h3>
                  <dl className="mt-5 space-y-5">
                    <div>
                      <dt className="text-sm font-semibold text-on-surface-variant">Assigned vehicle</dt>
                      <dd className="mt-1 text-sm font-bold text-on-surface">{shipment.carrier}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-semibold text-on-surface-variant">Estimated arrival</dt>
                      <dd className="mt-1 text-sm font-bold text-on-surface">{shipment.eta}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-lg border border-outline bg-white shadow-sm">
                  <div className="border-b border-outline p-6">
                    <h3 className="text-lg font-bold text-on-surface">Latest updates</h3>
                  </div>
                  <div className="p-6">
                    <ol className="relative space-y-6 border-l border-outline pl-6">
                      {shipment.logs.map((log) => (
                        <li key={`${log.time}-${log.event}`} className="relative">
                          <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-md bg-primary" />
                          <p className="text-sm font-bold text-primary">{log.time}</p>
                          <p className="mt-1 text-sm font-bold text-on-surface">{log.event}</p>
                          <p className="mt-1 text-sm text-on-surface-variant">{log.location}</p>
                        </li>
                      ))}
                    </ol>
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
