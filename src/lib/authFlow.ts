import { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export type AppRole = 'super_admin' | 'dispatcher' | 'finance_admin' | 'customer_support_agent' | 'driver' | 'customer';

export const STAFF_ROLES: AppRole[] = ['super_admin', 'dispatcher', 'finance_admin', 'customer_support_agent'];

export const isStaffRole = (role?: string | null) => STAFF_ROLES.includes(role as AppRole) || role === 'admin';

export const landingPathForRole = (role?: string | null) =>
  isStaffRole(role) ? '/admin' : role === 'driver' ? '/driver' : '/dashboard';

export const isFederatedUser = (user: Pick<User, 'providerData'>) =>
  user.providerData.some((provider) => provider.providerId === 'google.com' || provider.providerId === 'apple.com');

/** Creates the customer's own profile document (rules only allow role "customer"). */
export async function ensureCustomerProfile(user: User, fallbackName: string) {
  const profileRef = doc(db, 'users', user.uid);
  const profile = await getDoc(profileRef);
  if (profile.exists()) return;
  await setDoc(profileRef, {
    uid: user.uid,
    fullName: user.displayName || fallbackName,
    email: user.email || '',
    role: 'customer',
    authProviders: user.providerData.map((provider) => provider.providerId),
    createdAt: serverTimestamp(),
  });
}

/** Return URL for links inside Firebase verification and password-reset emails. */
export const authContinueUrl = () => ({ url: `${window.location.origin}/login`, handleCodeInApp: false });

export function getEmailAuthError(code?: string) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'Wrong email or password. Please check and try again.';
    case 'auth/email-already-in-use':
      return 'There’s already an account with this email. Sign in instead, or reset your password.';
    case 'auth/weak-password':
      return 'Your password needs at least 8 characters, including a letter and a number.';
    case 'auth/too-many-requests':
      return 'Too many tries. Please wait a few minutes or reset your password.';
    case 'auth/user-disabled':
      return 'This account has been turned off. Please contact BLM.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    case 'auth/network-request-failed':
      return 'No internet connection. Please check your connection and try again.';
    case 'auth/operation-not-allowed':
      return 'Signing in with email isn’t switched on yet. Please contact BLM, or try Google instead.';
    case 'auth/unauthorized-continue-uri':
    case 'auth/unauthorized-domain':
      return 'Sign-in isn’t set up for this web address yet. Please contact BLM.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export function getProviderAuthError(providerName: string, code?: string) {
  switch (code) {
    case 'auth/popup-blocked':
      return `Your browser blocked the ${providerName} window. Allow pop-ups for this site and try again.`;
    case 'auth/popup-closed-by-user':
      return `${providerName} sign-in was closed before it finished.`;
    case 'auth/cancelled-popup-request':
      return 'A sign-in window is already open. Finish or close it, then try again.';
    case 'auth/account-exists-with-different-credential':
      return 'This email is already used with a different sign-in option. Please sign in that way.';
    case 'auth/network-request-failed':
      return 'No internet connection. Please check your connection and try again.';
    case 'auth/unauthorized-domain':
      return `${providerName} sign-in isn’t set up for this web address yet. Please contact BLM.`;
    case 'auth/operation-not-allowed':
      return `${providerName} sign-in isn’t available yet. Please use another option or contact BLM.`;
    default:
      return `${providerName} sign-in didn’t work. Please try again or use another option.`;
  }
}

/** Password policy shown live on the registration form. */
export const passwordChecks = (password: string) => [
  { label: 'At least 8 characters', ok: password.length >= 8 },
  { label: 'Contains a letter', ok: /[a-z]/i.test(password) },
  { label: 'Contains a number', ok: /\d/.test(password) },
];
