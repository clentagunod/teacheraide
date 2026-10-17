import { Bell, Search } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Feedback';
import { useAuth } from '@/context/AuthContext';
import { useStaff } from '@/context/StaffContext';
import { useData } from '@/context/DataContext';
import { isOverdue } from '@/lib/analytics';
import { formatFullDate } from '@/lib/dates';
import { useLocalClock } from '@/hooks/useLocalClock';

export function Topbar() {
  const { user } = useAuth();
  const { profile } = useStaff();
  const { assignments } = useData();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const { date: today, time } = useLocalClock();

  const overdueCount = useMemo(() => assignments.filter((a) => isOverdue(a, today, time)).length, [assignments, today, time]);
  const email = user?.email ?? '';
  const name = profile?.displayName || user?.displayName || email.split('@')[0] || 'Staff';

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const q = term.trim();
    navigate(q ? `/learners?q=${encodeURIComponent(q)}` : '/learners');
  }

  return (
    <header className="topbar">
      <form className="topbar__search" onSubmit={handleSearch} role="search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={term}
          maxLength={60}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search learners"
          aria-label="Search learners"
        />
      </form>

      <p className="topbar__date">{formatFullDate(today)}</p>

      <div className="topbar__right">
        <Link
          to="/learners?filter=overdue"
          className="topbar__bell"
          aria-label={overdueCount > 0 ? `${overdueCount} overdue tasks` : 'No overdue tasks'}
          title="Overdue tasks"
        >
          <Bell size={18} aria-hidden="true" />
          {overdueCount > 0 && <span className="topbar__bell-count">{overdueCount > 99 ? '99+' : overdueCount}</span>}
        </Link>
        <div className="topbar__user">
          <div className="topbar__user-text">
            <strong>{name}</strong>
            <span>{email}</span>
          </div>
          <Avatar name={name} size={40} />
        </div>
      </div>
    </header>
  );
}
