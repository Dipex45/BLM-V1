import { useState } from "react";

type Diagnostics = {
  checkedAt: string;
  counts: {
    bookings: number;
    payments: number;
    drivers: number;
    failedNotifications: number;
  };
  issues: {
    bookingsMissingCustomer: number;
    bookingsMissingRoute: number;
    bookingsMissingAmount: number;
  };
};

export default function MaintenanceTab({
  onArchive,
  onDiagnostics,
}: {
  onArchive: (reason: string) => Promise<number>;
  onDiagnostics: () => Promise<Diagnostics>;
}) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<Diagnostics | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-lg border border-outline bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
          Archive retained bookings
        </h2>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
          Moves up to 200 completed or cancelled bookings older than 90 days
          into the audit archive. This is a server-side, logged operation.
        </p>
        <label className="mt-5 block text-sm font-semibold">
          Required reason
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            className="mt-1.5 w-full resize-none rounded-md border border-outline bg-surface-container p-3 text-sm"
          />
        </label>
        <label className="mt-3 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <span>
            I confirm that these records have passed the active operational
            retention period.
          </span>
        </label>
        <button
          type="button"
          disabled={busy || !confirmed || reason.trim().length < 5}
          onClick={async () => {
            setBusy(true);
            try {
              const count = await onArchive(reason);
              setMessage(
                count
                  ? `${count} bookings archived.`
                  : "No qualifying bookings found.",
              );
              setReason("");
              setConfirmed(false);
            } finally {
              setBusy(false);
            }
          }}
          className="mt-5 h-10 w-full rounded-md bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Archiving..." : "Archive eligible bookings"}
        </button>
        {message && (
          <p className="mt-3 text-sm font-semibold text-on-surface">
            {message}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-outline bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
          Data diagnostics
        </h2>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
          Checks current bookings, payments, drivers, and failed notification
          records from the trusted API.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setResult(await onDiagnostics());
            } finally {
              setBusy(false);
            }
          }}
          className="mt-5 h-10 rounded-md border border-outline bg-white px-4 text-sm font-bold hover:border-primary hover:text-primary"
        >
          Run diagnostics
        </button>
        {result && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-surface-container p-4">
              <p className="text-xs text-on-surface-variant">
                Bookings checked
              </p>
              <p className="mt-1 text-xl font-bold">{result.counts.bookings}</p>
            </div>
            <div className="rounded-lg bg-surface-container p-4">
              <p className="text-xs text-on-surface-variant">
                Failed notifications
              </p>
              <p className="mt-1 text-xl font-bold">
                {result.counts.failedNotifications}
              </p>
            </div>
            <div className="rounded-lg bg-surface-container p-4">
              <p className="text-xs text-on-surface-variant">
                Missing customer details
              </p>
              <p className="mt-1 text-xl font-bold">
                {result.issues.bookingsMissingCustomer}
              </p>
            </div>
            <div className="rounded-lg bg-surface-container p-4">
              <p className="text-xs text-on-surface-variant">
                Missing route or amount
              </p>
              <p className="mt-1 text-xl font-bold">
                {result.issues.bookingsMissingRoute +
                  result.issues.bookingsMissingAmount}
              </p>
            </div>
            <p className="text-xs text-on-surface-variant sm:col-span-2">
              Checked {new Date(result.checkedAt).toLocaleString()}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
