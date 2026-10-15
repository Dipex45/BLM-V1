import { calculateBookingQuote } from './bookingPricing';
import { company, defaultVehicles } from './company';

const catalog = {
  rules: company.pricingRules,
  vehicles: defaultVehicles,
  touringPackages: company.touringPackages,
  touringStates: company.touringStates,
  internationalTours: company.internationalTours,
  carHireOptions: company.carHireOptions,
};

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
});
