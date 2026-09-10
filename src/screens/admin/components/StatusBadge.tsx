const statusStyles: Record<string, string> = {
  quoted: "bg-gray-100 text-gray-700 ring-gray-200",
  awaiting_payment: "bg-gray-100 text-gray-700 ring-gray-200",
  booked: "bg-blue-50 text-blue-700 ring-blue-200",
  paid: "bg-blue-50 text-blue-700 ring-blue-200",
  confirmed: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  dispatched: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  intransit: "bg-amber-50 text-amber-800 ring-amber-200",
  under_review: "bg-orange-50 text-orange-800 ring-orange-200",
  payment_submitted: "bg-orange-50 text-orange-800 ring-orange-200",
  completed: "bg-green-50 text-green-700 ring-green-200",
  reconciled: "bg-green-50 text-green-700 ring-green-200",
  cancelled: "bg-red-50 text-red-700 ring-red-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  payment_rejected: "bg-red-50 text-red-700 ring-red-200",
};

export default function StatusBadge({ status }: { status?: string }) {
  const value = status || "Unknown";
  const key = value.toLowerCase().replace(/[\s-]+/g, "_");
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[key] || "bg-gray-100 text-gray-700 ring-gray-200"}`}
    >
      {value}
    </span>
  );
}
