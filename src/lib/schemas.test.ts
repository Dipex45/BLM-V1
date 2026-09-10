import {
  AuditLogSchema,
  BookingSchema,
  CustomerSchema,
  DriverSchema,
  NotificationSchema,
  PaymentSchema,
  ReviewSchema,
  RoleSchema,
  SupportTicketSchema,
  VehicleSchema,
} from './schemas';

describe('Production schemas', () => {
  test('booking schema accepts the full paid lifecycle state', () => {
    const booking = BookingSchema.parse({
      customerId: 'user-1',
      customerName: 'Ada Lovelace',
      customerEmail: 'ada@example.com',
      customerPhone: '+2348000000000',
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

  test('booking schema rejects invalid dates, amounts, and lifecycle states', () => {
    const invalidBooking = {
      customerId: 'user-1',
      customerName: 'Ada Customer',
      customerEmail: 'ada@example.com',
      customerPhone: '+2348000000000',
      pickup: 'Ikeja',
      destination: 'Badagry',
      vehicleClass: 'Economy',
      date: '20/05/2026',
      time: '9pm',
      totalAmount: -1,
      status: 'Delivered',
      createdAt: new Date().toISOString(),
    };
    expect(BookingSchema.safeParse(invalidBooking).success).toBe(false);
  });

  test('customer schema preserves fraud, device, booking, and payment history', () => {
    const customer = CustomerSchema.parse({
      profile: { fullName: 'Ada Customer', email: 'ada@example.com', phone: '+2348000000000' },
      verificationStatus: 'verified',
      bookingHistory: ['booking-1'],
      paymentHistory: ['payment-1'],
      fraudFlags: [{ code: 'velocity_check', severity: 'medium', createdAt: new Date().toISOString() }],
      deviceTracking: [{ deviceId: 'device-1', userAgent: 'Browser', ip: '127.0.0.1', lastSeenAt: new Date().toISOString() }],
      loginHistory: [{ userAgent: 'Browser', ip: '127.0.0.1', at: new Date().toISOString() }],
    });
    expect(customer.role).toBe('customer');
    expect(customer.fraudFlags).toHaveLength(1);
    expect(customer.paymentHistory).toEqual(['payment-1']);
  });

  test('vehicle schema validates compliance and capacity records', () => {
    expect(VehicleSchema.parse({
      category: 'Executive SUV',
      capacity: { passengers: 6, weightKg: 450 },
      vin: 'BLM1234567890',
      maintenanceStatus: 'active',
      registrationExpiry: '2027-05-20',
      insuranceExpiry: '2027-04-01',
    }).capacity.passengers).toBe(6);

    expect(VehicleSchema.safeParse({
      category: 'Bus',
      capacity: { passengers: -1 },
      vin: '123',
      maintenanceStatus: 'unknown',
      registrationExpiry: '',
      insuranceExpiry: '',
    }).success).toBe(false);
  });

  test('audit schema records actor, request origin, and rollback support', () => {
    const audit = AuditLogSchema.parse({
      actorId: 'admin-1',
      actorEmail: 'admin@blmmotors.ng',
      actorRole: 'finance_admin',
      action: 'PAYMENT_RECONCILED',
      resource: 'payments/payment-1',
      metadata: { provider: 'paystack' },
      ip: '127.0.0.1',
      userAgent: 'Browser',
      rollback: { supported: false, reason: 'Provider settlement is immutable' },
    });
    expect(audit.rollback?.supported).toBe(false);
    expect(audit.metadata.provider).toBe('paystack');
  });

  test('review schema enforces rating and comment limits', () => {
    expect(ReviewSchema.safeParse({
      bookingId: 'booking-1',
      customerId: 'customer-1',
      rating: 6,
      comment: 'Invalid rating',
      createdAt: new Date().toISOString(),
    }).success).toBe(false);
    expect(ReviewSchema.parse({
      bookingId: 'booking-1',
      customerId: 'customer-1',
      rating: 5,
      comment: 'Professional and on time.',
      createdAt: new Date().toISOString(),
    }).rating).toBe(5);
  });

  test('support ticket schema records operational escalation', () => {
    const ticket = SupportTicketSchema.parse({
      customerId: 'customer-1',
      customerEmail: 'customer@example.com',
      state: 'escalated',
      priority: 'urgent',
      escalation: {
        source: 'customer_support_agent',
        reason: 'Cross-border travel date at risk',
        escalatedAt: new Date().toISOString(),
      },
    });
    expect(ticket.state).toBe('escalated');
    expect(ticket.escalation?.reason).toContain('travel date');
  });
});
