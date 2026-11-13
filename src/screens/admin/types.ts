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

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Full access",
  admin: "Full access",
  dispatcher: "Bookings & drivers",
  finance_admin: "Payments",
  customer_support_agent: "Customer help",
  driver: "Driver",
  customer: "Customer",
};

/** Friendly name for a staff role. */
export const roleLabel = (role?: string) => (role ? ROLE_LABELS[role] || role.replaceAll("_", " ") : "");

const DRIVER_STATES: Record<string, string> = {
  approved: "Approved",
  pending_review: "Waiting for approval",
  suspended: "Suspended",
  rejected: "Declined",
};

export const driverStateLabel = (state?: string) => (state ? DRIVER_STATES[state] || state : "Waiting for approval");

export const adminSectionDetails: Record<
  AdminTab,
  { title: string; description: string }
> = {
  bookings: {
    title: "Bookings",
    description: "See every booking, assign drivers and post trip updates.",
  },
  payments: {
    title: "Payments",
    description:
      "Check payments, confirm bank transfers and give refunds.",
  },
  support: {
    title: "Support",
    description: "Read and reply to customer messages.",
  },
  drivers: {
    title: "Drivers",
    description: "Add drivers, approve them and see who is available.",
  },
  prices: {
    title: "Pricing",
    description: "Set the cars customers can choose and what they cost.",
  },
  hubs: {
    title: "Pickup points",
    description: "Places where customers can collect hire cars.",
  },
  schedules: {
    title: "Closed days",
    description: "Days when customers can’t book.",
  },
  settings: {
    title: "Settings",
    description: "Prices, tours, hire cars, exchange rates, bank details and payment options.",
  },
  admins: {
    title: "Staff access",
    description: "Choose who can use the admin panel and what they can do.",
  },
  analytics: {
    title: "Reports",
    description: "Money earned and how bookings are going.",
  },
  reviews: {
    title: "Reviews",
    description: "Read customer reviews and hide any that break the rules.",
  },
  maintenance: {
    title: "System check",
    description: "Check for problems and tidy up old records.",
  },
};
