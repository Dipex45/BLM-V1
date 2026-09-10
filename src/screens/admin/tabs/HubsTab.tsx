import EmptyState from "../components/EmptyState";

interface HubsTabProps {
  hubs: any[];
  onAdd: (name: string, address: string) => Promise<void>;
  onDelete: (id: string, name: string) => void;
}

export default function HubsTab({ hubs, onAdd, onDelete }: HubsTabProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <section className="h-fit rounded-lg border border-outline bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
          Add operating hub
        </h2>
        <form
          className="mt-5 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            await onAdd(
              String(form.get("name") || ""),
              String(form.get("address") || ""),
            );
            event.currentTarget.reset();
          }}
        >
          <label className="block text-sm font-semibold">
            Hub name
            <input
              name="name"
              required
              className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
              placeholder="Lagos - Ikeja Terminal"
            />
          </label>
          <label className="block text-sm font-semibold">
            Physical address
            <input
              name="address"
              required
              className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
              placeholder="Full operating address"
            />
          </label>
          <button className="h-10 w-full rounded-md bg-primary px-4 text-sm font-bold text-white hover:bg-primary-container">
            Add hub
          </button>
        </form>
      </section>
      <section className="overflow-hidden rounded-lg border border-outline bg-white shadow-sm">
        <div className="border-b border-outline px-5 py-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
            Active hub network
          </h2>
        </div>
        <div className="divide-y divide-outline">
          {hubs.map((hub) => (
            <div
              key={hub.id}
              className="group flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-container/60"
            >
              <div>
                <p className="text-sm font-bold">{hub.name}</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {hub.address}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(hub.id, hub.name)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-red-700 hover:bg-red-50"
                aria-label={`Delete ${hub.name}`}
              >
                <span className="material-symbols-outlined text-lg">
                  delete
                </span>
              </button>
            </div>
          ))}
          {hubs.length === 0 && (
            <EmptyState
              icon="hub"
              title="No hubs configured"
              description="Add the first customer-selectable pickup hub using this form."
            />
          )}
        </div>
      </section>
    </div>
  );
}
