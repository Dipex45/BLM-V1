import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { statusLabel, statusTone, useMyBookings } from '../hooks/useMyBookings';
import { useCurrency } from '../contexts/CurrencyContext';
import { Stagger, StaggerItem } from '../components/ui/motion';

const FILTERS = ['All', 'Booked', 'Paid', 'InTransit', 'Completed', 'Cancelled'];

export default function BookingHistory() {
  const { bookings, loading, error } = useMyBookings();
  const { formatPrice } = useCurrency();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => bookings.filter((booking) => {
    if (filter !== 'All' && booking.status !== filter) return false;
    const haystack = `${booking.trackingId} ${booking.pickup} ${booking.destination} ${booking.serviceType}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  }), [bookings, filter, search]);

  const downloadCsv = () => {
    const headers = ['Tracking number', 'Service', 'Pickup', 'Destination', 'Vehicle', 'Date', 'Time', 'Status', 'Amount (NGN)'];
    const rows = visible.map((booking) => [booking.trackingId || booking.id, booking.serviceType, booking.pickup, booking.destination, booking.vehicleClass, booking.date, booking.time, booking.status, booking.totalAmount]);
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `blm-bookings-${new Date().toISOString().slice(0, 10)}.csv` });
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container-page py-10 sm:py-14">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">History</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">My bookings</h1>
        </div>
        <button type="button" onClick={downloadCsv} disabled={visible.length === 0} className="btn-outline"><span className="material-symbols-outlined text-lg">download</span> Download list</button>
      </header>

      <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => <button key={item} type="button" className="chip" data-active={filter === item} onClick={() => setFilter(item)}>{statusLabel(item)}</button>)}
        </div>
        <input className="field md:max-w-xs" placeholder="Search by tracking number or place" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error && <p className="alert-error mt-6">{error}</p>}

      {loading ? (
        <div className="mt-6 space-y-3">{[0, 1, 2].map((key) => <div key={key} className="skeleton h-24 rounded-2xl" />)}</div>
      ) : visible.length === 0 ? (
        <div className="card mt-6 p-12 text-center text-on-surface-variant">No bookings found.</div>
      ) : (
        <Stagger className="mt-6 space-y-3" delay={0.04}>
          {visible.map((booking) => (
            <StaggerItem key={booking.id}>
              <Link to={`/checkout/${booking.id}`} className="card card-hover flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold text-primary">{booking.trackingId || booking.id}</p>
                  <p className="mt-1 truncate font-bold">{booking.pickup} → {booking.destination}</p>
                  <p className="mt-0.5 text-sm text-on-surface-variant">{booking.serviceType} · {booking.date} {booking.time}</p>
                </div>
                <div className="flex items-center gap-4 sm:text-right">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone(booking.status)}`}>{statusLabel(booking.status)}</span>
                  <span className="font-bold">{formatPrice(Number(booking.totalAmount || 0))}</span>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
