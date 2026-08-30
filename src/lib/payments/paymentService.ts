import {
  PaymentProvider,
  PaymentProviderType,
  PaymentInitResult,
  PaymentProofSubmission,
  PaymentRecord,
  BankAccountConfig,
} from './types';
import { manualBankTransferProvider } from './manualBankTransfer';
import { doc, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

class PaymentService {
  private providers: Map<PaymentProviderType, PaymentProvider> = new Map();
  private defaultProviderType: PaymentProviderType = 'manual_bank_transfer';

  constructor() {
    this.registerProvider(manualBankTransferProvider);
  }

  registerProvider(provider: PaymentProvider) {
    this.providers.set(provider.name, provider);
  }

  getProvider(name?: PaymentProviderType): PaymentProvider {
    const providerType = name || this.defaultProviderType;
    const provider = this.providers.get(providerType);
    if (!provider) {
      return manualBankTransferProvider;
    }
    return provider;
  }

  async getActiveProviderType(): Promise<PaymentProviderType> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'payment_settings'));
      if (snap.exists() && snap.data()?.activeProvider) {
        return snap.data().activeProvider as PaymentProviderType;
      }
    } catch (e) {
      console.warn('Using default payment provider');
    }
    return this.defaultProviderType;
  }

  async initializePayment(booking: any, customer: any): Promise<PaymentInitResult> {
    const activeProviderType = await this.getActiveProviderType();
    const provider = this.getProvider(activeProviderType);
    return provider.initializePayment(booking, customer);
  }

  async submitProof(submission: PaymentProofSubmission, customerId: string): Promise<void> {
    const activeProviderType = await this.getActiveProviderType();
    const provider = this.getProvider(activeProviderType);
    return provider.submitProof(submission, customerId);
  }

  async verifyPayment(paymentId: string, adminId: string, adminEmail: string, notes?: string): Promise<void> {
    const activeProviderType = await this.getActiveProviderType();
    const provider = this.getProvider(activeProviderType);
    return provider.verifyPayment(paymentId, adminId, adminEmail, notes);
  }

  async rejectPayment(paymentId: string, adminId: string, adminEmail: string, reason: string): Promise<void> {
    const activeProviderType = await this.getActiveProviderType();
    const provider = this.getProvider(activeProviderType);
    return provider.rejectPayment(paymentId, adminId, adminEmail, reason);
  }

  async getPaymentByBookingId(bookingId: string): Promise<PaymentRecord | null> {
    try {
      const snap = await getDocs(query(collection(db, 'payments'), where('bookingId', '==', bookingId)));
      if (!snap.empty) {
        return { ...snap.docs[0].data(), id: snap.docs[0].id } as PaymentRecord;
      }
    } catch (e) {
      console.error('Error fetching payment record:', e);
    }
    return null;
  }

  async getAllPayments(): Promise<PaymentRecord[]> {
    try {
      const snap = await getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc')));
      return snap.docs.map(d => ({ ...d.data(), id: d.id })) as PaymentRecord[];
    } catch (e) {
      console.error('Error fetching payments:', e);
      return [];
    }
  }
}

export const paymentService = new PaymentService();
