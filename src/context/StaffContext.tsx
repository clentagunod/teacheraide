import { onSnapshot } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/lib/errors';
import { staffRef } from '@/services/firestore';
import { toStaffProfile } from '@/services/mappers';
import type { StaffProfile } from '@/types';

interface StaffState {
  profile: StaffProfile | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const StaffContext = createContext<StaffState | null>(null);

export function StaffProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setError(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError(null);
    return onSnapshot(
      staffRef(user.uid),
      (snapshot) => {
        setProfile(snapshot.exists() ? toStaffProfile(snapshot) : null);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(getErrorMessage(err));
        setLoading(false);
      },
    );
  }, [user, refreshKey]);

  const value = useMemo(() => ({ profile, loading, error, refresh }), [profile, loading, error, refresh]);
  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
}

export function useStaff(): StaffState {
  const context = useContext(StaffContext);
  if (!context) throw new Error('useStaff must be used inside <StaffProvider>');
  return context;
}
