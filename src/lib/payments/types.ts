export type PaymentProviderType = 'manual_bank_transfer' | 'paystack' | 'stripe';

export type PaymentMethodType = 'BANK_TRANSFER' | 'PAYSTACK' | 'STRIPE';

export type PaymentStatusType = 
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_SUBMITTED'
  | 'UNDER_REVIEW'
  | 'PAID'
  | 'PAYMENT_REJECTED'
  | 'PAYMENT_EXPIRED'
  | 'PAYMENT_CANCELLED'
  | 'REFUND_REQUESTED'
  | 'REFUNDED';

export type PaymentEventType =
  | 'PAYMENT_CREATED'
  | 'PAYMENT_INSTRUCTIONS_VIEWED'
  | 'PAYMENT_PROOF_SUBMITTED'
  | 'PAYMENT_UNDER_REVIEW'
  | 'PAYMENT_APPROVED'
  | 'PAYMENT_REJECTED'
  | 'PAYMENT_EXPIRED'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_REFUNDED'
  | 'RECONCILED';

export interface PaymentAuditEvent {
  id: string;
  eventType: PaymentEventType;
  actorId: string;
  actorEmail?: string;
  actorRole: string;
  timestamp: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface BankAccountConfig {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchName?: string;
  currency: string;
  instructions: string;
  deadlineHours: number;
  contactPhone: string;
  contactEmail: string;
  referencePrefix: string;
  requireProofUpload: boolean;
}

export interface PaymentRecord {
  id: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  paymentReference: string;
  trackingId?: string;
  provider: PaymentProviderType;
  method: PaymentMethodType;
  currency: string;
  amount: number;
  originalAmount?: number;
  originalCurrency?: string;
  status: PaymentStatusType;
  customerNote?: string;
  proofOfPaymentUrl?: string;
  proofFileName?: string;
  submittedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  isReconciled?: boolean;
  reconciledAt?: string;
  reconciledBy?: string;
  reconciliationNotes?: string;
  deadline?: string;
  events: PaymentAuditEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentInitResult {
  paymentId: string;
  paymentReference: string;
  amount: number;
  currency: string;
  deadline: string;
  bankDetails?: BankAccountConfig;
  instructions: string;
}

export interface PaymentProofSubmission {
  paymentId: string;
  customerNote?: string;
  proofOfPaymentUrl: string;
  proofFileName?: string;
}

export interface PaymentProvider {
  readonly name: PaymentProviderType;
  initializePayment(booking: any, customer: any, config?: any): Promise<PaymentInitResult>;
  submitProof(submission: PaymentProofSubmission, customerId: string): Promise<void>;
  verifyPayment(paymentId: string, adminId: string, adminEmail: string, notes?: string): Promise<void>;
  rejectPayment(paymentId: string, adminId: string, adminEmail: string, reason: string): Promise<void>;
}
