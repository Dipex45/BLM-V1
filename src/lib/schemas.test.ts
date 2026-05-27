import {
  BookingSchema,
  DriverSchema,
  NotificationSchema,
  PaymentSchema,
  RoleSchema,
  SupportTicketSchema,
} from './schemas';

describe('Production schemas', () => {
  test('booking schema accepts the full paid lifecycle state', () => {
    const booking = BookingSchema.parse({
      customerId: 'user-1',
      customerName: 'Ada Lovelace',
      customerEmail: 'ada@example.com',
      pickup: 'Lagos Hub',
      destination: 'Abuja Hub',
      vehicleClass: 'Business',
      date: '2026-05-20',
      time: '14:30',
      totalAmount: 350,
      status: 'Paid',
      createdAt: new Date().toISOString(),
    });

    expect(booking.currency).toBe('NGN');
    expect(booking.status).toBe('Paid');
  });

  test('role schema includes operational RBAC roles', () => {
    expect(RoleSchema.parse('super_admin')).toBe('super_admin');
    expect(RoleSchema.parse('finance_admin')).toBe('finance_admin');
    expect(RoleSchema.parse('dispatcher')).toBe('dispatcher');
  });

  test('payment schema requires reconciliation and fraud metadata', () => {
    const payment = PaymentSchema.parse({
      bookingId: 'booking-1',
      customerId: 'user-1',
      provider: 'stripe',
      amount: 100,
      amountMinor: 10000,
      currency: 'NGN',
      status: 'initialized',
      reconciliation: { required: true, source: 'webhook_or_server_verify' },
      fraud: { duplicateCheck: 'passed', riskLevel: 'pending' },
    });

    expect(payment.webhookEventIds).toEqual([]);
    expect(payment.payoutStatus).toBe('not_applicable');
  });

  test('driver, ticket, and notification schemas model operations records', () => {
    expect(() =>
      DriverSchema.parse({
        profile: { name: 'Driver One', phone: '+15555550123' },
        onboarding: { state: 'pending_review' },
        kyc: {
          status: 'pending',
          licenseNumber: 'ABC-123',
          licenseVerification: 'pending',
        },
        availability: { state: 'offline', updatedAt: new Date().toISOString() },
        ratings: { average: null, count: 0 },
      }),
    ).not.toThrow();

    expect(SupportTicketSchema.parse({ state: 'open' }).priority).toBe('normal');
    expect(NotificationSchema.parse({
      channel: 'email',
      to: 'ops@example.com',
      body: 'Hello',
      template: 'admin_alert',
      status: 'queued',
    }).deliveryState).toBe('pending');
  });
});
