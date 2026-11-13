import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { apiDelete, apiGet, apiPost } from '../lib/api';
import { auth } from '../lib/firebase';
import { useAdminFeedback } from '../screens/admin/hooks/useAdminFeedback';

type DeviceSession = {
  id: string;
  current: boolean;
  ip: string;
  userAgent: string;
  revoked: boolean;
  lastSeenAt: string | null;
};

function describeDevice(userAgent: string) {
  const browser = userAgent.includes('Edg/')
    ? 'Microsoft Edge'
    : userAgent.includes('Chrome/')
      ? 'Google Chrome'
      : userAgent.includes('Firefox/')
        ? 'Mozilla Firefox'
        : userAgent.includes('Safari/')
          ? 'Safari'
          : 'Web browser';
  const platform = /Android/i.test(userAgent)
    ? 'Android'
    : /iPhone|iPad/i.test(userAgent)
      ? 'iPhone or iPad'
      : /Windows/i.test(userAgent)
        ? 'Windows'
        : /Mac OS/i.test(userAgent)
          ? 'macOS'
          : /Linux/i.test(userAgent)
            ? 'Linux'
            : 'Unknown device';
  return `${browser} on ${platform}`;
}

function formatLastSeen(value: string | null) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function SessionManager() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const { notify, confirmAction, feedbackLayer } = useAdminFeedback();

  useEffect(() => {
    let active = true;
    apiGet<{ sessions: DeviceSession[] }>('/api/auth/sessions')
      .then((response) => {
        if (!active) return;
        setSessions(response.data.sessions.sort((a, b) => {
          if (a.current !== b.current) return a.current ? -1 : 1;
          return (b.lastSeenAt || '').localeCompare(a.lastSeenAt || '');
        }));
      })
      .catch((error: any) => {
        if (active) notify(error.response?.data?.error || 'We couldn’t load your devices.', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const revokeSession = async (session: DeviceSession) => {
    const confirmation = await confirmAction({
      title: session.current ? 'Sign out of this device?' : 'Sign out that device?',
      message: session.current
        ? 'You’ll be signed out on this device.'
        : `${describeDevice(session.userAgent)} will be signed out.`,
      confirmLabel: 'Sign out',
      tone: 'danger',
    });
    if (confirmation === null) return;

    setWorkingId(session.id);
    try {
      await apiDelete(`/api/auth/sessions/${session.id}`);
      if (session.current) {
        await signOut(auth);
        navigate('/login', { replace: true });
        return;
      }
      setSessions((current) => current.map((item) => item.id === session.id ? { ...item, revoked: true } : item));
      notify('That device has been signed out.', 'success');
    } catch (error: any) {
      notify(error.response?.data?.error || 'We couldn’t sign that device out. Please try again.', 'error');
    } finally {
      setWorkingId(null);
    }
  };

  const revokeAll = async () => {
    const confirmation = await confirmAction({
      title: 'Sign out on every device?',
      message: 'Every phone and computer signed in to your account will be signed out.',
      confirmLabel: 'Sign out everywhere',
      tone: 'danger',
    });
    if (confirmation === null) return;

    setWorkingId('all');
    try {
      await apiPost('/api/auth/sessions/revoke-all', {});
      await signOut(auth);
      navigate('/login', { replace: true });
    } catch (error: any) {
      notify(error.response?.data?.error || 'We couldn’t sign out your devices. Please try again.', 'error');
      setWorkingId(null);
    }
  };

  const activeSessions = sessions.filter((session) => !session.revoked);

  return (
    <section className="rounded-lg border border-outline bg-white p-6 shadow-sm md:p-8" aria-labelledby="device-sessions-title">
      <div className="flex flex-col gap-4 border-b border-outline pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="device-sessions-title" className="flex items-center gap-2 text-sm font-bold text-on-surface">
            <span className="material-symbols-outlined text-lg text-primary">devices</span>
            Signed-in devices
          </h2>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant">Devices that are signed in to your account.</p>
        </div>
        {activeSessions.length > 1 && (
          <button
            type="button"
            onClick={revokeAll}
            disabled={workingId !== null}
            className="h-10 shrink-0 rounded-md border border-red-200 px-4 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {workingId === 'all' ? 'Signing out...' : 'Sign out everywhere'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-5 space-y-3" aria-label="Loading device sessions">
          {[0, 1].map((item) => <div key={item} className="h-20 animate-pulse rounded-md bg-surface-container" />)}
        </div>
      ) : activeSessions.length === 0 ? (
        <p className="py-8 text-center text-sm text-on-surface-variant">No signed-in devices found.</p>
      ) : (
        <div className="divide-y divide-outline">
          {activeSessions.map((session) => (
            <div key={session.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="safe-text text-sm font-bold text-on-surface">{describeDevice(session.userAgent)}</p>
                  {session.current && <span className="rounded bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700">This device</span>}
                </div>
                <p className="mt-1 safe-text text-xs text-on-surface-variant">Last used {formatLastSeen(session.lastSeenAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => revokeSession(session)}
                disabled={workingId !== null}
                className="h-9 shrink-0 rounded-md border border-outline px-3 text-xs font-bold text-on-surface hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
              >
                {workingId === session.id ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          ))}
        </div>
      )}
      {feedbackLayer}
    </section>
  );
}
