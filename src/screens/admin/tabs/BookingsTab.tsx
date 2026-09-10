import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import DataTable, {
  tableCellClass,
  tableHeaderClass,
} from "../components/DataTable";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";

type Props = {
  bookings: any[];
  drivers: any[];
  formatPrice: (amount: number, currency?: any) => string;
  canUpdateStatus: boolean;
  canAssign: boolean;
  onStatus: (booking: any, status: string) => Promise<void>;
  onAssign: (bookingId: string, driverId: string) => Promise<void>;
  onAutoAssign: (bookingId: string) => Promise<void>;
  onCheckpoint: (
    bookingId: string,
    location: string,
    status: string,
  ) => Promise<void>;
  onLoadMore: () => void;
  hasMore: boolean;
};

export default function BookingsTab({
  bookings,
  drivers,
  formatPrice,
  canUpdateStatus,
  canAssign,
  onStatus,
  onAssign,
  onAutoAssign,
  onCheckpoint,
  onLoadMore,
  hasMore,
}: Props) {
  const [selected, setSelected] = useState<any | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [checkpoint, setCheckpoint] = useState("");
  const [checkpointStatus, setCheckpointStatus] = useState("InTransit");
  const visible = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          (!dateFrom || booking.date >= dateFrom) &&
          (!dateTo || booking.date <= dateTo),
      ),
    [bookings, dateFrom, dateTo],
  );

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-outline bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-outline px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
              Booking operations
            </h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              Open a row for route history, tracking, and dispatch controls.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="text-xs font-semibold text-on-surface-variant">
              From
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="mt-1 block h-9 rounded-md border border-outline bg-white px-2 text-sm text-on-surface"
              />
            </label>
            <label className="text-xs font-semibold text-on-surface-variant">
              To
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="mt-1 block h-9 rounded-md border border-outline bg-white px-2 text-sm text-on-surface"
              />
            </label>
          </div>
        </div>
        {visible.length ? (
          <DataTable label="Bookings">
            <thead>
              <tr>
                <th className={tableHeaderClass}>Reference</th>
                <th className={tableHeaderClass}>Customer</th>
                <th className={tableHeaderClass}>Route</th>
                <th className={tableHeaderClass}>Vehicle</th>
                <th className={tableHeaderClass}>Amount</th>
                <th className={tableHeaderClass}>Status</th>
                <th className={tableHeaderClass}>Payment</th>
                <th className={tableHeaderClass}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((booking) => (
                <tr
                  key={booking.id}
                  className="cursor-pointer hover:bg-surface-container/60"
                  onClick={() => {
                    setSelected(booking);
                    setCheckpoint(
                      booking.currentCheckpoint || booking.pickup || "",
                    );
                    setCheckpointStatus(booking.status || "InTransit");
                  }}
                >
                  <td className={tableCellClass}>
                    <p className="font-mono font-bold text-primary">
                      {booking.trackingId || booking.id?.slice(-8)}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {booking.date || "Date pending"}
                    </p>
                  </td>
                  <td className={tableCellClass}>
                    <p className="font-semibold">
                      {booking.customerName || "Customer"}
                    </p>
                    <p className="mt-1 max-w-44 truncate text-xs text-on-surface-variant">
                      {booking.customerEmail}
                    </p>
                  </td>
                  <td className={tableCellClass}>
                    <p className="max-w-56 truncate font-semibold">
                      {booking.pickup}
                    </p>
                    <p className="mt-1 max-w-56 truncate text-xs text-on-surface-variant">
                      to {booking.destination}
                    </p>
                  </td>
                  <td className={tableCellClass}>{booking.vehicleClass}</td>
                  <td className={`${tableCellClass} font-bold`}>
                    {formatPrice(booking.totalAmount || 0)}
                  </td>
                  <td className={tableCellClass}>
                    <StatusBadge status={booking.status} />
                  </td>
                  <td className={tableCellClass}>
                    <StatusBadge
                      status={
                        booking.paymentStatus ||
                        (booking.status === "Paid"
                          ? "Paid"
                          : "Awaiting payment")
                      }
                    />
                  </td>
                  <td className={tableCellClass}>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelected(booking);
                      }}
                      className="h-9 rounded-md border border-outline px-3 text-sm font-bold hover:border-primary hover:text-primary"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <EmptyState
            icon="route"
            title="No bookings found"
            description="Bookings matching the active search and date filters will appear here."
          />
        )}
        {hasMore && (
          <div className="border-t border-outline p-4 text-center">
            <button
              type="button"
              onClick={onLoadMore}
              className="h-10 rounded-md border border-outline px-5 text-sm font-bold hover:border-primary hover:text-primary"
            >
              Load more
            </button>
          </div>
        )}
      </section>

      <AnimatePresence>
        {selected && (
          <>
            <motion.button
              type="button"
              aria-label="Close booking details"
              className="fixed inset-0 z-[80] bg-black/45"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Booking details"
              className="fixed bottom-0 right-0 top-0 z-[90] w-full max-w-xl overflow-y-auto bg-white shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <header className="sticky top-0 z-10 flex items-start justify-between border-b border-outline bg-white px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Booking detail
                  </p>
                  <h2 className="mt-1 font-mono text-lg font-bold">
                    {selected.trackingId || selected.id}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-surface-container"
                  aria-label="Close"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </header>
              <div className="space-y-6 p-5">
                <div className="grid gap-4 rounded-lg border border-outline bg-surface-container/40 p-4 sm:grid-cols-2">
                  <Detail label="Customer" value={selected.customerName} />
                  <Detail label="Phone" value={selected.customerPhone} />
                  <Detail label="Pickup" value={selected.pickup} />
                  <Detail label="Destination" value={selected.destination} />
                  <Detail label="Vehicle" value={selected.vehicleClass} />
                  <Detail
                    label="Total"
                    value={formatPrice(selected.totalAmount || 0)}
                  />
                </div>
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
                    Lifecycle
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge status={selected.status} />
                    <StatusBadge
                      status={selected.paymentStatus || "Awaiting payment"}
                    />
                  </div>
                </section>
                {canUpdateStatus && (
                  <section className="rounded-lg border border-outline p-4">
                    <h3 className="text-sm font-bold">Update status</h3>
                    <select
                      value={selected.status}
                      onChange={async (event) => {
                        await onStatus(selected, event.target.value);
                        setSelected({
                          ...selected,
                          status: event.target.value,
                        });
                      }}
                      className="mt-3 h-11 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
                    >
                      <option>Quoted</option>
                      <option>Paid</option>
                      <option>Confirmed</option>
                      <option>Dispatched</option>
                      <option>InTransit</option>
                      <option>Completed</option>
                      <option>Cancelled</option>
                    </select>
                  </section>
                )}
                {canAssign &&
                  ["Paid", "Confirmed", "Dispatched", "InTransit"].includes(
                    selected.status,
                  ) && (
                    <section className="rounded-lg border border-outline p-4">
                      <h3 className="text-sm font-bold">Driver assignment</h3>
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                        <select
                          value={
                            selected.assignedDriverId || selected.driverId || ""
                          }
                          onChange={async (event) => {
                            if (!event.target.value) return;
                            await onAssign(selected.id, event.target.value);
                            setSelected({
                              ...selected,
                              assignedDriverId: event.target.value,
                            });
                          }}
                          className="h-11 min-w-0 flex-1 rounded-md border border-outline bg-surface-container px-3 text-sm"
                        >
                          <option value="">Select driver</option>
                          {drivers.map((driver) => (
                            <option key={driver.id} value={driver.id}>
                              {driver.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={async () => {
                            await onAutoAssign(selected.id);
                            setSelected(null);
                          }}
                          className="h-11 rounded-md border border-outline px-4 text-sm font-bold hover:border-primary hover:text-primary"
                        >
                          Auto assign
                        </button>
                      </div>
                    </section>
                  )}
                {canUpdateStatus && (
                  <form
                    className="rounded-lg border border-outline p-4"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      await onCheckpoint(
                        selected.id,
                        checkpoint,
                        checkpointStatus,
                      );
                      setSelected(null);
                    }}
                  >
                    <h3 className="text-sm font-bold">Tracking checkpoint</h3>
                    <label className="mt-3 block text-sm font-semibold">
                      Customer-facing location
                      <input
                        required
                        value={checkpoint}
                        onChange={(event) => setCheckpoint(event.target.value)}
                        className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
                      />
                    </label>
                    <label className="mt-3 block text-sm font-semibold">
                      Status
                      <select
                        value={checkpointStatus}
                        onChange={(event) =>
                          setCheckpointStatus(event.target.value)
                        }
                        className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
                      >
                        <option>Confirmed</option>
                        <option>Dispatched</option>
                        <option>InTransit</option>
                        <option>Completed</option>
                      </select>
                    </label>
                    <button className="mt-4 h-10 w-full rounded-md bg-primary px-4 text-sm font-bold text-white hover:bg-primary-container">
                      Save checkpoint
                    </button>
                  </form>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold">
        {value || "Not provided"}
      </p>
    </div>
  );
}
