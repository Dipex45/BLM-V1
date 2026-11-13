import { useEffect, useRef, useState } from 'react';
import { apiErrorMessage, apiGet, apiPost } from '../lib/api';
import { statusLabel } from '../hooks/useMyBookings';

type DriverJob = {
  id: string;
  trackingId: string;
  serviceType: string;
  pickup: string | null;
  destination: string | null;
  date: string | null;
  time: string | null;
  status: string;
  customerName: string;
};

type DriverResponse = {
  driver: { id: string; availability?: { state?: string }; name?: string; profile?: { name?: string } };
  jobs: DriverJob[];
};

export default function DriverPortal() {
  const [data, setData] = useState<DriverResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const watchId = useRef<number | null>(null);
  const lastSentAt = useRef(0);

  const load = async () => {
    try {
      const response = await apiGet<DriverResponse>('/api/drivers/me/jobs');
      setData(response.data);
      setError('');
    } catch (loadError: any) {
      setError(apiErrorMessage(loadError, 'We couldn’t load your trips.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  const setAvailability = async (state: 'available' | 'offline') => {
    setBusy(`availability:${state}`);
    try {
      await apiPost('/api/drivers/me/availability', { state });
      await load();
    } catch (actionError: any) {
      setError(apiErrorMessage(actionError, 'We couldn’t change your status. Please try again.'));
    } finally {
      setBusy('');
    }
  };

  const act = async (job: DriverJob, action: 'accept' | 'reject' | 'arrived' | 'in_transit' | 'completed') => {
    setBusy(`${job.id}:${action}`);
    try {
      await apiPost('/api/drivers/jobs/action', { bookingId: job.id, action });
      await load();
    } catch (actionError: any) {
      setError(apiErrorMessage(actionError, 'We couldn’t update this trip. Please try again.'));
    } finally {
      setBusy('');
    }
  };

  const toggleLocation = () => {
    if (sharing && watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setSharing(false);
      return;
    }
    if (!navigator.geolocation) {
      setError('This phone can’t share its location.');
      return;
    }
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSentAt.current < 12_000) return;
        lastSentAt.current = now;
        const activeJob = data?.jobs.find((job) => ['Confirmed', 'Dispatched', 'InTransit'].includes(job.status));
        apiPost('/api/drivers/location', {
          bookingId: activeJob?.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          heading: position.coords.heading ?? undefined,
          speedKph: position.coords.speed == null ? undefined : Math.max(0, position.coords.speed * 3.6),
          accuracy: position.coords.accuracy,
        }).catch((locationError) => setError(apiErrorMessage(locationError, 'We couldn’t send your location.')));
      },
      (locationError) => {
        setError(locationError.message || 'Please allow location access to share your location.');
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    setSharing(true);
  };

  if (loading) {
    return <div className="mx-auto max-w-3xl animate-pulse space-y-4 px-4 py-10"><div className="h-9 w-52 rounded bg-surface-container" /><div className="h-40 rounded-lg bg-surface-container" /></div>;
  }

  const availability = data?.driver.availability?.state || 'offline';

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-outline pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-primary">Driver</p>
            <h1 className="mt-1 text-3xl font-black text-on-surface">My trips</h1>
            <p className="mt-1 text-sm text-on-surface-variant">{data?.driver.profile?.name || data?.driver.name || 'BLM driver'}</p>
          </div>
          <button type="button" onClick={toggleLocation} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold ${sharing ? 'bg-green-700 text-white' : 'border border-outline bg-white text-on-surface'}`}>
            <span className="material-symbols-outlined text-lg">{sharing ? 'location_on' : 'location_off'}</span>
            {sharing ? 'Sharing my location' : 'Share my location'}
          </button>
        </header>

        {error && <p role="alert" className="rounded-lg border border-error/20 bg-error-container p-4 text-sm font-semibold text-on-error-container">{error}</p>}

        <section className="flex items-center justify-between gap-4 rounded-lg border border-outline bg-white p-4">
          <div>
            <p className="text-sm font-bold text-on-surface">Can you take trips?</p>
            <p className="text-xs text-on-surface-variant">You are {availability === 'available' ? 'available' : availability === 'assigned' ? 'on a trip' : 'offline'}</p>
          </div>
          <div className="flex rounded-lg border border-outline p-1">
            {(['available', 'offline'] as const).map((state) => (
              <button key={state} type="button" disabled={Boolean(busy)} onClick={() => setAvailability(state)} className={`rounded-md px-4 py-2 text-xs font-bold ${availability === state ? 'bg-primary text-white' : 'text-on-surface-variant'}`}>{state === 'available' ? 'Available' : 'Offline'}</button>
            ))}
          </div>
        </section>

        <div className="space-y-4">
          {data?.jobs.map((job) => (
            <article key={job.id} className="overflow-hidden rounded-lg border border-outline bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-outline bg-surface-container/40 p-5">
                <div>
                  <p className="text-[11px] font-bold uppercase text-primary">{job.serviceType}</p>
                  <h2 className="mt-1 font-mono text-lg font-black text-on-surface">{job.trackingId}</h2>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{statusLabel(job.status)}</span>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><p className="text-[11px] font-bold uppercase text-on-surface-variant">Pickup</p><p className="mt-1 text-sm font-bold text-on-surface">{job.pickup || 'Not set yet'}</p></div>
                  <div><p className="text-[11px] font-bold uppercase text-on-surface-variant">Destination</p><p className="mt-1 text-sm font-bold text-on-surface">{job.destination || 'Not set yet'}</p></div>
                </div>
                <p className="text-xs font-semibold text-on-surface-variant">{[job.date, job.time].filter(Boolean).join(' at ') || 'Time not set yet'} | {job.customerName}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {job.status === 'Paid' && <><button type="button" onClick={() => act(job, 'accept')} className="rounded-lg bg-primary px-3 py-3 text-xs font-bold text-white">Accept</button><button type="button" onClick={() => act(job, 'reject')} className="rounded-lg border border-error px-3 py-3 text-xs font-bold text-error">Decline</button></>}
                  {job.status === 'Confirmed' && <button type="button" onClick={() => act(job, 'arrived')} className="rounded-lg bg-primary px-3 py-3 text-xs font-bold text-white">I’ve arrived at pickup</button>}
                  {job.status === 'Dispatched' && <button type="button" onClick={() => act(job, 'in_transit')} className="rounded-lg bg-primary px-3 py-3 text-xs font-bold text-white">Start trip</button>}
                  {job.status === 'InTransit' && <button type="button" onClick={() => act(job, 'completed')} className="rounded-lg bg-green-700 px-3 py-3 text-xs font-bold text-white">Trip finished</button>}
                </div>
              </div>
            </article>
          ))}
          {data?.jobs.length === 0 && <div className="rounded-lg border border-outline bg-white p-10 text-center"><p className="font-bold text-on-surface">No trips right now</p><p className="mt-1 text-sm text-on-surface-variant">New trips will show up here.</p></div>}
        </div>
      </div>
    </div>
  );
}

