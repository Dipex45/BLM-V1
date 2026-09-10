import { AnimatePresence, motion } from "framer-motion";
import { AdminRole, AdminTab } from "../types";

type NavItem = {
  tab: AdminTab;
  label: string;
  icon: string;
  roles: AdminRole[];
};

const allRoles: AdminRole[] = [
  "admin",
  "super_admin",
  "dispatcher",
  "finance_admin",
  "customer_support_agent",
];
const operations: NavItem[] = [
  { tab: "bookings", label: "Bookings", icon: "route", roles: allRoles },
  {
    tab: "payments",
    label: "Payments",
    icon: "payments",
    roles: ["admin", "super_admin", "finance_admin", "customer_support_agent"],
  },
  {
    tab: "support",
    label: "Support",
    icon: "support_agent",
    roles: ["admin", "super_admin", "customer_support_agent"],
  },
  {
    tab: "drivers",
    label: "Drivers",
    icon: "badge",
    roles: ["admin", "super_admin", "dispatcher"],
  },
];
const commercial: NavItem[] = [
  {
    tab: "prices",
    label: "Pricing",
    icon: "price_change",
    roles: ["admin", "super_admin", "dispatcher", "finance_admin"],
  },
  {
    tab: "hubs",
    label: "Hubs",
    icon: "hub",
    roles: ["admin", "super_admin", "dispatcher"],
  },
  {
    tab: "schedules",
    label: "Schedules",
    icon: "event_busy",
    roles: ["admin", "super_admin", "dispatcher"],
  },
];
const configuration: NavItem[] = [
  {
    tab: "settings",
    label: "Settings",
    icon: "tune",
    roles: ["admin", "super_admin", "dispatcher", "finance_admin"],
  },
  {
    tab: "admins",
    label: "Roles",
    icon: "admin_panel_settings",
    roles: ["admin", "super_admin"],
  },
];
const insights: NavItem[] = [
  {
    tab: "analytics",
    label: "Analytics",
    icon: "monitoring",
    roles: ["admin", "super_admin", "dispatcher", "finance_admin"],
  },
  { tab: "reviews", label: "Reviews", icon: "reviews", roles: allRoles },
  {
    tab: "maintenance",
    label: "System health",
    icon: "health_and_safety",
    roles: ["admin", "super_admin"],
  },
];

const groups = [
  { label: "Operations", items: operations },
  { label: "Commercial", items: commercial },
  { label: "Configuration", items: configuration },
  { label: "Insights", items: insights },
];

interface AdminSidebarProps {
  activeTab: AdminTab;
  role: AdminRole;
  mobileOpen: boolean;
  onChange: (tab: AdminTab) => void;
  onClose: () => void;
}

function SidebarContent({
  activeTab,
  role,
  onChange,
  onClose,
}: Omit<AdminSidebarProps, "mobileOpen">) {
  return (
    <div className="flex h-full flex-col bg-[#151719] text-white">
      <div className="border-b border-white/10 px-5 py-5">
        <p className="text-sm font-bold">Operations Console</p>
        <p className="mt-1 text-xs text-white/60">BLM Motors</p>
      </div>
      <nav
        className="flex-1 overflow-y-auto px-3 py-4"
        aria-label="Admin sections"
      >
        {groups.map((group) => {
          const visibleItems = group.items.filter((item) =>
            item.roles.includes(role),
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label} className="mb-5">
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-white/45">
                {group.label}
              </p>
              <div className="space-y-1">
                {visibleItems.map((item) => (
                  <button
                    key={item.tab}
                    type="button"
                    onClick={() => {
                      onChange(item.tab);
                      onClose();
                    }}
                    className={`flex h-10 w-full items-center gap-3 rounded-md border-l-2 px-3 text-left text-sm font-semibold transition-colors ${activeTab === item.tab ? "border-primary bg-white/10 text-white" : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"}`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-4 text-xs text-white/55">
        Role: {role.replaceAll("_", " ")}
      </div>
    </div>
  );
}

export default function AdminSidebar(props: AdminSidebarProps) {
  return (
    <>
      <aside className="fixed bottom-0 left-0 top-20 z-40 hidden w-64 lg:block">
        <SidebarContent {...props} />
      </aside>
      <AnimatePresence>
        {props.mobileOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close admin navigation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={props.onClose}
              className="fixed inset-0 z-[70] bg-black/50 lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="fixed bottom-0 left-0 top-0 z-[80] w-72 shadow-2xl lg:hidden"
            >
              <SidebarContent {...props} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
