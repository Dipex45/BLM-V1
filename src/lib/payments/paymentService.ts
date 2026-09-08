import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { apiPost } from '../api';
import { db } from '../firebase';
import { PaymentInitResult, PaymentProofSubmission, PaymentRecord } from './types';

class PaymentService {
  async initializePayment(booking: any): Promise<PaymentInitResult> {
    const response = await apiPost<PaymentInitResult>('/api/payment/manual/initialize', { bookingId: booking.id });
    return response.data;
  }

  async submitProof(submission: PaymentProofSubmission): Promise<void> {
    await apiPost('/api/payment/manual/proof', submission);
  }

  async verifyPayment(paymentId: string, _adminId: string, _adminEmail: string, notes?: string): Promise<void> {
    await apiPost('/api/payment/manual/review', { paymentId, decision: 'approve', reason: notes });
  }

  async rejectPayment(paymentId: string, _adminId: string, _adminEmail: string, reason: string): Promise<void> {
    await apiPost('/api/payment/manual/review', { paymentId, decision: 'reject', reason });
  }

  async getPaymentByBookingId(bookingId: string): Promise<PaymentRecord | null> {
    try {
      const snapshot = await getDocs(query(collection(db, 'payments'), where('bookingId', '==', bookingId)));
      if (!snapshot.empty) return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as PaymentRecord;
    } catch (error) {
      console.error('Error fetching payment record:', error);
    }
    return null;
  }

  async getAllPayments(): Promise<PaymentRecord[]> {
    try {
      const snapshot = await getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc')));
      return snapshot.docs.map((document) => ({ ...document.data(), id: document.id })) as PaymentRecord[];
    } catch (error) {
      console.error('Error fetching payments:', error);
      return [];
    }
  }
}

export const paymentService = new PaymentService();
