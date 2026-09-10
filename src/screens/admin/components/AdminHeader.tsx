import { AdminRole, AdminTab, adminSectionDetails } from "../types";

interface AdminHeaderProps {
  activeTab: AdminTab;
  role: AdminRole;
  onOpenNavigation: () => void;
  children?: React.ReactNode;
}

export default function AdminHeader({
  activeTab,
  role,
  onOpenNavigation,
  children,
}: AdminHeaderProps) {
  const section = adminSectionDetails[activeTab];
  return (
    <header className="sticky top-20 z-30 border-b border-outline bg-background/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={onOpenNavigation}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-outline bg-white lg:hidden"
            aria-label="Open admin navigation"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Admin / {section.title}
            </p>
            <h1 className="mt-1 text-xl font-bold leading-tight text-on-surface">
              {section.title}
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              {section.description}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {children}
          <span className="inline-flex h-9 items-center rounded-md border border-outline bg-white px-3 text-xs font-bold capitalize text-on-surface">
            {role.replaceAll("_", " ")}
          </span>
        </div>
      </div>
    </header>
  );
}
