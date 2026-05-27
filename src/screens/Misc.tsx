import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useCurrency } from '../hooks/useCurrency';

export function Reports() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'bookings'),
      where('customerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const downloadCsv = () => {
    const headers = ['Booking ID', 'Pickup', 'Destination', 'Vehicle', 'Date', 'Time', 'Status', 'Amount'];
    const rows = bookings.map((booking) => [
      booking.id,
      booking.pickup,
      booking.destination,
      booking.vehicleClass,
      booking.date,
      booking.time,
      booking.status,
      booking.totalAmount,
    ]);
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `blm-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 bg-background p-8 md:p-12">
      <header className="border-b border-outline pb-8">
        <h1 className="text-4xl font-bold leading-none">Booking history.</h1>
        <p className="mt-3 text-sm font-medium text-on-surface-variant">View your real BLM Motors booking records and export them as CSV.</p>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-on-surface-variant">{bookings.length} bookings found</p>
        <button
          onClick={downloadCsv}
          disabled={bookings.length === 0}
          className="rounded-md bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          Download CSV
        </button>
      </div>

      {loading ? (
        <div className="rounded-lg border border-outline bg-white p-10 text-center text-sm font-bold text-on-surface-variant">
          Loading booking records...
        </div>
      ) : bookings.length === 0 ? (
        <div className="rounded-lg border border-outline bg-white p-10 text-center text-sm font-bold text-on-surface-variant">
          No booking records yet.
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking, index) => (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="rounded-lg border border-outline bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-mono text-xs font-bold text-primary">#{booking.id}</p>
                  <h2 className="mt-2 text-lg font-bold text-on-surface">{booking.pickup} to {booking.destination}</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">{booking.vehicleClass} · {booking.date} {booking.time}</p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-sm font-bold text-on-surface">{formatPrice(booking.totalAmount || 0)}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wider text-primary">{booking.status}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
