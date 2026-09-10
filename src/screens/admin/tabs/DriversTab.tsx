import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";

export default function DriversTab({
  drivers,
  onOnboard,
}: {
  drivers: any[];
  onOnboard: (input: {
    authUid: string;
    name: string;
    license: string;
    phone: string;
  }) => Promise<void>;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <section className="h-fit rounded-lg border border-outline bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
          Register driver
        </h2>
        <p className="mt-2 text-xs text-on-surface-variant">
          Create the sign-in account in Firebase Authentication first, then link
          its UID here.
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            await onOnboard({
              authUid: String(form.get("authUid")),
              name: String(form.get("name")),
              license: String(form.get("license")),
              phone: String(form.get("phone")),
            });
            event.currentTarget.reset();
          }}
        >
          <label className="block text-sm font-semibold">
            Firebase user UID
            <input
              name="authUid"
              required
              className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 font-mono text-sm"
            />
          </label>
          <label className="block text-sm font-semibold">
            Full legal name
            <input
              name="name"
              required
              className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Licence reference
              <input
                name="license"
                required
                className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
              />
            </label>
            <label className="block text-sm font-semibold">
              Phone
              <input
                name="phone"
                type="tel"
                required
                className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
              />
            </label>
          </div>
          <button className="h-10 w-full rounded-md bg-primary px-4 text-sm font-bold text-white hover:bg-primary-container">
            Onboard driver
          </button>
        </form>
      </section>
      <section className="overflow-hidden rounded-lg border border-outline bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-outline px-5 py-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
            Fleet personnel
          </h2>
          <span className="text-xs font-semibold text-on-surface-variant">
            {drivers.length} drivers
          </span>
        </div>
        <div className="divide-y divide-outline">
          {drivers.map((driver) => (
            <div
              key={driver.id}
              className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-container/60"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-container font-bold">
                  {driver.name?.[0] || "?"}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{driver.name}</p>
                  <p className="truncate text-xs text-on-surface-variant">
                    Licence:{" "}
                    {driver.kyc?.licenseNumber || driver.license || "Pending"}
                  </p>
                </div>
              </div>
              <StatusBadge
                status={driver.availability?.state || driver.status}
              />
            </div>
          ))}
          {drivers.length === 0 && (
            <EmptyState
              icon="badge"
              title="No drivers onboarded"
              description="Link the first verified driver's Firebase account using this form."
            />
          )}
        </div>
      </section>
    </div>
  );
}
