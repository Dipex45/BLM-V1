import { company, defaultVehicles } from './company.js';

/**
 * Single source of truth for everything that affects a price.
 * The server resolves the catalog from Firestore settings (falling back to these
 * defaults), serves it at /api/public/catalog, and uses the same resolved values
 * for authoritative quotes. The browser never invents its own numbers.
 */

export type PricingRules = typeof company.pricingRules;

export type VehicleClass = {
  title: string;
  desc?: string;
  price: number;
  kmRate?: number;
  icon?: string;
};

export type TouringPackage = {
  id: string;
  title: string;
  name: string;
  desc?: string;
  price: number;
  locations: number;
  days: number;
};

export type FactorItem = { name: string; factor: number };

export type CarHireOption = {
  id: string;
  name: string;
  seats: number;
  pricePerDay: number;
  available: boolean;
  desc?: string;
  image?: string;
};

export type Hub = { id?: string; name: string; address: string; active?: boolean };

export type SupportedCurrency = 'NGN' | 'XOF' | 'GHS' | 'USD' | 'EUR' | 'GBP';

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = ['NGN', 'XOF', 'GHS', 'USD', 'EUR', 'GBP'];

export const DEFAULT_CURRENCY_RATES: Record<SupportedCurrency, number> = {
  NGN: 1,
  XOF: 0.41,
  GHS: 0.0097,
  USD: 0.00067,
  EUR: 0.00062,
  GBP: 0.00053,
};

export const DEFAULT_TRACKING_LOCATIONS = [
  'Lagos dispatch desk',
  'Seme border post',
  'Cotonou station',
  'Lome station',
  'Accra station',
];

export type PricingCatalog = {
  rules: PricingRules;
  vehicles: VehicleClass[];
  touringPackages: TouringPackage[];
  touringStates: FactorItem[];
  internationalTours: FactorItem[];
  carHireOptions: CarHireOption[];
};

export type PublicCatalog = PricingCatalog & {
  hubs: Hub[];
  blockedDates: string[];
  currencyRates: Record<SupportedCurrency, number>;
  routes: string[];
  trackingLocations: string[];
  mapsEnabled: boolean;
  payments: { paystack: boolean; stripe: boolean; manualBankTransfer: boolean };
  features: Record<string, boolean>;
};

export const DEFAULT_FEATURE_FLAGS = {
  paystack: true,
  stripe: true,
  manualBankTransfer: true,
  liveTracking: true,
  whatsappNotifications: true,
  smsNotifications: true,
  french: true,
};

const nonEmptyArray = <T>(value: unknown, fallback: T[]): T[] =>
  Array.isArray(value) && value.length > 0 ? (value as T[]) : fallback;

const finitePositive = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Merge raw settings documents with defaults and normalise every number. */
export function resolvePricingCatalog(raw: Partial<Record<keyof PricingCatalog, unknown>>): PricingCatalog {
  const rulesInput = raw.rules && typeof raw.rules === 'object' && !Array.isArray(raw.rules) ? raw.rules : {};
  const rules = { ...company.pricingRules } as PricingRules;
  for (const [key, value] of Object.entries(rulesInput as Record<string, unknown>)) {
    const parsed = Number(value);
    if (key in rules && Number.isFinite(parsed) && parsed >= 0) (rules as Record<string, number>)[key] = parsed;
  }

  const vehicles = nonEmptyArray<Record<string, unknown>>(raw.vehicles, defaultVehicles).map((item) => ({
    title: String(item.title || 'Vehicle'),
    desc: String(item.desc || ''),
    price: finitePositive(item.price, 0),
    ...(Number(item.kmRate) > 0 ? { kmRate: Number(item.kmRate) } : {}),
    icon: String(item.icon || 'directions_car'),
  }));

  const touringPackages = nonEmptyArray<Record<string, unknown>>(raw.touringPackages, company.touringPackages).map((item) => {
    const title = String(item.title || item.name || 'Touring package');
    return {
      id: String(item.id || slug(title)),
      title,
      name: String(item.name || title),
      desc: String(item.desc || ''),
      price: finitePositive(item.price, 0),
      locations: finitePositive(item.locations, 1),
      days: finitePositive(item.days, 1),
    };
  });

  const factorList = (value: unknown, fallback: FactorItem[]) =>
    nonEmptyArray<Record<string, unknown>>(value, fallback).map((item) => ({
      name: String(item.name || ''),
      factor: finitePositive(item.factor, 1),
    })).filter((item) => item.name);

  const carHireOptions = nonEmptyArray<Record<string, unknown>>(raw.carHireOptions, company.carHireOptions).map((item) => {
    const name = String(item.name || 'Hire vehicle');
    return {
      id: String(item.id || slug(name)),
      name,
      seats: finitePositive(item.seats, 4),
      pricePerDay: finitePositive(item.pricePerDay ?? item.price, 0),
      available: item.available !== false,
      desc: String(item.desc || ''),
      image: String(item.image || ''),
    };
  });

  return {
    rules,
    vehicles,
    touringPackages,
    touringStates: factorList(raw.touringStates, company.touringStates),
    internationalTours: factorList(raw.internationalTours, company.internationalTours),
    carHireOptions,
  };
}

export function resolveCurrencyRates(raw: unknown): Record<SupportedCurrency, number> {
  const rates = { ...DEFAULT_CURRENCY_RATES };
  if (raw && typeof raw === 'object') {
    for (const currency of SUPPORTED_CURRENCIES) {
      const value = Number((raw as Record<string, unknown>)[currency]);
      if (Number.isFinite(value) && value > 0) rates[currency] = value;
    }
  }
  rates.NGN = 1;
  return rates;
}

export function convertFromNgn(amount: number, currency: SupportedCurrency, rates: Record<SupportedCurrency, number>) {
  const rate = rates[currency] || 1;
  return Number((amount * rate).toFixed(currency === 'NGN' || currency === 'XOF' ? 0 : 2));
}

/** Vehicle classes shown for per-kilometre trips (everything that is not a package/hire/logistics class). */
export function distanceVehicles(vehicles: VehicleClass[]) {
  return vehicles.filter((vehicle) => {
    const title = vehicle.title.toLowerCase();
    return !['touring', 'logistics', 'pickup', 'car hire', 'cross-border', 'international'].some((word) => title.includes(word));
  });
}

/** Effective per-km rate, identical to the formula used in calculateBookingQuote. */
export function effectiveKmRate(vehicle: Partial<VehicleClass> | undefined, rules: PricingRules) {
  const fromVehicle = Number(vehicle?.kmRate);
  if (Number.isFinite(fromVehicle) && fromVehicle > 0) return fromVehicle;
  const fromPrice = Number(vehicle?.price) / 80;
  if (Number.isFinite(fromPrice) && fromPrice > 0) return fromPrice;
  return finitePositive(rules.pricePerKm, 350);
}

export const serviceSlug = slug;
