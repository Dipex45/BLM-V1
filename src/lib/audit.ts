import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export enum AuditAction {
  CREATE_BOOKING = 'CREATE_BOOKING',
  UPDATE_BOOKING = 'UPDATE_BOOKING',
  DELETE_BOOKING = 'DELETE_BOOKING',
  UPDATE_SETTING = 'UPDATE_SETTING',
  ADMIN_LOGIN = 'ADMIN_LOGIN',
}

export async function logAudit(userId: string, userEmail: string, action: AuditAction, details: any) {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      userId,
      userEmail,
      action,
      details,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Audit logging failed:', error);
  }
}
