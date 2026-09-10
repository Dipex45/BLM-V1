import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import EmptyState from "../components/EmptyState";
import KPICard from "../components/KPICard";

export default function AnalyticsTab({
  bookings,
  formatPrice,
}: {
  bookings: any[];
  formatPrice: (amount: number, currency?: any) => string;
}) {
  const [range, setRange] = useState("30");
  const data = useMemo(() => {
    const cutoff =
      range === "all" ? null : new Date(Date.now() - Number(range) * 86400000);
    const filtered = bookings.filter((booking) => {
      if (!cutoff) return true;
      const value =
        booking.createdAt?.toDate?.() ||
        new Date(booking.createdAt || booking.date || 0);
      return value >= cutoff;
    });
    const billable = filtered.filter((booking) =>
      [
        "Booked",
        "Paid",
        "Confirmed",
        "Dispatched",
        "InTransit",
        "Completed",
      ].includes(booking.status),
    );
    const revenueByVehicle: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    const dailyRevenue: Record<string, number> = {};
    filtered.forEach((booking) => {
      statusCounts[booking.status || "Unknown"] =
        (statusCounts[booking.status || "Unknown"] || 0) + 1;
      if (billable.includes(booking)) {
        revenueByVehicle[booking.vehicleClass || "Other"] =
          (revenueByVehicle[booking.vehicleClass || "Other"] || 0) +
          Number(booking.totalAmount || 0);
        const date = booking.date || "Unscheduled";
        dailyRevenue[date] =
          (dailyRevenue[date] || 0) + Number(booking.totalAmount || 0);
      }
    });
    return {
      filtered,
      totalRevenue: billable.reduce(
        (sum, booking) => sum + Number(booking.totalAmount || 0),
        0,
      ),
      active: filtered.filter((booking) =>
        ["Paid", "Confirmed", "Dispatched", "InTransit"].includes(
          booking.status,
        ),
      ).length,
      completed: filtered.filter((booking) => booking.status === "Completed")
        .length,
      cancelled: filtered.filter((booking) => booking.status === "Cancelled")
        .length,
      revenueByVehicle: Object.entries(revenueByVehicle).map(
        ([name, value]) => ({ name, value }),
      ),
      statusCounts: Object.entries(statusCounts).map(([name, value]) => ({
        name,
        value,
      })),
      dailyRevenue: Object.entries(dailyRevenue)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }, [bookings, range]);
  const colours = [
    "#c1121f",
    "#1d4ed8",
    "#15803d",
    "#b45309",
    "#6d28d9",
    "#52585d",
  ];

  return (
    <>
      <div className="mb-5 flex justify-end">
        <label className="text-xs font-semibold text-on-surface-variant">
          Date range
          <select
            value={range}
            onChange={(event) => setRange(event.target.value)}
            className="mt-1 block h-10 rounded-md border border-outline bg-white px-3 text-sm text-on-surface"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          label="Total revenue"
          value={formatPrice(data.totalRevenue)}
          icon="payments"
          tone="green"
        />
        <KPICard
          label="Active bookings"
          value={data.active}
          icon="local_shipping"
          tone="blue"
        />
        <KPICard
          label="Completed"
          value={data.completed}
          icon="task_alt"
          tone="green"
        />
        <KPICard
          label="Cancelled"
          value={data.cancelled}
          icon="cancel"
          tone="red"
        />
      </div>
      {!data.filtered.length ? (
        <div className="mt-6 rounded-lg border border-outline bg-white">
          <EmptyState
            icon="monitoring"
            title="No analytics data"
            description="No bookings fall within the selected date range."
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Chart title="Revenue trend">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => formatPrice(Number(value || 0))}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#c1121f"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Chart>
          <Chart title="Booking status">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data.statusCounts}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={95}
                >
                  {data.statusCounts.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={colours[index % colours.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Chart>
          <div className="xl:col-span-2">
            <Chart title="Revenue by vehicle class">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.revenueByVehicle}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => formatPrice(Number(value || 0))}
                  />
                  <Bar dataKey="value" fill="#c1121f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Chart>
          </div>
        </div>
      )}
    </>
  );
}

function Chart({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-outline bg-white p-5 shadow-sm">
      <h2 className="mb-5 text-sm font-bold uppercase tracking-wider text-on-surface-variant">
        {title}
      </h2>
      {children}
    </section>
  );
}
