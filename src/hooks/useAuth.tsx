import React, { useState, useEffect, createContext, useContext } from 'react';
import { auth, db } from '../lib/firebase';
import { onIdTokenChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { logger } from '../lib/logger';
import { apiPost } from '../lib/api';

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
          let userData = userDoc.exists() ? userDoc.data() : {};
          
          // Check if user is in the admins collection
          const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
          if (adminDoc.exists()) {
            const adminData = adminDoc.data();
            userData.role = adminData.role || 'super_admin';
          }

          setUser({ ...firebaseUser, ...userData });
          apiPost('/api/auth/session', {}).catch((error) => {
            logger.warn('Server session sync failed', error);
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
