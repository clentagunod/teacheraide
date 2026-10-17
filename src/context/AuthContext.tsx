import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth, isFirebaseConfigured } from '@/lib/firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  sendReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return undefined;
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string, remember: boolean) => {
    // Session persistence by default: the sign-in ends when the tab closes (safer on shared computers).
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signOut = useCallback(() => firebaseSignOut(auth), []);
  const sendReset = useCallback((email: string) => sendPasswordResetEmail(auth, email.trim()), []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, signOut, sendReset }),
    [user, loading, signIn, signOut, sendReset],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** The signed-in staff member's uid. Only call from routes behind the auth guard. */
export function useUid(): string {
  const { user } = useAuth();
  if (!user) throw new Error('useUid requires a signed-in user');
  return user.uid;
}
