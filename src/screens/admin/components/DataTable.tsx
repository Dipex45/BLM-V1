import { ReactNode } from "react";

export default function DataTable({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className="min-w-[840px] w-full border-collapse text-left text-sm"
        aria-label={label}
      >
        {children}
      </table>
    </div>
  );
}

export const tableHeaderClass =
  "border-b border-outline bg-surface-container/60 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant";
export const tableCellClass =
  "border-b border-outline px-5 py-3.5 align-middle text-sm";
