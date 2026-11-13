import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onIdTokenChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { apiPost, apiErrorMessage } from '../lib/api';
import { AppRole, isFederatedUser } from '../lib/authFlow';
import { logger } from '../lib/logger';

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  phone: string;
  emailVerified: boolean;
  federated: boolean;
  role: AppRole;
  firebaseUser: User;
};

type SessionResponse = { role: AppRole; fullName?: string; phone?: string; claimsUpdated?: boolean };

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  /** Set when the API could not confirm the session; the role then comes from Firestore. */
  sessionError: string | null;
  needsVerification: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Mirrors the server's role resolution using documents the user may read. */
async function readRoleFromFirestore(uid: string): Promise<AppRole> {
  const admin = await getDoc(doc(db, 'admins', uid)).catch(() => null);
  const adminRole = admin?.data()?.role;
  if (typeof adminRole === 'string') return (adminRole === 'admin' ? 'super_admin' : adminRole) as AppRole;
  const driver = await getDoc(doc(db, 'drivers', uid)).catch(() => null);
  return driver?.exists() ? 'driver' : 'customer';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const syncedFor = useRef<string | null>(null);

  const buildUser = useCallback(async (firebaseUser: User, forceSession: boolean) => {
    const federated = isFederatedUser(firebaseUser);
    const verified = firebaseUser.emailVerified || federated;
    let role: AppRole = 'customer';
    let fullName = firebaseUser.displayName || '';
    let phone = '';

    const sessionKey = `${firebaseUser.uid}:${verified}`;
    if (verified && (forceSession || syncedFor.current !== sessionKey)) {
      try {
        const { data } = await apiPost<SessionResponse>('/api/auth/session', {});
        role = data.role;
        fullName = data.fullName || fullName;
        phone = data.phone || '';
        syncedFor.current = sessionKey;
        setSessionError(null);
        if (data.claimsUpdated) {
          // New role claim: refresh the token so Storage/Firestore rules see it.
          await firebaseUser.getIdToken(true);
        }
      } catch (error) {
        logger.warn('Server session sync failed', error);
        setSessionError(apiErrorMessage(error, 'We couldn’t connect to BLM right now.'));
        role = await readRoleFromFirestore(firebaseUser.uid);
      }
    } else if (verified) {
      role = (user?.uid === firebaseUser.uid ? user.role : await readRoleFromFirestore(firebaseUser.uid));
    } else {
      role = await readRoleFromFirestore(firebaseUser.uid);
    }

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: fullName || null,
      phone,
      emailVerified: firebaseUser.emailVerified,
      federated,
      role,
      firebaseUser,
    } satisfies AppUser;
  }, [user]);

  const buildRef = useRef(buildUser);
  buildRef.current = buildUser;

  useEffect(() => {
    return onIdTokenChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        syncedFor.current = null;
        setUser(null);
        setSessionError(null);
        setLoading(false);
        return;
      }
      try {
        setUser(await buildRef.current(firebaseUser, false));
      } catch (error) {
        logger.error('Could not load the signed-in profile', error);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      logger.error('Auth state subscription error', error);
      setLoading(false);
    });
  }, []);

  const refresh = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) return;
    await current.reload();
    await current.getIdToken(true);
    setUser(await buildRef.current(auth.currentUser!, true));
  }, []);

  const signOut = useCallback(async () => {
    syncedFor.current = null;
    await firebaseSignOut(auth);
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    loading,
    sessionError,
    needsVerification: Boolean(user && !user.emailVerified && !user.federated),
    refresh,
    signOut,
  }), [user, loading, sessionError, refresh, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
