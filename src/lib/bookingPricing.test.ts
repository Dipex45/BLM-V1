import { calculateBookingQuote, serviceKind, serviceStartingPrice } from './bookingPricing';
import { convertFromNgn, DEFAULT_CURRENCY_RATES, resolveCurrencyRates, resolvePricingCatalog } from './catalog';

const catalog = resolvePricingCatalog({});

const baseInput = {
  serviceType: 'Long and short distance trips',
  vehicleClass: 'Economy',
  date: '2026-09-14',
  time: '08:00',
};

describe('calculateBookingQuote', () => {
  it('prices distance trips by vehicle kilometer rate plus service fee', () => {
    const quote = calculateBookingQuote({ ...baseInput, distanceKm: 25 }, catalog);

    expect(quote.basePrice).toBe(7_500);
    expect(quote.extraFee).toBe(4_500);
    expect(quote.total).toBe(12_000);
  });

  it('prices car hire by selected daily rate, duration, deposit and chauffeur', () => {
    const quote = calculateBookingQuote({
      ...baseInput,
      serviceType: 'Car hire',
      carHireVehicle: 'toyota-corolla',
      carHireDurationDays: 2,
      carHireWithDriver: true,
    }, catalog);

    expect(quote.basePrice).toBe(140_000);
    expect(quote.extraFee).toBe(45_000);
    expect(quote.total).toBe(185_000);
  });

  it('prices touring from the selected package, state factor and guide option', () => {
    const quote = calculateBookingQuote({
      ...baseInput,
      serviceType: 'Touring',
      touringPackage: 'touring-basic',
      touringState: 'Lagos',
      tourGuideNeeded: true,
    }, catalog);

    expect(quote.basePrice).toBe(90_000);
    expect(quote.extraFee).toBe(15_000);
    expect(quote.total).toBe(105_000);
  });

  it('prices cross-border transit by passenger, country factor and clearance support', () => {
    const quote = calculateBookingQuote({
      ...baseInput,
      serviceType: 'Cross-Border transit',
      internationalCountry: 'Benin Republic',
      passengerCount: 1,
      borderClearanceHelp: true,
    }, catalog);

    expect(quote.basePrice).toBe(99_000);
    expect(quote.extraFee).toBe(30_000);
    expect(quote.total).toBe(129_000);
  });

  it('prices logistics from its base, route, handling and cargo weight', () => {
    const quote = calculateBookingQuote({
      ...baseInput,
      serviceType: 'Pickup and logistics',
      distanceKm: 25,
      packageWeightKg: 1,
    }, catalog);

    expect(quote.basePrice).toBe(71_250);
    expect(quote.extraFee).toBe(23_200);
    expect(quote.total).toBe(94_450);
  });

  it('applies configured weekend and night surcharges to the same subtotal', () => {
    const quote = calculateBookingQuote(
      { ...baseInput, date: '2026-09-13', time: '05:00', distanceKm: 25 },
      { ...catalog, rules: { ...catalog.rules, weekendSurchargePercent: 10, nightSurchargePercent: 5 } },
    );

    expect(quote.weekendSurcharge).toBe(1_200);
    expect(quote.nightSurcharge).toBe(600);
    expect(quote.total).toBe(13_800);
  });

  it('classifies every public service the same way on server and client', () => {
    expect(serviceKind('Long and short distance trips')).toBe('distance');
    expect(serviceKind('Cross-border trips')).toBe('cross_border');
    expect(serviceKind('Touring')).toBe('touring');
    expect(serviceKind('Car hire')).toBe('car_hire');
    expect(serviceKind('Pickup and logistics')).toBe('logistics');
  });

  it('derives "from" prices from the live catalog, not hard-coded numbers', () => {
    expect(serviceStartingPrice('distance', catalog)).toEqual({ amount: 300, suffix: '/km' });
    expect(serviceStartingPrice('car_hire', catalog)).toEqual({ amount: 70_000, suffix: '/day' });
    expect(serviceStartingPrice('touring', catalog).amount).toBe(90_000);
    expect(serviceStartingPrice('logistics', catalog).amount).toBe(87_000);
    const repriced = resolvePricingCatalog({ carHireOptions: [{ id: 'van', name: 'Van', pricePerDay: 55_000, seats: 8 }] });
    expect(serviceStartingPrice('car_hire', repriced).amount).toBe(55_000);
  });
});

describe('resolvePricingCatalog', () => {
  it('uses admin overrides and ignores invalid numbers', () => {
    const resolved = resolvePricingCatalog({ rules: { pricePerKm: 500, standardServiceFee: 'abc', unknownKey: 9 } });
    expect(resolved.rules.pricePerKm).toBe(500);
    expect(resolved.rules.standardServiceFee).toBe(4_500);
    expect((resolved.rules as Record<string, unknown>).unknownKey).toBeUndefined();
  });

  it('falls back to defaults when a setting is empty', () => {
    expect(resolvePricingCatalog({ vehicles: [] }).vehicles.map((vehicle) => vehicle.title)).toEqual(['Economy', 'Business', 'Executive SUV', 'Pickup & Logistics']);
  });
});

describe('currency', () => {
  it('converts with the same rounding rules the server charges with', () => {
    const rates = resolveCurrencyRates({ USD: 0.0007, NGN: 5 });
    expect(rates.NGN).toBe(1);
    expect(convertFromNgn(100_000, 'USD', rates)).toBe(70);
    expect(convertFromNgn(12_345, 'XOF', DEFAULT_CURRENCY_RATES)).toBe(5061);
  });
});
