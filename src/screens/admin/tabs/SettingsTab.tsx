import { useEffect, useMemo, useState } from "react";
import { BankAccountConfig } from "../../../lib/payments/types";

type Props = {
  canFinance: boolean;
  canOperations: boolean;
  pricingRules: Record<string, number>;
  touringPackages: any[];
  touringStates: any[];
  internationalTours: any[];
  carHireOptions: any[];
  trackingLocations: string[];
  routes: string[];
  bankConfig: BankAccountConfig;
  featureFlags: Record<string, boolean>;
  currencyRates: Record<string, number>;
  onSave: (key: string, value: unknown) => Promise<void>;
  onUploadCarImage: (file: File) => Promise<string>;
};

const sections = [
  ["pricing", "Fees and charges", "calculate"],
  ["packages", "Tour packages", "tour"],
  ["states", "Tour states", "map"],
  ["international", "Countries", "public"],
  ["fleet", "Hire cars", "car_rental"],
  ["routes", "Routes we cover", "alt_route"],
  ["tracking", "Trip update places", "pin_drop"],
  ["currency", "Exchange rates", "currency_exchange"],
  ["bank", "Bank account", "account_balance"],
  ["providers", "Payment and message options", "toggle_on"],
] as const;

export default function SettingsTab(props: Props) {
  const available = sections
    .filter(
      ([id]) =>
        props.canFinance || !["currency", "bank", "providers"].includes(id),
    )
    .filter(
      ([id]) =>
        props.canOperations || ["currency", "bank", "providers"].includes(id),
    );
  const [active, setActive] = useState<string>(available[0]?.[0] || "pricing");
  useEffect(() => {
    if (!available.some(([id]) => id === active))
      setActive(available[0]?.[0] || "pricing");
  }, [active, available]);
  return (
    <div className="grid gap-6 xl:grid-cols-[240px_1fr]">
      <nav
        className="h-fit rounded-lg border border-outline bg-white p-2 shadow-sm"
        aria-label="Configuration sections"
      >
        {available.map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            className={`flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold ${active === id ? "bg-primary/10 text-primary" : "hover:bg-surface-container"}`}
          >
            <span className="material-symbols-outlined text-lg">{icon}</span>
            {label}
          </button>
        ))}
      </nav>
      <div className="min-w-0">
        {active === "pricing" && (
          <PricingRules
            values={props.pricingRules}
            onSave={(value) => props.onSave("pricing_rules", value)}
          />
        )}
        {active === "packages" && (
          <ObjectList
            title="Tour packages"
            description="The tours customers can choose from."
            items={props.touringPackages}
            fields={[
              ["title", "Package name", "text"],
              ["locations", "Number of stops", "number"],
              ["days", "Number of days", "number"],
              ["price", "Price (₦)", "number"],
              ["desc", "Description", "text"],
            ]}
            newItem={{
              id: `tour-${Date.now()}`,
              title: "New tour package",
              locations: 2,
              days: 1,
              price: 90000,
              desc: "",
            }}
            onSave={(value) => props.onSave("touring_packages", value)}
          />
        )}
        {active === "states" && (
          <ObjectList
            title="Tour states"
            description="Each state’s price multiplier. 1 = normal price, 1.2 = 20% more."
            items={props.touringStates}
            fields={[
              ["name", "State", "text"],
              ["factor", "Price multiplier (1 = normal)", "number"],
            ]}
            newItem={{ name: "New state", factor: 1 }}
            onSave={(value) => props.onSave("touring_states", value)}
          />
        )}
        {active === "international" && (
          <ObjectList
            title="Countries"
            description="Countries for cross-border trips and their price multiplier. 1.1 = 10% more."
            items={props.internationalTours}
            fields={[
              ["name", "Country", "text"],
              ["factor", "Price multiplier (1 = normal)", "number"],
            ]}
            newItem={{ name: "New country", factor: 1.1 }}
            onSave={(value) => props.onSave("international_tours", value)}
          />
        )}
        {active === "fleet" && (
          <FleetEditor
            items={props.carHireOptions}
            onSave={(value) => props.onSave("car_hire_options", value)}
            onUpload={props.onUploadCarImage}
          />
        )}
        {active === "tracking" && (
          <StringList
            title="Trip update places"
            description="Place names staff can pick quickly when posting a trip update."
            items={props.trackingLocations}
            onSave={(value) => props.onSave("tracking_locations", value)}
          />
        )}
        {active === "routes" && (
          <StringList
            title="Routes we cover"
            description="Shown on the home page, services page and at the bottom of every page."
            items={props.routes}
            onSave={(value) => props.onSave("routes", value)}
          />
        )}
        {active === "currency" && (
          <CurrencyEditor
            values={props.currencyRates}
            onSave={(value) => props.onSave("currency_rates", value)}
          />
        )}
        {active === "bank" && (
          <BankEditor
            value={props.bankConfig}
            onSave={(value) => props.onSave("bank_accounts", value)}
          />
        )}
        {active === "providers" && (
          <ProviderEditor
            values={props.featureFlags}
            onSave={(value) => props.onSave("feature_flags", value)}
          />
        )}
      </div>
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-outline bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">
        {description}
      </p>
      {children}
    </section>
  );
}

function PricingRules({
  values,
  onSave,
}: {
  values: Record<string, number>;
  onSave: (value: Record<string, number>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(values);
  useEffect(() => setDraft(values), [values]);
  const labels: Record<string, string> = {
    pricePerKm: "Price per km (if a car has no price set)",
    logisticsPricePerKm: "Delivery price per km",
    standardServiceFee: "Booking fee (rides)",
    touringPerLocation: "Tour price per stop (if a tour has no price)",
    internationalTourPerLocation: "Cross-border price per stop",
    pickupLogisticsFee: "Delivery handling fee",
    pricePerKg: "Delivery price per kg",
    carHireCautionFee: "Car hire refundable deposit",
    crossBorderProcessingFee: "Border help fee",
    crossBorderBasePerPassenger: "Cross-border price per passenger",
    defaultRouteFactor: "Default price multiplier",
    returnMultiplier: "Return trip multiplier (2 = double)",
    maxTouringLocations: "Most stops allowed on a tour",
  };
  return (
    <Card
      title="Fees and charges"
      description="Used to work out prices for new bookings. Existing bookings keep their price."
    >
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {Object.entries(draft).map(([key, value]) => (
          <label key={key} className="text-sm font-semibold">
            {labels[key] || key}
            <input
              type="number"
              step="any"
              min="0"
              value={value}
              onChange={(event) =>
                setDraft({ ...draft, [key]: Number(event.target.value) })
              }
              className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
            />
          </label>
        ))}
      </div>
      <SaveBar
        changed={JSON.stringify(draft) !== JSON.stringify(values)}
        onSave={() => onSave(draft)}
      />
    </Card>
  );
}

type Field = readonly [string, string, "text" | "number"];
function ObjectList({
  title,
  description,
  items,
  fields,
  newItem,
  onSave,
}: {
  title: string;
  description: string;
  items: any[];
  fields: readonly Field[];
  newItem: any;
  onSave: (value: any[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<any[]>(items);
  useEffect(() => setDraft(items), [items]);
  return (
    <Card title={title} description={description}>
      <div className="mt-5 space-y-4">
        {draft.map((item, index) => (
          <div
            key={item.id || `${item.name}-${index}`}
            className="rounded-lg border border-outline bg-surface-container/30 p-4"
          >
            <div className="grid gap-3 md:grid-cols-2">
              {fields.map(([key, label, type]) => (
                <label
                  key={key}
                  className={`text-sm font-semibold ${key === "desc" ? "md:col-span-2" : ""}`}
                >
                  {label}
                  <input
                    type={type}
                    step={type === "number" ? "any" : undefined}
                    value={item[key] ?? ""}
                    onChange={(event) =>
                      setDraft((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...row,
                                [key]:
                                  type === "number"
                                    ? Number(event.target.value)
                                    : event.target.value,
                              }
                            : row,
                        ),
                      )
                    }
                    className="mt-1.5 h-10 w-full rounded-md border border-outline bg-white px-3 text-sm"
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setDraft((current) =>
                  current.filter((_, rowIndex) => rowIndex !== index),
                )
              }
              className="mt-3 inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm font-bold text-red-700 hover:bg-red-50"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          setDraft((current) => [
            ...current,
            {
              ...newItem,
              id: newItem.id ? `${newItem.id}-${current.length}` : undefined,
            },
          ])
        }
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-outline px-4 text-sm font-bold hover:border-primary hover:text-primary"
      >
        <span className="material-symbols-outlined text-lg">add</span>Add
      </button>
      <SaveBar
        changed={JSON.stringify(draft) !== JSON.stringify(items)}
        onSave={() => onSave(draft)}
      />
    </Card>
  );
}

function StringList({
  title,
  description,
  items,
  onSave,
}: {
  title: string;
  description: string;
  items: string[];
  onSave: (value: string[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState(items);
  useEffect(() => setDraft(items), [items]);
  return (
    <Card title={title} description={description}>
      <div className="mt-5 space-y-3">
        {draft.map((item, index) => (
          <div key={`${item}-${index}`} className="flex gap-2">
            <input
              value={item}
              onChange={(event) =>
                setDraft((current) =>
                  current.map((row, rowIndex) =>
                    rowIndex === index ? event.target.value : row,
                  ),
                )
              }
              className="h-11 min-w-0 flex-1 rounded-md border border-outline bg-surface-container px-3 text-sm"
            />
            <button
              type="button"
              onClick={() =>
                setDraft((current) =>
                  current.filter((_, rowIndex) => rowIndex !== index),
                )
              }
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-red-700 hover:bg-red-50"
              aria-label={`Remove ${item}`}
            >
              <span className="material-symbols-outlined">delete</span>
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setDraft((current) => [...current, "New place"])}
        className="mt-4 h-10 rounded-md border border-outline px-4 text-sm font-bold hover:border-primary hover:text-primary"
      >
        + Add place
      </button>
      <SaveBar
        changed={JSON.stringify(draft) !== JSON.stringify(items)}
        onSave={() => onSave(draft.filter(Boolean))}
      />
    </Card>
  );
}

function FleetEditor({
  items,
  onSave,
  onUpload,
}: {
  items: any[];
  onSave: (value: any[]) => Promise<void>;
  onUpload: (file: File) => Promise<string>;
}) {
  const [draft, setDraft] = useState(items);
  useEffect(() => setDraft(items), [items]);
  return (
    <Card
      title="Hire cars"
      description="The cars customers can hire: photo, seats, daily price and whether they’re available."
    >
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {draft.map((car, index) => (
          <article
            key={car.id || index}
            className="overflow-hidden rounded-lg border border-outline"
          >
            <div className="aspect-[16/9] bg-surface-container">
              {car.image ? (
                <img
                  src={car.image}
                  alt={car.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl">
                    directions_car
                  </span>
                </div>
              )}
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Vehicle name
                <input
                  value={car.name || ""}
                  onChange={(event) =>
                    setDraft((current) =>
                      current.map((row, i) =>
                        i === index
                          ? { ...row, name: event.target.value }
                          : row,
                      ),
                    )
                  }
                  className="mt-1 h-10 w-full rounded-md border border-outline px-3 text-sm"
                />
              </label>
              <label className="text-sm font-semibold">
                Seats
                <input
                  type="number"
                  min="1"
                  value={car.seats || 4}
                  onChange={(event) =>
                    setDraft((current) =>
                      current.map((row, i) =>
                        i === index
                          ? { ...row, seats: Number(event.target.value) }
                          : row,
                      ),
                    )
                  }
                  className="mt-1 h-10 w-full rounded-md border border-outline px-3 text-sm"
                />
              </label>
              <label className="text-sm font-semibold">
                Daily price (NGN)
                <input
                  type="number"
                  min="0"
                  value={car.pricePerDay || 0}
                  onChange={(event) =>
                    setDraft((current) =>
                      current.map((row, i) =>
                        i === index
                          ? { ...row, pricePerDay: Number(event.target.value) }
                          : row,
                      ),
                    )
                  }
                  className="mt-1 h-10 w-full rounded-md border border-outline px-3 text-sm"
                />
              </label>
              <label className="text-sm font-semibold">
                Availability
                <select
                  value={car.available === false ? "unavailable" : "available"}
                  onChange={(event) =>
                    setDraft((current) =>
                      current.map((row, i) =>
                        i === index
                          ? {
                              ...row,
                              available: event.target.value === "available",
                            }
                          : row,
                      ),
                    )
                  }
                  className="mt-1 h-10 w-full rounded-md border border-outline px-3 text-sm"
                >
                  <option value="available">Available</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </label>
              <label className="text-sm font-semibold sm:col-span-2">
                Image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const image = await onUpload(file);
                    setDraft((current) =>
                      current.map((row, i) =>
                        i === index ? { ...row, image } : row,
                      ),
                    );
                  }}
                  className="mt-1 block w-full text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setDraft((current) => current.filter((_, i) => i !== index))
                }
                className="h-9 text-left text-sm font-bold text-red-700 sm:col-span-2"
              >
                Remove vehicle
              </button>
            </div>
          </article>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          setDraft((current) => [
            ...current,
            {
              id: `vehicle-${Date.now()}`,
              name: "New vehicle",
              seats: 4,
              pricePerDay: 70000,
              available: true,
              desc: "",
              image: "",
            },
          ])
        }
        className="mt-4 h-10 rounded-md border border-outline px-4 text-sm font-bold hover:border-primary hover:text-primary"
      >
        + Add car
      </button>
      <SaveBar
        changed={JSON.stringify(draft) !== JSON.stringify(items)}
        onSave={() => onSave(draft)}
      />
    </Card>
  );
}

function CurrencyEditor({
  values,
  onSave,
}: {
  values: Record<string, number>;
  onSave: (value: Record<string, number>) => Promise<void>;
}) {
  const supported = useMemo(() => ({ NGN: 1, ...values }), [values]);
  const [draft, setDraft] = useState(supported);
  useEffect(() => setDraft(supported), [supported]);
  return (
    <Card
      title="Exchange rates"
      description="How much ₦1 is worth in each currency. Customers see and pay with these exact rates."
    >
      <button
        type="button"
        onClick={async () => {
          const response = await fetch("https://open.er-api.com/v6/latest/NGN");
          const body = await response.json();
          if (body?.result !== "success") throw new Error("Market rates are unavailable right now");
          setDraft((current) => Object.fromEntries(Object.keys(current).map((code) => [code, code === "NGN" ? 1 : Number(body.rates?.[code]) || current[code as keyof typeof current]])) as typeof current);
        }}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-outline px-3 text-xs font-bold hover:border-primary hover:text-primary"
      >
        <span className="material-symbols-outlined text-base">sync</span>
        Get today’s rates (check them, then save)
      </button>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {Object.entries(draft).map(([code, rate]) => (
          <label key={code} className="text-sm font-semibold">
            1 NGN in {code}
            <input
              type="number"
              step="0.000001"
              min="0"
              disabled={code === "NGN"}
              value={rate}
              onChange={(event) =>
                setDraft({ ...draft, [code]: Number(event.target.value) })
              }
              className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 text-sm disabled:opacity-60"
            />
          </label>
        ))}
      </div>
      <SaveBar
        changed={JSON.stringify(draft) !== JSON.stringify(supported)}
        onSave={() => onSave(draft)}
      />
    </Card>
  );
}

function BankEditor({
  value,
  onSave,
}: {
  value: BankAccountConfig;
  onSave: (value: BankAccountConfig) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const fields: [keyof BankAccountConfig, string, string][] = [
    ["bankName", "Bank name", "text"],
    ["accountName", "Account name", "text"],
    ["accountNumber", "Account number", "text"],
    ["branchName", "Branch", "text"],
    ["contactPhone", "Support phone", "tel"],
    ["contactEmail", "Support email", "email"],
    ["deadlineHours", "Hours customers have to pay", "number"],
    ["instructions", "Instructions for customers", "text"],
  ];
  return (
    <Card
      title="Bank account"
      description="Shown to customers who choose to pay by bank transfer."
    >
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {fields.map(([key, label, type]) => (
          <label
            key={key}
            className={`text-sm font-semibold ${key === "instructions" ? "sm:col-span-2" : ""}`}
          >
            {label}
            <input
              type={type}
              value={String(draft[key] ?? "")}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  [key]:
                    type === "number"
                      ? Number(event.target.value)
                      : event.target.value,
                })
              }
              className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
            />
          </label>
        ))}
      </div>
      <SaveBar
        changed={JSON.stringify(draft) !== JSON.stringify(value)}
        onSave={() => onSave(draft)}
      />
    </Card>
  );
}

function ProviderEditor({
  values,
  onSave,
}: {
  values: Record<string, boolean>;
  onSave: (value: Record<string, boolean>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(values);
  useEffect(() => setDraft(values), [values]);
  return (
    <Card
      title="Payment and message options"
      description="Turn an option on only after it has been fully set up and tested."
    >
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {Object.entries(draft).map(([key, enabled]) => (
          <label
            key={key}
            className="flex min-h-14 items-center justify-between gap-4 rounded-lg border border-outline bg-surface-container/30 px-4 text-sm font-semibold"
          >
            <span>{({ paystack: "Paystack payments", stripe: "Card payments (Stripe)", manualBankTransfer: "Bank transfer", liveTracking: "Live map tracking", whatsappNotifications: "WhatsApp messages", smsNotifications: "SMS messages", french: "French language" } as Record<string, string>)[key] || key}</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) =>
                setDraft({ ...draft, [key]: event.target.checked })
              }
              className="h-5 w-5 accent-primary"
            />
          </label>
        ))}
      </div>
      <SaveBar
        changed={JSON.stringify(draft) !== JSON.stringify(values)}
        onSave={() => onSave(draft)}
      />
    </Card>
  );
}

function SaveBar({
  changed,
  onSave,
}: {
  changed: boolean;
  onSave: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");
  if (!changed && !saved) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-outline pt-4">
      {saved && !changed && (
        <p className="text-xs font-semibold text-green-700">Saved {saved}</p>
      )}
      {changed && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave();
              setSaved(new Date().toLocaleTimeString());
            } finally {
              setBusy(false);
            }
          }}
          className="h-10 rounded-md bg-primary px-5 text-sm font-bold text-white hover:bg-primary-container disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save changes"}
        </button>
      )}
    </div>
  );
}
