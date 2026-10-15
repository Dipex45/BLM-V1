import { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { apiPost } from './api';
import { db } from './firebase';

const adminRoles = new Set(['admin', 'super_admin', 'dispatcher', 'finance_admin', 'customer_support_agent']);
let recentSession: { uid: string; expiresAt: number; promise: Promise<string> } | null = null;

export const isFederatedUser = (user: Pick<User, 'providerData'>) =>
  user.providerData.some((provider) => provider.providerId === 'google.com' || provider.providerId === 'apple.com');

export async function ensureCustomerProfile(user: User, fallbackName: string) {
  const profileRef = doc(db, 'users', user.uid);
  const profile = await getDoc(profileRef);
  if (profile.exists()) return profile.data();

  const data = {
    uid: user.uid,
    fullName: user.displayName || fallbackName,
    email: user.email || '',
    role: 'customer',
    authProviders: user.providerData.map((provider) => provider.providerId),
    createdAt: new Date().toISOString(),
  };
  await setDoc(profileRef, data, { merge: true });
  return data;
}

export async function getAuthenticatedLandingPath(user: User) {
  try {
    const role = await getAuthenticatedRole(user);
    if (adminRoles.has(role)) return '/admin';
    return '/dashboard';
  } catch {
    const profile = await getDoc(doc(db, 'users', user.uid));
    return adminRoles.has(String(profile.data()?.role || 'customer')) ? '/admin' : '/dashboard';
  }
}

export function getAuthenticatedRole(user: User) {
  const now = Date.now();
  if (recentSession?.uid === user.uid && recentSession.expiresAt > now) {
    return recentSession.promise;
  }

  const promise = apiPost<{ role: string }>('/api/auth/session', {}).then((response) => response.data.role || 'customer');
  recentSession = { uid: user.uid, expiresAt: now + 5_000, promise };
  return promise;
}

export function getProviderAuthError(providerName: string, code?: string) {
  switch (code) {
    case 'auth/popup-blocked':
      return `${providerName} sign-in was blocked by the browser. Allow popups for this site and try again.`;
    case 'auth/popup-closed-by-user':
      return `${providerName} sign-in was cancelled before it completed.`;
    case 'auth/cancelled-popup-request':
      return 'Another sign-in window is already open. Complete or close it, then try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists for this email using another sign-in method. Sign in with that method first.';
    case 'auth/network-request-failed':
      return 'Network connection error. Check your connection and try again.';
    case 'auth/unauthorized-domain':
      return `${providerName} sign-in is not authorized for this website domain. Contact BLM support.`;
    case 'auth/operation-not-allowed':
      return `${providerName} sign-in is not enabled yet. Contact BLM support or use email and password.`;
    default:
      return `${providerName} sign-in could not be completed. Try again or use email and password.`;
  }
}
