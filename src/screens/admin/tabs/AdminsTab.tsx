import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import { roleLabel } from "../types";

type StaffRole = "dispatcher" | "finance_admin" | "customer_support_agent" | "super_admin";

const roleDescriptions: Record<StaffRole, string> = {
  dispatcher: "Bookings, drivers, pickup points, closed days and prices",
  finance_admin: "Payments, refunds, bank details and exchange rates",
  customer_support_agent: "Customer messages, bookings and reviews",
  super_admin: "Everything, including staff access"
};

export default function AdminsTab({
  admins,
  currentUid,
  onPromote,
  onRevoke,
}: {
  admins: any[];
  currentUid?: string;
  onPromote: (account: string, role: StaffRole) => Promise<void>;
  onRevoke: (uid: string, label: string) => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <section className="card h-fit p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">Give someone access</h2>
        <p className="mt-2 text-xs text-on-surface-variant">They need a BLM account first. Access starts next time they open the site.</p>
        <form
          className="mt-5 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const formElement = event.currentTarget;
            const form = new FormData(formElement);
            await onPromote(String(form.get("account")).trim(), String(form.get("role")) as StaffRole);
            formElement.reset();
          }}
        >
          <label className="block">
            <span className="field-label">Their email address</span>
            <input name="account" required className="field" placeholder="staff@blmmotors.ng" />
          </label>
          <fieldset>
            <legend className="field-label">Role</legend>
            <div className="space-y-2">
              {(Object.keys(roleDescriptions) as StaffRole[]).map((role, index) => (
                <label key={role} className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                  <input type="radio" name="role" value={role} defaultChecked={index === 0} className="mt-1 accent-[var(--color-primary)]" />
                  <span>
                    <span className="block text-sm font-bold">{roleLabel(role)}</span>
                    <span className="text-xs text-on-surface-variant">{roleDescriptions[role]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <button className="btn-primary w-full">Give access</button>
        </form>
      </section>
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-outline px-5 py-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">Staff</h2>
          <span className="text-xs font-semibold text-on-surface-variant">{admins.length}</span>
        </div>
        <div className="divide-y divide-outline">
          {admins.map((admin) => {
            const label = admin.email || admin.displayName || admin.id;
            const isSelf = admin.id === currentUid;
            return (
              <div key={admin.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-container/60">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{label}{isSelf && <span className="ml-2 text-xs font-bold text-primary">(you)</span>}</p>
                  <p className="mt-1 truncate font-mono text-xs text-on-surface-variant">{admin.id}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={roleLabel(admin.role)} />
                  {!isSelf && (
                    <button type="button" onClick={() => onRevoke(admin.id, label)} className="flex h-9 w-9 items-center justify-center rounded-md text-red-700 hover:bg-red-50" aria-label={`Revoke ${label}`}>
                      <span className="material-symbols-outlined text-lg">no_accounts</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {admins.length === 0 && <EmptyState icon="admin_panel_settings" title="No staff yet" description="Give access to your first team member." />}
        </div>
      </section>
    </div>
  );
}
