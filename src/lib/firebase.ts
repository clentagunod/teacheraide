import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;

const REQUIRED_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

/** Names of required env variables that are missing; empty when configured. */
export const missingFirebaseEnv = REQUIRED_KEYS.filter((key) => !env[key]);
export const isFirebaseConfigured = missingFirebaseEnv.length === 0;

export const firebaseConfig: FirebaseOptions = isFirebaseConfigured
  ? {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    }
  : // Placeholder values so the module loads; the app shows a setup screen instead of using them.
    { apiKey: 'not-configured', projectId: 'not-configured', appId: 'not-configured' };

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Default (memory) cache on purpose: no learner data is persisted in the browser's
// IndexedDB, which matters on shared school computers.
export const db = getFirestore(app);
