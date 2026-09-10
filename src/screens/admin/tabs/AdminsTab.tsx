import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";

interface AdminsTabProps {
  admins: any[];
  currentEmail?: string;
  onPromote: (
    uid: string,
    role:
      | "dispatcher"
      | "finance_admin"
      | "customer_support_agent"
      | "super_admin",
  ) => Promise<void>;
  onRevoke: (uid: string) => void;
}

export default function AdminsTab({
  admins,
  currentEmail,
  onPromote,
  onRevoke,
}: AdminsTabProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <section className="h-fit rounded-lg border border-outline bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
          Grant staff access
        </h2>
        <p className="mt-2 text-xs text-on-surface-variant">
          Assign the minimum role needed for the staff member's work.
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            await onPromote(
              String(form.get("uid")),
              String(form.get("role")) as any,
            );
            event.currentTarget.reset();
          }}
        >
          <label className="block text-sm font-semibold">
            Firebase user UID
            <input
              name="uid"
              required
              className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 font-mono text-sm"
            />
          </label>
          <label className="block text-sm font-semibold">
            Role
            <select
              name="role"
              defaultValue="dispatcher"
              className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
            >
              <option value="dispatcher">Dispatcher</option>
              <option value="finance_admin">Finance administrator</option>
              <option value="customer_support_agent">
                Customer support agent
              </option>
              <option value="super_admin">Super administrator</option>
            </select>
          </label>
          <button className="h-10 w-full rounded-md bg-primary px-4 text-sm font-bold text-white hover:bg-primary-container">
            Grant access
          </button>
        </form>
      </section>
      <section className="overflow-hidden rounded-lg border border-outline bg-white shadow-sm">
        <div className="border-b border-outline px-5 py-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
            Privileged accounts
          </h2>
        </div>
        <div className="divide-y divide-outline">
          <div className="flex items-center justify-between gap-4 bg-primary/5 px-5 py-4">
            <div>
              <p className="text-sm font-bold">
                {currentEmail || "Current administrator"}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Current authenticated session
              </p>
            </div>
            <StatusBadge status="Super Admin" />
          </div>
          {admins.map((admin) => (
            <div
              key={admin.id}
              className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-container/60"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-sm">
                  {admin.email || admin.id}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  UID: {admin.id}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <StatusBadge
                  status={String(admin.role || "dispatcher").replaceAll(
                    "_",
                    " ",
                  )}
                />
                <button
                  type="button"
                  onClick={() => onRevoke(admin.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-red-700 hover:bg-red-50"
                  aria-label={`Revoke ${admin.email || admin.id}`}
                >
                  <span className="material-symbols-outlined text-lg">
                    no_accounts
                  </span>
                </button>
              </div>
            </div>
          ))}
          {admins.length === 0 && (
            <EmptyState
              icon="admin_panel_settings"
              title="No additional administrators"
              description="Grant a least-privilege role when the first staff account is ready."
            />
          )}
        </div>
      </section>
    </div>
  );
}
