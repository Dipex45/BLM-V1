import { useMemo, useState } from "react";
import { PaymentRecord } from "../../../lib/payments/types";
import DataTable, {
  tableCellClass,
  tableHeaderClass,
} from "../components/DataTable";
import EmptyState from "../components/EmptyState";
import KPICard from "../components/KPICard";
import StatusBadge from "../components/StatusBadge";

type Props = {
  payments: PaymentRecord[];
  formatPrice: (amount: number, currency?: any) => string;
  canManage: boolean;
  onApprove: (payment: PaymentRecord) => Promise<void>;
  onReject: (payment: PaymentRecord, reason: string) => Promise<void>;
  onReconcile: (payment: PaymentRecord) => Promise<void>;
};

export default function PaymentsTab({
  payments,
  formatPrice,
  canManage,
  onApprove,
  onReject,
  onReconcile,
}: Props) {
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<PaymentRecord | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const visible = useMemo(
    () =>
      payments.filter(
        (payment) => filter === "All" || payment.status === filter,
      ),
    [payments, filter],
  );
  const paid = payments.filter((payment) => payment.status === "PAID");

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          label="Transactions"
          value={payments.length}
          icon="receipt_long"
        />
        <KPICard
          label="Under review"
          value={
            payments.filter((payment) =>
              ["PAYMENT_SUBMITTED", "UNDER_REVIEW"].includes(payment.status),
            ).length
          }
          icon="hourglass_top"
          tone="blue"
        />
        <KPICard
          label="Verified revenue"
          value={formatPrice(
            paid.reduce((sum, payment) => sum + (payment.amount || 0), 0),
          )}
          icon="payments"
          tone="green"
        />
        <KPICard
          label="Unreconciled"
          value={paid.filter((payment) => !payment.isReconciled).length}
          icon="rule"
          tone="red"
        />
      </div>
      <section className="mt-6 overflow-hidden rounded-lg border border-outline bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-outline px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
              Payment ledger
            </h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              Provider references, customer evidence, and settlement state.
            </p>
          </div>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="h-10 rounded-md border border-outline bg-white px-3 text-sm font-semibold"
          >
            <option>All</option>
            <option value="PAYMENT_SUBMITTED">Awaiting proof</option>
            <option value="UNDER_REVIEW">Under review</option>
            <option value="PAID">Paid</option>
            <option value="PAYMENT_REJECTED">Rejected</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>
        {visible.length ? (
          <DataTable label="Payments">
            <thead>
              <tr>
                <th className={tableHeaderClass}>Reference</th>
                <th className={tableHeaderClass}>Customer</th>
                <th className={tableHeaderClass}>Amount</th>
                <th className={tableHeaderClass}>Method</th>
                <th className={tableHeaderClass}>Status</th>
                <th className={tableHeaderClass}>Settlement</th>
                <th className={tableHeaderClass}>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((payment) => (
                <tr key={payment.id} className="hover:bg-surface-container/60">
                  <td className={tableCellClass}>
                    <p className="font-mono font-bold text-primary">
                      {payment.paymentReference || payment.id.slice(-8)}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Booking {payment.bookingId?.slice(-8)}
                    </p>
                  </td>
                  <td className={tableCellClass}>
                    <p className="font-semibold">
                      {payment.customerName || "Customer"}
                    </p>
                    <p className="mt-1 max-w-44 truncate text-xs text-on-surface-variant">
                      {payment.customerEmail}
                    </p>
                  </td>
                  <td className={`${tableCellClass} font-bold`}>
                    {formatPrice(payment.amount || 0, payment.currency)}
                  </td>
                  <td className={tableCellClass}>{payment.method}</td>
                  <td className={tableCellClass}>
                    <StatusBadge status={payment.status} />
                  </td>
                  <td className={tableCellClass}>
                    <StatusBadge
                      status={payment.isReconciled ? "Reconciled" : "Pending"}
                    />
                  </td>
                  <td className={tableCellClass}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(payment);
                        setRejecting(false);
                        setReason("");
                      }}
                      className="h-9 rounded-md border border-outline px-3 text-sm font-bold hover:border-primary hover:text-primary"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <EmptyState
            icon="payments"
            title="No payment records"
            description="Transactions matching the selected settlement filter will appear here."
          />
        )}
      </section>
      {selected && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-dialog-title"
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-outline bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-outline p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Payment evidence
                </p>
                <h2
                  id="payment-dialog-title"
                  className="mt-1 font-mono text-lg font-bold"
                >
                  {selected.paymentReference}
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
            <div className="grid gap-5 p-5 md:grid-cols-[1fr_280px]">
              <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-lg border border-outline bg-surface-container p-4">
                {selected.proofOfPaymentUrl ? (
                  selected.proofFileName?.toLowerCase().endsWith(".pdf") ? (
                    <a
                      href={selected.proofOfPaymentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-bold text-primary"
                    >
                      <span className="material-symbols-outlined">
                        picture_as_pdf
                      </span>
                      Open PDF evidence
                    </a>
                  ) : (
                    <img
                      src={selected.proofOfPaymentUrl}
                      alt="Customer payment proof"
                      className="max-h-[55vh] w-full object-contain"
                    />
                  )
                ) : (
                  <p className="text-sm text-on-surface-variant">
                    No proof file has been uploaded.
                  </p>
                )}
              </div>
              <div>
                <dl className="space-y-4">
                  <Info label="Customer" value={selected.customerName} />
                  <Info label="Booking" value={selected.bookingId} />
                  <Info
                    label="Amount"
                    value={formatPrice(selected.amount || 0, selected.currency)}
                  />
                  <Info label="Method" value={selected.method} />
                </dl>
                {canManage && (
                  <div className="mt-6 space-y-3">
                    {!rejecting && selected.status !== "PAID" && (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            await onApprove(selected);
                            setSelected(null);
                          }}
                          className="h-10 w-full rounded-md bg-primary px-4 text-sm font-bold text-white hover:bg-primary-container"
                        >
                          Approve payment
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejecting(true)}
                          className="h-10 w-full rounded-md border border-red-200 px-4 text-sm font-bold text-red-700 hover:bg-red-50"
                        >
                          Reject with reason
                        </button>
                      </>
                    )}
                    {rejecting && (
                      <form
                        onSubmit={async (event) => {
                          event.preventDefault();
                          await onReject(selected, reason);
                          setSelected(null);
                        }}
                      >
                        <label className="block text-sm font-semibold">
                          Required rejection reason
                          <textarea
                            autoFocus
                            required
                            minLength={5}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            rows={4}
                            className="mt-1.5 w-full resize-none rounded-md border border-outline bg-surface-container p-3 text-sm"
                          />
                        </label>
                        <button className="mt-3 h-10 w-full rounded-md bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-800">
                          Reject payment
                        </button>
                      </form>
                    )}
                    {selected.status === "PAID" && (
                      <label className="flex items-center justify-between rounded-md border border-outline p-3 text-sm font-semibold">
                        <span>
                          {selected.isReconciled
                            ? "Settlement reconciled"
                            : "Mark settlement reconciled"}
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(selected.isReconciled)}
                          onChange={() => onReconcile(selected)}
                          className="h-5 w-5 accent-primary"
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold">
        {value || "Not provided"}
      </dd>
    </div>
  );
}
