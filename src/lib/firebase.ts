import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import fileConfig from '../../firebase-applet-config.json';

// VITE_FIREBASE_* env vars override the checked-in config. The server resolves the
// project and Firestore database the same way, so both sides always agree.
const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || fileConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || fileConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || fileConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || fileConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || fileConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || fileConfig.appId,
};
const databaseId = env.VITE_FIRESTORE_DATABASE_ID || fileConfig.firestoreDatabaseId || '(default)';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
void setPersistence(auth, browserLocalPersistence);
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true }, databaseId);
export const storage = getStorage(app);
