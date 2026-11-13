import { effectiveKmRate, type PricingCatalog } from './catalog.js';

export type ServiceKind = 'distance' | 'car_hire' | 'touring' | 'cross_border' | 'logistics';

/** Classify a service title the same way on the server and in the browser. */
export function serviceKind(serviceType: string): ServiceKind {
  const service = serviceType.toLowerCase();
  if (service.includes('car hire')) return 'car_hire';
  if (service.includes('cross-border') || service.includes('cross border')) return 'cross_border';
  if (service.includes('tour')) return 'touring';
  if (service.includes('pickup') || service.includes('logistics')) return 'logistics';
  return 'distance';
}

export const needsRouteDistance = (kind: ServiceKind) => kind === 'distance' || kind === 'logistics';

export type BookingPricingInput = {
  serviceType: string;
  vehicleClass: string;
  date: string;
  time: string;
  distanceKm?: number;
  isReturn?: boolean;
  carHireVehicle?: string;
  carHireDurationDays?: number;
  carHireWithDriver?: boolean;
  touringPackage?: string;
  touringState?: string;
  tourGuideNeeded?: boolean;
  internationalCountry?: string;
  passengerCount?: number;
  borderClearanceHelp?: boolean;
  packageWeightKg?: number;
};

export type BookingQuote = {
  basePrice: number;
  extraFee: number;
  feeLabel: string;
  vehicleClass: string;
  distanceKm: number;
  kmRate: number;
  weekendSurcharge: number;
  nightSurcharge: number;
  total: number;
};

const positive = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function calculateBookingQuote(input: BookingPricingInput, catalog: PricingCatalog): BookingQuote {
  const { rules, vehicles, touringPackages, touringStates, internationalTours, carHireOptions } = catalog;
  const kind = serviceKind(input.serviceType);
  let basePrice = 0;
  let extraFee = 0;
  let feeLabel = 'Service fee';
  let vehicleClass = input.vehicleClass;
  let distanceKm = 0;
  let kmRate = 0;

  if (kind === 'distance') {
    const vehicle = vehicles.find((item) => item.title.toLowerCase() === input.vehicleClass.toLowerCase()) || vehicles[0];
    distanceKm = positive(input.distanceKm, 1);
    kmRate = effectiveKmRate(vehicle, rules);
    const multiplier = input.isReturn ? positive(rules.returnMultiplier, 2) : 1;
    basePrice = Math.round(distanceKm * kmRate * multiplier);
    extraFee = positive(rules.standardServiceFee, 0);
    vehicleClass = vehicle?.title || input.vehicleClass;
    feeLabel = `Booking fee${input.isReturn ? ' (return trip)' : ''}`;
  } else if (kind === 'car_hire') {
    const car = carHireOptions.find((item) => item.id === input.carHireVehicle) || carHireOptions[0];
    const days = positive(input.carHireDurationDays, 1);
    const cautionFee = positive(rules.carHireCautionFee, 0);
    const driverFee = input.carHireWithDriver ? positive(rules.carHireDriverDailyFee, 0) * days : 0;
    basePrice = Math.round(positive(car?.pricePerDay, 0) * days);
    extraFee = Math.round(cautionFee + driverFee);
    vehicleClass = car?.name || input.vehicleClass;
    feeLabel = `Refundable deposit${driverFee ? ' plus driver' : ''}`;
  } else if (kind === 'touring') {
    const pkg = touringPackages.find((item) => item.id === input.touringPackage || item.name === input.touringPackage || item.title === input.touringPackage) || touringPackages[0];
    const state = touringStates.find((item) => item.name === input.touringState) || touringStates[0];
    const locations = positive(pkg?.locations || pkg?.days, 1);
    const packagePrice = positive(pkg?.price, positive(rules.touringPerLocation, 0) * locations);
    basePrice = Math.round(packagePrice * positive(state?.factor, 1));
    extraFee = input.tourGuideNeeded ? positive(rules.tourGuideFee, 0) : 0;
    vehicleClass = pkg?.title || input.vehicleClass;
    feeLabel = extraFee ? 'Local guide' : 'Extras';
  } else if (kind === 'cross_border') {
    const country = internationalTours.find((item) => item.name === input.internationalCountry) || internationalTours[0];
    const passengers = positive(input.passengerCount, 1);
    basePrice = Math.round(positive(rules.crossBorderBasePerPassenger, 0) * passengers * positive(country?.factor, 1));
    extraFee = input.borderClearanceHelp ? positive(rules.crossBorderProcessingFee, 0) : 0;
    vehicleClass = input.vehicleClass || 'Cross-Border transit';
    feeLabel = 'Help at the border';
  } else {
    const vehicle = vehicles.find((item) => /pickup|logistics/i.test(item.title));
    distanceKm = positive(input.distanceKm, 1);
    const weightKg = positive(input.packageWeightKg, 1);
    const routeFee = Math.round(distanceKm * positive(rules.logisticsPricePerKm, 0));
    const weightFee = Math.round(weightKg * positive(rules.pricePerKg, 0));
    kmRate = positive(rules.logisticsPricePerKm, 0);
    basePrice = positive(vehicle?.price, 0) + routeFee;
    extraFee = positive(rules.pickupLogisticsFee, 0) + weightFee;
    vehicleClass = vehicle?.title || 'Pickup & Logistics';
    feeLabel = `Handling and ${weightKg} kg weight`;
  }

  const subtotal = Math.round(basePrice + extraFee);
  const travelDate = new Date(`${input.date}T${input.time}:00`);
  const validDate = !Number.isNaN(travelDate.getTime());
  const weekendSurcharge = validDate && [0, 6].includes(travelDate.getDay())
    ? Math.round((subtotal * Math.max(Number(rules.weekendSurchargePercent || 0), 0)) / 100)
    : 0;
  const hour = travelDate.getHours();
  const nightSurcharge = validDate && (hour < 6 || hour >= 22)
    ? Math.round((subtotal * Math.max(Number(rules.nightSurchargePercent || 0), 0)) / 100)
    : 0;

  return {
    basePrice: Math.round(basePrice),
    extraFee: Math.round(extraFee),
    feeLabel,
    vehicleClass,
    distanceKm,
    kmRate,
    weekendSurcharge,
    nightSurcharge,
    total: subtotal + weekendSurcharge + nightSurcharge,
  };
}

/** Lowest price a customer can pay for each service, derived from the live catalog. */
export function serviceStartingPrice(kind: ServiceKind, catalog: PricingCatalog): { amount: number; suffix?: string } {
  const { rules } = catalog;
  switch (kind) {
    case 'distance': {
      const rates = catalog.vehicles
        .filter((vehicle) => !/touring|logistics|pickup|car hire|cross-border|international/i.test(vehicle.title))
        .map((vehicle) => (Number(vehicle.kmRate) > 0 ? Number(vehicle.kmRate) : Number(vehicle.price) / 80))
        .filter((rate) => Number.isFinite(rate) && rate > 0);
      return { amount: rates.length ? Math.min(...rates) : Number(rules.pricePerKm), suffix: '/km' };
    }
    case 'car_hire': {
      const prices = catalog.carHireOptions.filter((car) => car.available).map((car) => car.pricePerDay);
      return { amount: prices.length ? Math.min(...prices) : 0, suffix: '/day' };
    }
    case 'touring': {
      const minFactor = Math.min(...catalog.touringStates.map((state) => state.factor), 1);
      const minPackage = Math.min(...catalog.touringPackages.map((pkg) => pkg.price));
      return { amount: Math.round(minPackage * minFactor) };
    }
    case 'cross_border': {
      const minFactor = Math.min(...catalog.internationalTours.map((country) => country.factor));
      return { amount: Math.round(Number(rules.crossBorderBasePerPassenger) * minFactor), suffix: '/passenger' };
    }
    case 'logistics': {
      const vehicle = catalog.vehicles.find((item) => /pickup|logistics/i.test(item.title));
      return { amount: Number(vehicle?.price || 0) + Number(rules.pickupLogisticsFee || 0) };
    }
  }
}
