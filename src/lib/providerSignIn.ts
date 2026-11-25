import { useEffect, useState } from 'react';
import { getRedirectResult, GoogleAuthProvider, OAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth } from './firebase';
import { ensureCustomerProfile, getProviderAuthError } from './authFlow';

export type ProviderName = 'Google' | 'Apple';

const PENDING_KEY = 'blm-provider-signin';

/**
 * Full-page sign-in only works when Firebase's sign-in pages are on this site's own address
 * (VITE_FIREBASE_AUTH_DOMAIN, proxied by vercel.json). Otherwise browsers block the result,
 * so we fall back to a popup.
 */
const usesFullPageSignIn = () => auth.config.authDomain === window.location.host;

function buildProvider(name: ProviderName) {
  if (name === 'Google') {
    const google = new GoogleAuthProvider();
    google.setCustomParameters({ prompt: 'select_account' });
    return google;
  }
  const apple = new OAuthProvider('apple.com');
  apple.addScope('email');
  apple.addScope('name');
  return apple;
}

async function startProviderSignIn(name: ProviderName, returnTo?: string) {
  const provider = buildProvider(name);
  if (usesFullPageSignIn()) {
    sessionStorage.setItem(PENDING_KEY, name);
    // The page is about to leave, which loses the router's memory of where the customer was going.
    if (returnTo) sessionStorage.setItem('blm-return-to', returnTo);
    await signInWithRedirect(auth, provider);
    return;
  }
  const result = await signInWithPopup(auth, provider);
  await ensureCustomerProfile(result.user, `${name} customer`).catch(() => undefined);
}

async function finishReturningSignIn(): Promise<string | null> {
  const name = sessionStorage.getItem(PENDING_KEY) as ProviderName | null;
  if (!name) return null;
  sessionStorage.removeItem(PENDING_KEY);
  try {
    const result = await getRedirectResult(auth);
    if (result) await ensureCustomerProfile(result.user, `${name} customer`).catch(() => undefined);
    return null;
  } catch (error) {
    return getProviderAuthError(name, (error as { code?: string })?.code);
  }
}

let finished: Promise<string | null> | null = null;

/** Finishes a full-page sign-in, once per page load, and gives back an error message, if any. */
export function finishProviderSignIn() {
  finished ??= finishReturningSignIn().catch(() => null);
  return finished;
}

/** Shared by the sign-in and register pages. */
export function useProviderSignIn(onError: (message: string) => void, returnTo?: string) {
  const [provider, setProvider] = useState<ProviderName | null>(null);

  useEffect(() => {
    void finishProviderSignIn().then((message) => message && onError(message));
    // Pressing Back from Google can restore this page exactly as it was, spinner included.
    const reset = (event: PageTransitionEvent) => { if (event.persisted) setProvider(null); };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (name: ProviderName) => {
    onError('');
    setProvider(name);
    try {
      await startProviderSignIn(name, returnTo);
    } catch (error) {
      sessionStorage.removeItem(PENDING_KEY);
      onError(getProviderAuthError(name, (error as { code?: string })?.code));
      setProvider(null);
    }
  };

  return { provider, signIn };
}
