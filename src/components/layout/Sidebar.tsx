import { BookOpen, CalendarCheck, GraduationCap, LayoutDashboard, LogOut, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useStaff } from '@/context/StaffContext';
import { useToast } from '@/components/ui/Toast';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck, end: false },
  { to: '/learners', label: 'Learners', icon: Users, end: false },
  { to: '/subjects', label: 'Subjects & Tasks', icon: BookOpen, end: false },
] as const;

export function Sidebar() {
  const { signOut } = useAuth();
  const { profile } = useStaff();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
    } catch {
      toast.notify('error', 'Could not sign out. Please try again.');
      setBusy(false);
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="brand-mark" aria-hidden="true"><GraduationCap size={20} /></span>
        <span className="sidebar__brand-name">Teacher<span>.aide</span></span>
      </div>

      <nav className="sidebar__nav" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`.trim()}>
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
        {profile?.role === 'admin' && (
          <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`.trim()}>
            <ShieldCheck size={20} aria-hidden="true" />
            <span>Admin</span>
          </NavLink>
        )}
      </nav>

      <button type="button" className="nav-item nav-item--signout" onClick={handleSignOut} disabled={busy}>
        <LogOut size={20} aria-hidden="true" />
        <span>Sign out</span>
      </button>
    </aside>
  );
}
