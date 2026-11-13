import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

export type BookingRecord = Record<string, any> & { id: string; status: string; totalAmount?: number };

const millis = (value: any) => value?.toMillis?.() ?? (Date.parse(value) || 0);

/** Live list of the signed-in customer's own bookings (newest first). */
export function useMyBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, 'bookings'), where('customerId', '==', user.uid)),
      (snapshot) => {
        setBookings(
          snapshot.docs
            .map((document) => ({ id: document.id, ...document.data() }) as BookingRecord)
            .sort((a, b) => millis(b.createdAt) - millis(a.createdAt)),
        );
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.code === 'permission-denied' ? 'We couldn’t load your bookings. Please sign out and back in.' : 'We couldn’t load your bookings. Please check your internet.');
        setLoading(false);
      },
    );
  }, [user]);

  return { bookings, loading, error };
}

export const ACTIVE_STATUSES = ['Paid', 'Confirmed', 'Dispatched', 'InTransit'];
export const STATUS_FLOW = ['Booked', 'Paid', 'Confirmed', 'Dispatched', 'InTransit', 'Completed'];

export const statusTone = (status?: string) => {
  switch (status) {
    case 'Completed': return 'bg-green-100 text-green-800';
    case 'Cancelled': return 'bg-red-100 text-red-800';
    case 'InTransit':
    case 'Dispatched': return 'bg-amber-100 text-amber-900';
    case 'Paid':
    case 'Confirmed': return 'bg-blue-100 text-blue-800';
    default: return 'bg-surface-container text-on-surface';
  }
};

const STATUS_LABELS: Record<string, string> = {
  Quoted: 'Not paid yet',
  Booked: 'Booked',
  Paid: 'Paid',
  Confirmed: 'Driver assigned',
  Dispatched: 'On the way',
  InTransit: 'Trip started',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
};

/** Plain-English name for a booking status (the stored value stays the same). */
export const statusLabel = (status?: string) => (status ? STATUS_LABELS[status] || status : 'Unknown');
