import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import { driverStateLabel } from "../types";

type DriverState = "approved" | "suspended" | "rejected" | "pending_review";

export default function DriversTab({
  drivers,
  canManage,
  onOnboard,
  onStatus,
}: {
  drivers: any[];
  canManage: boolean;
  onOnboard: (input: { account: string; name: string; license: string; phone: string }) => Promise<void>;
  onStatus: (driver: any, state: DriverState) => Promise<void>;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
      {canManage && (
        <section className="card h-fit p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">Add a driver</h2>
          <p className="mt-2 text-xs text-on-surface-variant">The driver signs up on the website first. Add them here, then press Approve.</p>
          <form
            className="mt-5 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const formElement = event.currentTarget;
              const form = new FormData(formElement);
              await onOnboard({
                account: String(form.get("account")).trim(),
                name: String(form.get("name")).trim(),
                license: String(form.get("license")).trim(),
                phone: String(form.get("phone")).trim(),
              });
              formElement.reset();
            }}
          >
            <label className="block"><span className="field-label">Their email address</span><input name="account" required className="field" placeholder="driver@email.com" /></label>
            <label className="block"><span className="field-label">Full name</span><input name="name" required minLength={2} className="field" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="field-label">Licence number</span><input name="license" required minLength={3} className="field" /></label>
              <label className="block"><span className="field-label">Phone</span><input name="phone" type="tel" required minLength={5} className="field" /></label>
            </div>
            <button className="btn-primary w-full">Add driver</button>
          </form>
        </section>
      )}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-outline px-5 py-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">Drivers</h2>
          <span className="text-xs font-semibold text-on-surface-variant">{drivers.length}</span>
        </div>
        <div className="divide-y divide-outline">
          {drivers.map((driver) => {
            const state: string = driver.onboarding?.state || "pending_review";
            return (
              <div key={driver.id} className="flex flex-col gap-3 px-5 py-4 hover:bg-surface-container/60 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft font-bold text-primary">{driver.name?.[0] || "?"}</div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{driver.name}</p>
                    <p className="truncate text-xs text-on-surface-variant">{driver.email || "No email"} · {driver.phone} · Licence {driver.kyc?.licenseNumber || "—"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={driverStateLabel(state)} />
                  <StatusBadge status={driver.availability?.state === "available" ? "Available" : driver.availability?.state === "assigned" ? "On a trip" : "Offline"} />
                  {canManage && state !== "approved" && (
                    <button type="button" onClick={() => onStatus(driver, "approved")} className="h-8 rounded-md bg-green-700 px-3 text-xs font-bold text-white hover:bg-green-800">Approve</button>
                  )}
                  {canManage && state === "approved" && (
                    <button type="button" onClick={() => onStatus(driver, "suspended")} className="h-8 rounded-md border border-red-200 px-3 text-xs font-bold text-red-700 hover:bg-red-50">Suspend</button>
                  )}
                  {canManage && state === "pending_review" && (
                    <button type="button" onClick={() => onStatus(driver, "rejected")} className="h-8 rounded-md border border-outline px-3 text-xs font-bold hover:bg-surface-container">Reject</button>
                  )}
                </div>
              </div>
            );
          })}
          {drivers.length === 0 && <EmptyState icon="badge" title="No drivers yet" description="Add your first driver using the form." />}
        </div>
      </section>
    </div>
  );
}
