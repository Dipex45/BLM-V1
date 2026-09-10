export type AdminTab =
  | "bookings"
  | "payments"
  | "support"
  | "prices"
  | "settings"
  | "hubs"
  | "schedules"
  | "admins"
  | "drivers"
  | "analytics"
  | "reviews"
  | "maintenance";

export type AdminRole =
  | "admin"
  | "super_admin"
  | "dispatcher"
  | "finance_admin"
  | "customer_support_agent";

export const adminSectionDetails: Record<
  AdminTab,
  { title: string; description: string }
> = {
  bookings: {
    title: "Bookings",
    description: "Dispatch, assignment, route, and tracking operations.",
  },
  payments: {
    title: "Payments",
    description:
      "Verification, reconciliation, refunds, and transaction evidence.",
  },
  support: {
    title: "Support",
    description: "Customer conversations, escalation, and resolution tracking.",
  },
  drivers: {
    title: "Drivers",
    description: "Driver identity, availability, and portal access.",
  },
  prices: {
    title: "Pricing",
    description: "Vehicle classes and authoritative base pricing.",
  },
  hubs: {
    title: "Hubs",
    description: "Customer-selectable pickup and operating locations.",
  },
  schedules: {
    title: "Schedules",
    description: "Blocked dates and service availability.",
  },
  settings: {
    title: "Configuration",
    description: "Tours, fleet, rates, providers, tracking, and bank details.",
  },
  admins: {
    title: "Administrators",
    description: "Role assignment and privileged access.",
  },
  analytics: {
    title: "Analytics",
    description: "Revenue, booking status, and operating performance.",
  },
  reviews: {
    title: "Reviews",
    description: "Verified customer feedback and service quality.",
  },
  maintenance: {
    title: "System health",
    description: "Diagnostics, data integrity, and retention operations.",
  },
};
