export type PricingItem = Record<string, any>;

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

export type BookingPricingCatalog = {
  rules: PricingItem;
  vehicles: PricingItem[];
  touringPackages: PricingItem[];
  touringStates: PricingItem[];
  internationalTours: PricingItem[];
  carHireOptions: PricingItem[];
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

const positiveNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function calculateBookingQuote(
  input: BookingPricingInput,
  catalog: BookingPricingCatalog,
  formatAmount: (amount: number) => string = (amount) => `NGN ${Math.round(amount).toLocaleString('en-NG')}`,
): BookingQuote {
  const service = input.serviceType.toLowerCase();
  const { rules, vehicles, touringPackages, touringStates, internationalTours, carHireOptions } = catalog;
  let basePrice = 0;
  let extraFee = 0;
  let feeLabel = 'Standard service fee';
  let vehicleClass = input.vehicleClass || 'Economy';
  let distanceKm = 0;
  let kmRate = 0;

  if (service.includes('long') || service.includes('short') || service.includes('distance')) {
    const selectedVehicle = vehicles.find((item) => String(item.title).toLowerCase() === input.vehicleClass.toLowerCase()) || vehicles[0] || {};
    distanceKm = positiveNumber(input.distanceKm, 1);
    kmRate = positiveNumber(selectedVehicle.kmRate, positiveNumber(selectedVehicle.price, 28_000) / 80);
    kmRate = positiveNumber(kmRate, positiveNumber(rules.pricePerKm, 350));
    const returnMultiplier = input.isReturn ? positiveNumber(rules.returnMultiplier, 2) : 1;
    basePrice = Math.round(distanceKm * kmRate * returnMultiplier);
    extraFee = positiveNumber(rules.standardServiceFee, 4_500);
    vehicleClass = String(selectedVehicle.title || input.vehicleClass || 'Economy');
    feeLabel = `${distanceKm} km at ${formatAmount(kmRate)}/km${input.isReturn ? ' (return trip)' : ''} plus service fee`;
  } else if (service.includes('car hire')) {
    const selectedCar = carHireOptions.find((item) => item.id === input.carHireVehicle) || {};
    const genericVehicle = vehicles.find((item) => String(item.title).toLowerCase().includes('car hire')) || {};
    const days = positiveNumber(input.carHireDurationDays, 1);
    const dailyRate = positiveNumber(selectedCar.pricePerDay || selectedCar.price || genericVehicle.price, 70_000);
    const cautionFee = positiveNumber(rules.carHireCautionFee, 25_000);
    const driverFee = input.carHireWithDriver ? positiveNumber(rules.carHireDriverDailyFee, 10_000) * days : 0;
    basePrice = Math.round(dailyRate * days);
    extraFee = Math.round(cautionFee + driverFee);
    vehicleClass = String(selectedCar.name || input.vehicleClass || 'Car Hire');
    feeLabel = `Caution deposit (${formatAmount(cautionFee)})${driverFee ? ` plus chauffeur (${formatAmount(driverFee)})` : ''}`;
  } else if (service.includes('tour')) {
    const selectedPackage = touringPackages.find((item) => item.id === input.touringPackage || item.name === input.touringPackage || item.title === input.touringPackage) || touringPackages[0] || {};
    const selectedState = touringStates.find((item) => item.name === input.touringState) || touringStates[0] || {};
    const locations = positiveNumber(selectedPackage.locations || selectedPackage.days, 1);
    const packagePrice = positiveNumber(selectedPackage.price, positiveNumber(rules.touringPerLocation, 15_000) * locations);
    basePrice = Math.round(packagePrice * positiveNumber(selectedState.factor, 1));
    extraFee = input.tourGuideNeeded ? positiveNumber(rules.tourGuideFee, 15_000) : 0;
    vehicleClass = String(selectedPackage.title || selectedPackage.name || input.vehicleClass || 'Touring');
    feeLabel = `${selectedPackage.name || 'Touring package'} (${locations} locations) in ${selectedState.name || input.touringState || 'selected region'}${extraFee ? ' plus professional guide' : ''}`;
  } else if (service.includes('cross-border') || service.includes('cross border')) {
    const selectedCountry = internationalTours.find((item) => item.name === input.internationalCountry) || {};
    const passengers = positiveNumber(input.passengerCount, 1);
    basePrice = Math.round(positiveNumber(rules.crossBorderBasePerPassenger, 90_000) * passengers * positiveNumber(selectedCountry.factor, 1.1));
    extraFee = input.borderClearanceHelp ? positiveNumber(rules.crossBorderProcessingFee, 30_000) : 0;
    vehicleClass = input.vehicleClass || 'Cross-Border transit';
    feeLabel = `${passengers} passenger${passengers === 1 ? '' : 's'} to ${selectedCountry.name || input.internationalCountry || 'selected destination'}${extraFee ? ' plus border support' : ''}`;
  } else if (service.includes('pickup') || service.includes('logistics')) {
    const logisticsVehicle = vehicles.find((item) => String(item.title).toLowerCase().includes('pickup') || String(item.title).toLowerCase().includes('logistics')) || {};
    distanceKm = positiveNumber(input.distanceKm, 1);
    const weightKg = positiveNumber(input.packageWeightKg, 1);
    const routeFee = Math.round(distanceKm * positiveNumber(rules.logisticsPricePerKm, 250));
    const weightFee = Math.round(weightKg * positiveNumber(rules.pricePerKg, 1_200));
    basePrice = positiveNumber(logisticsVehicle.price, 65_000) + routeFee;
    extraFee = positiveNumber(rules.pickupLogisticsFee, 22_000) + weightFee;
    vehicleClass = String(logisticsVehicle.title || input.vehicleClass || 'Pickup & Logistics');
    feeLabel = `${distanceKm} km route, handling and ${weightKg} kg cargo`;
  } else {
    const selectedVehicle = vehicles.find((item) => String(item.title).toLowerCase() === input.vehicleClass.toLowerCase()) || vehicles[0] || {};
    basePrice = positiveNumber(selectedVehicle.price, 25_000);
    extraFee = positiveNumber(rules.standardServiceFee, 4_500);
    vehicleClass = String(selectedVehicle.title || input.vehicleClass || 'Economy');
  }

  const subtotal = Math.round(basePrice + extraFee);
  const travelDate = new Date(`${input.date}T${input.time}:00`);
  const validDate = !Number.isNaN(travelDate.getTime());
  const weekendSurcharge = validDate && [0, 6].includes(travelDate.getDay())
    ? Math.round(subtotal * Math.max(Number(rules.weekendSurchargePercent || 0), 0) / 100)
    : 0;
  const nightSurcharge = validDate && (travelDate.getHours() < 6 || travelDate.getHours() >= 22)
    ? Math.round(subtotal * Math.max(Number(rules.nightSurchargePercent || 0), 0) / 100)
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
