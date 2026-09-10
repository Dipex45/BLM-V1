import { useState } from "react";
import EmptyState from "../components/EmptyState";

export default function SchedulesTab({
  blockedDays,
  onBlock,
  onUnblock,
}: {
  blockedDays: any[];
  onBlock: (date: string, reason: string) => Promise<void>;
  onUnblock: (id: string) => void;
}) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("Service unavailable");
  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <section className="h-fit rounded-lg border border-outline bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
          Block a service date
        </h2>
        <form
          className="mt-5 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await onBlock(date, reason);
            setDate("");
          }}
        >
          <label className="block text-sm font-semibold">
            Date
            <input
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
            />
          </label>
          <label className="block text-sm font-semibold">
            Reason
            <input
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
            />
          </label>
          <button className="h-10 w-full rounded-md bg-primary px-4 text-sm font-bold text-white hover:bg-primary-container">
            Block date
          </button>
        </form>
      </section>
      <section className="overflow-hidden rounded-lg border border-outline bg-white shadow-sm">
        <div className="border-b border-outline px-5 py-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
            Active schedule restrictions
          </h2>
        </div>
        <div className="divide-y divide-outline">
          {blockedDays.map((block) => (
            <div
              key={block.id}
              className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-container/60"
            >
              <div>
                <p className="text-sm font-bold">{block.date}</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {block.reason}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUnblock(block.id)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-red-700 hover:bg-red-50"
                aria-label={`Unblock ${block.date}`}
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          ))}
          {blockedDays.length === 0 && (
            <EmptyState
              icon="event_available"
              title="No blocked dates"
              description="All upcoming dates are currently available for customer bookings."
            />
          )}
        </div>
      </section>
    </div>
  );
}
