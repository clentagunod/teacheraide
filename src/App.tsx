import { lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/ui/Feedback';
import { useAuth } from '@/context/AuthContext';
import { DataProvider } from '@/context/DataContext';
import { StaffProvider, useStaff } from '@/context/StaffContext';
import { SetupNotice } from '@/features/auth/SetupNotice';

// Pages are code-split so the login screen stays small and fast.
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const AttendancePage = lazy(() => import('@/features/attendance/AttendancePage'));
const LearnersPage = lazy(() => import('@/features/learners/LearnersPage'));
const SubjectsPage = lazy(() => import('@/features/subjects/SubjectsPage'));
const AdminPage = lazy(() => import('@/features/admin/AdminPage'));

/** Blocks everything behind sign-in and mounts the realtime data layer once per session. */
function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

  return (
    <StaffProvider key={user.uid}>
      <AuthorizedApp />
    </StaffProvider>
  );
}

function AuthorizedApp() {
  const { profile, loading: staffLoading, error } = useStaff();

  if (staffLoading) return <PageLoader label="Checking your account…" />;
  if (error) return <SetupNotice error={error} />;
  if (!profile) return <SetupNotice />;

  return (
    <DataProvider>
      <AppShell />
    </DataProvider>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<RequireAuth />}>
        <Route index element={<DashboardPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="learners" element={<LearnersPage />} />
        <Route path="subjects" element={<SubjectsPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LoginRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  if (loading) return <PageLoader label="Checking your session…" />;
  if (user) return <Navigate to={from && from.startsWith('/') ? from : '/'} replace />;
  return <LoginPage />;
}
