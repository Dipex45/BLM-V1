import React, { useState, useEffect, createContext, useContext } from 'react';
import { auth, db } from '../lib/firebase';
import { onIdTokenChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { logger } from '../lib/logger';
import { getAuthenticatedRole, isFederatedUser } from '../lib/authFlow';

interface AuthContextType {
  user: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          const userData = userDoc.exists() ? userDoc.data() : {};
          let role = String(userData.role || 'customer');

          if (firebaseUser.emailVerified || isFederatedUser(firebaseUser)) {
            try {
              role = await getAuthenticatedRole(firebaseUser);
            } catch (error) {
              logger.warn('Server session sync failed', error);
            }
          }

          setUser({
            ...userData,
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || userData.fullName || null,
            emailVerified: firebaseUser.emailVerified,
            isAnonymous: firebaseUser.isAnonymous,
            providerData: firebaseUser.providerData,
            role,
          });
          logger.info('Authentication state synchronized', { uid: firebaseUser.uid });
        } catch (error) {
          logger.error("Error fetching user profile:", error);
          setUser(firebaseUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    }, (error) => {
      logger.error('Auth state change subscription error', error);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
