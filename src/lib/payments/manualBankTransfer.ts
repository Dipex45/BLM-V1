import { doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import {
  PaymentProvider,
  PaymentProviderType,
  BankAccountConfig,
  PaymentInitResult,
  PaymentProofSubmission,
  PaymentRecord,
  PaymentAuditEvent,
} from './types';

export const DEFAULT_BANK_CONFIG: BankAccountConfig = {
  bankName: 'Guaranty Trust Bank (GTBank)',
  accountName: 'BLM Motors & Logistics Ltd',
  accountNumber: '0123456789',
  branchName: 'Ikeja Branch, Lagos',
  currency: 'NGN',
  instructions: 'Please transfer the exact total amount shown below using your unique BLM Payment Reference as the transaction narration / remark. After making the transfer, upload your proof of payment (screenshot or receipt PDF).',
  deadlineHours: 24,
  contactPhone: '+2349064090276',
  contactEmail: 'bookings@blmmotors.ng',
  referencePrefix: 'BLM',
  requireProofUpload: true,
};

export class ManualBankTransferProvider implements PaymentProvider {
  readonly name: PaymentProviderType = 'manual_bank_transfer';

  async getBankConfig(): Promise<BankAccountConfig> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'bank_accounts'));
      if (snap.exists() && snap.data()?.value) {
        return { ...DEFAULT_BANK_CONFIG, ...snap.data().value };
      }
    } catch (err) {
      console.warn('Using default bank configuration', err);
    }
    return DEFAULT_BANK_CONFIG;
  }

  generateReference(prefix = 'BLM'): string {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}-${year}-${randomNum}`;
  }

  generateTrackingId(serviceType = 'TRK'): string {
    const prefix = serviceType.toUpperCase().includes('LOGISTICS') ? 'BLM-LOG' : 'BLM-TRK';
    const year = new Date().getFullYear();
    const randomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${prefix}-${year}-${randomCode}`;
  }

  async initializePayment(booking: any, customer: any, configOverrides?: Partial<BankAccountConfig>): Promise<PaymentInitResult> {
    const bankConfig = await this.getBankConfig();
    const activeConfig = { ...bankConfig, ...configOverrides };
    
    // Check if an active payment record already exists for this booking
    const existingSnap = await getDocs(query(collection(db, 'payments'), where('bookingId', '==', booking.id)));
    let paymentRecord: PaymentRecord | null = null;
    
    const deadlineDate = new Date(Date.now() + (activeConfig.deadlineHours || 24) * 3600 * 1000);
    const deadlineIso = deadlineDate.toISOString();

    if (!existingSnap.empty) {
      const docData = existingSnap.docs[0].data() as PaymentRecord;
      paymentRecord = { ...docData, id: existingSnap.docs[0].id };
    }

    if (!paymentRecord) {
      const paymentRef = this.generateReference(activeConfig.referencePrefix || 'BLM');
      const trackingId = this.generateTrackingId(booking.serviceType || 'TRK');
      const paymentAmount = Number(booking.totalAmount || 0);

      const newEvent: PaymentAuditEvent = {
        id: `evt-${Date.now()}`,
        eventType: 'PAYMENT_CREATED',
        actorId: customer?.uid || booking.customerId || 'system',
        actorEmail: customer?.email || booking.customerEmail,
        actorRole: 'customer',
        timestamp: new Date().toISOString(),
        notes: `Manual bank transfer initialized for booking reference ${booking.id}`,
      };

      const newPayment: Omit<PaymentRecord, 'id'> = {
        bookingId: booking.id,
        customerId: customer?.uid || booking.customerId || 'guest',
        customerName: customer?.displayName || booking.customerName || 'Customer',
        customerEmail: customer?.email || booking.customerEmail || '',
        paymentReference: paymentRef,
        trackingId,
        provider: 'manual_bank_transfer',
        method: 'BANK_TRANSFER',
        currency: booking.currency || 'NGN',
        amount: paymentAmount,
        originalAmount: paymentAmount,
        originalCurrency: booking.currency || 'NGN',
        status: 'AWAITING_PAYMENT',
        deadline: deadlineIso,
        events: [newEvent],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'payments'), newPayment);
      
      // Update booking with paymentReference & trackingId
      await updateDoc(doc(db, 'bookings', booking.id), {
        paymentReference: paymentRef,
        trackingId,
        paymentStatus: 'initialized',
        paymentProvider: 'manual_bank_transfer',
        updatedAt: new Date().toISOString(),
      });

      return {
        paymentId: docRef.id,
        paymentReference: paymentRef,
        amount: paymentAmount,
        currency: booking.currency || 'NGN',
        deadline: deadlineIso,
        bankDetails: activeConfig,
        instructions: activeConfig.instructions,
      };
    }

    return {
      paymentId: paymentRecord.id,
      paymentReference: paymentRecord.paymentReference,
      amount: paymentRecord.amount,
      currency: paymentRecord.currency,
      deadline: paymentRecord.deadline || deadlineIso,
      bankDetails: activeConfig,
      instructions: activeConfig.instructions,
    };
  }

  async submitProof(submission: PaymentProofSubmission, customerId: string): Promise<void> {
    const paymentRef = doc(db, 'payments', submission.paymentId);
    const snap = await getDoc(paymentRef);
    if (!snap.exists()) {
      throw new Error('Payment record not found.');
    }

    const currentData = snap.data() as PaymentRecord;

    const proofEvent: PaymentAuditEvent = {
      id: `evt-${Date.now()}`,
      eventType: 'PAYMENT_PROOF_SUBMITTED',
      actorId: customerId,
      actorEmail: currentData.customerEmail,
      actorRole: 'customer',
      timestamp: new Date().toISOString(),
      notes: submission.customerNote ? `Customer note: ${submission.customerNote}` : 'Payment receipt uploaded.',
      metadata: {
        fileName: submission.proofFileName,
        proofUrl: submission.proofOfPaymentUrl,
      },
    };

    await updateDoc(paymentRef, {
      status: 'UNDER_REVIEW',
      proofOfPaymentUrl: submission.proofOfPaymentUrl,
      proofFileName: submission.proofFileName || 'receipt',
      customerNote: submission.customerNote || '',
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      events: [...(currentData.events || []), proofEvent],
    });

    // Update booking state
    if (currentData.bookingId) {
      await updateDoc(doc(db, 'bookings', currentData.bookingId), {
        status: 'Booked',
        paymentStatus: 'processing',
        updatedAt: new Date().toISOString(),
      });
    }
  }

  async verifyPayment(paymentId: string, adminId: string, adminEmail: string, notes?: string): Promise<void> {
    const paymentRef = doc(db, 'payments', paymentId);
    const snap = await getDoc(paymentRef);
    if (!snap.exists()) {
      throw new Error('Payment record not found.');
    }

    const currentData = snap.data() as PaymentRecord;

    const approveEvent: PaymentAuditEvent = {
      id: `evt-${Date.now()}`,
      eventType: 'PAYMENT_APPROVED',
      actorId: adminId,
      actorEmail: adminEmail,
      actorRole: 'finance_admin',
      timestamp: new Date().toISOString(),
      notes: notes || 'Bank transfer verified and approved by finance admin.',
    };

    const trackingId = currentData.trackingId || this.generateTrackingId();

    await updateDoc(paymentRef, {
      status: 'PAID',
      verifiedAt: new Date().toISOString(),
      verifiedBy: adminEmail || adminId,
      trackingId,
      updatedAt: new Date().toISOString(),
      events: [...(currentData.events || []), approveEvent],
    });

    // Update corresponding booking to Confirmed & Paid
    if (currentData.bookingId) {
      await updateDoc(doc(db, 'bookings', currentData.bookingId), {
        status: 'Confirmed',
        paymentStatus: 'succeeded',
        trackingId,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  async rejectPayment(paymentId: string, adminId: string, adminEmail: string, reason: string): Promise<void> {
    if (!reason?.trim()) {
      throw new Error('A valid rejection reason is mandatory.');
    }

    const paymentRef = doc(db, 'payments', paymentId);
    const snap = await getDoc(paymentRef);
    if (!snap.exists()) {
      throw new Error('Payment record not found.');
    }

    const currentData = snap.data() as PaymentRecord;

    const rejectEvent: PaymentAuditEvent = {
      id: `evt-${Date.now()}`,
      eventType: 'PAYMENT_REJECTED',
      actorId: adminId,
      actorEmail: adminEmail,
      actorRole: 'finance_admin',
      timestamp: new Date().toISOString(),
      notes: `Payment rejected: ${reason}`,
      metadata: { reason },
    };

    await updateDoc(paymentRef, {
      status: 'PAYMENT_REJECTED',
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason,
      updatedAt: new Date().toISOString(),
      events: [...(currentData.events || []), rejectEvent],
    });

    if (currentData.bookingId) {
      await updateDoc(doc(db, 'bookings', currentData.bookingId), {
        paymentStatus: 'failed',
        rejectionReason: reason,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  async toggleReconciliation(paymentId: string, adminId: string, adminEmail: string, reconciled: boolean, notes?: string): Promise<void> {
    const paymentRef = doc(db, 'payments', paymentId);
    const snap = await getDoc(paymentRef);
    if (!snap.exists()) return;

    const currentData = snap.data() as PaymentRecord;

    const reconEvent: PaymentAuditEvent = {
      id: `evt-${Date.now()}`,
      eventType: 'RECONCILED',
      actorId: adminId,
      actorEmail: adminEmail,
      actorRole: 'finance_admin',
      timestamp: new Date().toISOString(),
      notes: reconciled ? (notes || 'Marked as reconciled with bank statement.') : 'Reconciliation status cleared.',
    };

    await updateDoc(paymentRef, {
      isReconciled: reconciled,
      reconciledAt: reconciled ? new Date().toISOString() : null,
      reconciledBy: reconciled ? adminEmail : null,
      reconciliationNotes: notes || '',
      updatedAt: new Date().toISOString(),
      events: [...(currentData.events || []), reconEvent],
    });
  }
}

export const manualBankTransferProvider = new ManualBankTransferProvider();
