import { AlertTriangle, CalendarCheck, ClipboardList, Users } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AreaChart, type AreaPoint } from '@/components/charts/AreaChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { Meter } from '@/components/charts/Meter';
import { Button } from '@/components/ui/Button';
import { Avatar, Badge, EmptyState, ErrorBanner, PageHeader, PageLoader, SegmentedControl } from '@/components/ui/Feedback';
import { useData } from '@/context/DataContext';
import {
  buildAttendanceTrend,
  buildGroupSummary,
  countStatuses,
  inScope,
  isOverdue,
  listGrades,
  listSections,
} from '@/lib/analytics';
import { diffInDays, formatShortDate, formatWeekday } from '@/lib/dates';
import { learnerFullName } from '@/lib/names';
import { subjectColor } from '@/lib/subjectColors';
import { useLocalClock } from '@/hooks/useLocalClock';
import type { Scope } from '@/types';

type ScopeMode = 'all' | 'grade' | 'section';
type GroupBy = 'section' | 'grade';

const MODE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'grade', label: 'Grade' },
  { value: 'section', label: 'Section' },
] as const;

const GROUP_OPTIONS = [
  { value: 'section', label: 'By section' },
  { value: 'grade', label: 'By grade' },
] as const;

const RANGE_OPTIONS = [7, 14, 30] as const;

function StatCard({ icon, label, value, note, tone }: { icon: ReactNode; label: string; value: string; note: string; tone?: 'danger' }) {
  return (
    <div className="card stat">
      <span className={`stat__icon ${tone === 'danger' ? 'stat__icon--danger' : ''}`.trim()} aria-hidden="true">{icon}</span>
      <p className="stat__label">{label}</p>
      <p className="stat__value">{value}</p>
      <p className={`stat__note ${tone === 'danger' ? 'stat__note--danger' : ''}`.trim()}>{note}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { learners, assignments, attendance, subjects, loadingByResource, errorByResource, learnerById, taskById, subjectById } = useData();
  const navigate = useNavigate();
  const { date: today, time } = useLocalClock();

  const [mode, setMode] = useState<ScopeMode>('all');
  const [gradeSel, setGradeSel] = useState<number | null>(null);
  const [sectionSel, setSectionSel] = useState<string | null>(null);
  const [range, setRange] = useState<number>(7);
  const [groupBy, setGroupBy] = useState<GroupBy>('section');

  const grades = useMemo(() => listGrades(learners), [learners]);
  const grade = mode === 'all' ? null : gradeSel !== null && grades.includes(gradeSel) ? gradeSel : grades[0] ?? null;
  const sections = useMemo(() => (grade === null ? [] : listSections(learners, grade)), [learners, grade]);
  const section = mode === 'section' ? (sectionSel !== null && sections.includes(sectionSel) ? sectionSel : sections[0] ?? null) : null;

  const scope = useMemo<Scope>(() => ({ grade, section }), [grade, section]);
  const scopedLearners = useMemo(() => learners.filter((l) => inScope(l, scope)), [learners, scope]);
  const learnerIds = useMemo(() => new Set(scopedLearners.map((l) => l.id)), [scopedLearners]);
  const scopedAssignments = useMemo(() => assignments.filter((a) => learnerIds.has(a.learnerId)), [assignments, learnerIds]);

  const counts = useMemo(() => countStatuses(scopedAssignments, today, time), [scopedAssignments, today, time]);
  const rows = useMemo(() => buildGroupSummary(scopedLearners, scopedAssignments, today, groupBy, time), [scopedLearners, scopedAssignments, today, groupBy, time]);
  const trend = useMemo(() => buildAttendanceTrend(attendance, learnerIds, scope, range, today), [attendance, learnerIds, scope, range, today]);

  const todayPoint = trend.find((p) => p.date === today);
  const assignedLearners = rows.reduce((sum, r) => sum + r.assigned, 0);
  const notAssignedLearners = rows.reduce((sum, r) => sum + r.notAssigned, 0);
  const active = counts.pending + counts.overdue;

  const overdueList = useMemo(
    () =>
      scopedAssignments
        .filter((a) => isOverdue(a, today, time))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.dueTime.localeCompare(b.dueTime))
        .slice(0, 6),
    [scopedAssignments, today, time],
  );

  const bySubject = useMemo(() => {
    const tally = new Map<string, number>();
    for (const a of scopedAssignments) tally.set(a.subjectId, (tally.get(a.subjectId) ?? 0) + 1);
    return [...tally.entries()]
      .map(([id, count]) => ({ id, count, subject: subjectById.get(id) }))
      .filter((x) => x.subject)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [scopedAssignments, subjectById]);
  const maxSubjectCount = Math.max(1, ...bySubject.map((s) => s.count));

  const chartData: AreaPoint[] = trend.map((p) => ({
    label: range <= 7 ? formatWeekday(p.date) : formatShortDate(p.date),
    value: p.rate,
    caption: `${formatWeekday(p.date)}, ${formatShortDate(p.date)} · ${p.present}/${p.present + p.absent}`,
  }));

  const scopeLabel =
    scope.section !== null ? `Grade ${scope.grade} · ${scope.section}` : scope.grade !== null ? `Grade ${scope.grade}` : 'All learners';

  if (
    loadingByResource.learners
    || loadingByResource.assignments
    || loadingByResource.attendance
    || loadingByResource.subjects
    || loadingByResource.tasks
  ) return <PageLoader label="Loading your dashboard…" />;

  const error = [
    errorByResource.learners,
    errorByResource.assignments,
    errorByResource.attendance,
    errorByResource.subjects,
    errorByResource.tasks,
  ].filter((message): message is string => message !== null).join(' ') || null;

  const isEmpty = learners.length === 0;

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Overview of ${scopeLabel.toLowerCase()}`} />
      {error && <ErrorBanner message={error} />}

      {isEmpty ? (
        <div className="card">
          <EmptyState
            icon={<Users size={26} />}
            title="No learners yet"
            message="Add your first learners to start tracking attendance and tasks."
            action={<Button onClick={() => navigate('/learners')}>Go to Learners</Button>}
          />
        </div>
      ) : (
        <div className="dash">
          <div className="dash__main">
            <div className="stat-grid">
              <StatCard icon={<Users size={18} />} label="Learners" value={String(scopedLearners.length)} note={`${notAssignedLearners} not assigned`} />
              <StatCard
                icon={<CalendarCheck size={18} />}
                label="Attendance today"
                value={todayPoint ? `${todayPoint.rate}%` : '—'}
                note={todayPoint ? `${todayPoint.absent} absent` : 'Not recorded yet'}
              />
              <StatCard icon={<ClipboardList size={18} />} label="Active tasks" value={String(active)} note={`${counts.completed} completed`} />
              <StatCard
                icon={<AlertTriangle size={18} />}
                label="Overdue"
                value={String(counts.overdue)}
                note={counts.overdue === 0 ? 'All on track' : 'Needs follow-up'}
                tone={counts.overdue > 0 ? 'danger' : undefined}
              />
            </div>

            <section className="card" aria-labelledby="trend-title">
              <div className="card__head">
                <h2 id="trend-title" className="card__title">Class attendance</h2>
                <select className="select select--pill" value={range} onChange={(e) => setRange(Number(e.target.value))} aria-label="Attendance period">
                  {RANGE_OPTIONS.map((r) => (
                    <option key={r} value={r}>Last {r} days</option>
                  ))}
                </select>
              </div>
              {chartData.length === 0 ? (
                <EmptyState
                  icon={<CalendarCheck size={24} />}
                  title="No attendance in this period"
                  message="Record attendance to see the trend."
                  action={<Link to="/attendance" className="btn btn--soft btn--sm">Take attendance</Link>}
                />
              ) : (
                <AreaChart data={chartData} ariaLabel={`Attendance rate for ${scopeLabel}, last ${range} days`} />
              )}
            </section>

            <section className="card" aria-labelledby="group-title">
              <div className="card__head">
                <div>
                  <h2 id="group-title" className="card__title">Assigned vs not assigned</h2>
                  <p className="card__sub">“Assigned” means the learner has at least one task.</p>
                </div>
                <SegmentedControl label="Group by" value={groupBy} options={GROUP_OPTIONS} onChange={setGroupBy} />
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{groupBy === 'section' ? 'Section' : 'Grade'}</th>
                      <th className="num">Learners</th>
                      <th className="num">Assigned</th>
                      <th className="num">Not assigned</th>
                      <th className="num">Overdue</th>
                      <th>Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const pct = r.learners === 0 ? 0 : Math.round((r.assigned / r.learners) * 100);
                      return (
                        <tr key={r.key}>
                          <td><strong>{r.label}</strong></td>
                          <td className="num">{r.learners}</td>
                          <td className="num">{r.assigned}</td>
                          <td className="num">{r.notAssigned > 0 ? <Badge tone="warn">{r.notAssigned}</Badge> : 0}</td>
                          <td className="num">{r.overdue > 0 ? <Badge tone="danger">{r.overdue}</Badge> : 0}</td>
                          <td className="coverage">
                            <Meter percent={pct} label={`${r.label} coverage`} />
                            <span>{pct}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td className="num">{scopedLearners.length}</td>
                      <td className="num">{assignedLearners}</td>
                      <td className="num">{notAssignedLearners}</td>
                      <td className="num">{counts.overdue}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </div>

          <div className="dash__side">
            <section className="card card--hero" aria-labelledby="scope-title">
              <div className="card__head">
                <h2 id="scope-title" className="card__title">View</h2>
                <SegmentedControl label="Overview scope" value={mode} options={MODE_OPTIONS} onChange={setMode} />
              </div>
              <p className="hero__text">
                {mode === 'all' && 'Showing every grade and section.'}
                {mode === 'grade' && 'Showing all sections of one grade.'}
                {mode === 'section' && 'Showing a single section.'}
              </p>
              {mode !== 'all' && (
                <div className="hero__selects">
                  <select className="select" value={grade ?? ''} onChange={(e) => { setGradeSel(Number(e.target.value)); setSectionSel(null); }} aria-label="Grade">
                    {grades.map((g) => (
                      <option key={g} value={g}>Grade {g}</option>
                    ))}
                  </select>
                  {mode === 'section' && (
                    <select className="select" value={section ?? ''} onChange={(e) => setSectionSel(e.target.value)} aria-label="Section">
                      {sections.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              <p className="hero__count"><strong>{scopedLearners.length}</strong> learners · <strong>{counts.total}</strong> tasks</p>
              <Button className="btn--block" onClick={() => navigate('/learners')}>Manage learners</Button>
            </section>

            <section className="card" aria-labelledby="status-title">
              <h2 id="status-title" className="card__title">Task status</h2>
              <div className="donut-row">
                <DonutChart
                  ariaLabel={`Tasks: ${counts.completed} completed, ${counts.pending} pending, ${counts.overdue} overdue`}
                  segments={[
                    { label: 'Completed', value: counts.completed, color: 'var(--success)' },
                    { label: 'Pending', value: counts.pending, color: 'var(--accent)' },
                    { label: 'Overdue', value: counts.overdue, color: 'var(--danger)' },
                  ]}
                >
                  <strong>{counts.total}</strong>
                  <span>tasks</span>
                </DonutChart>
                <ul className="legend">
                  <li><i style={{ background: 'var(--success)' }} />Completed <b>{counts.completed}</b></li>
                  <li><i style={{ background: 'var(--accent)' }} />Pending <b>{counts.pending}</b></li>
                  <li><i style={{ background: 'var(--danger)' }} />Overdue <b>{counts.overdue}</b></li>
                </ul>
              </div>
              {bySubject.length > 0 && (
                <div className="subject-bars">
                  <h3 className="card__subtitle">Tasks by subject</h3>
                  {bySubject.map(({ id, count, subject }) => (
                    <div key={id} className="subject-bar">
                      <div className="subject-bar__top"><span>{subject?.name}</span><b>{count}</b></div>
                      <Meter percent={(count / maxSubjectCount) * 100} color={subjectColor(subject?.color ?? 'violet').solid} label={`${subject?.name} tasks`} />
                    </div>
                  ))}
                </div>
              )}
              {subjects.length === 0 && <p className="muted">Add subjects to see a breakdown.</p>}
            </section>

            <section className="card" aria-labelledby="overdue-title">
              <div className="card__head">
                <h2 id="overdue-title" className="card__title">Overdue tasks</h2>
                {counts.overdue > 0 && <Link to="/learners?filter=overdue" className="link-btn">View all</Link>}
              </div>
              {overdueList.length === 0 ? (
                <p className="muted">Nothing overdue. Nice work!</p>
              ) : (
                <ul className="list">
                  {overdueList.map((a) => {
                    const learner = learnerById.get(a.learnerId);
                    const task = taskById.get(a.taskId);
                    const name = learner ? learnerFullName(learner) : 'Unknown learner';
                    const late = diffInDays(a.dueDate, today);
                    return (
                      <li key={a.id} className="list__item">
                        <Avatar name={name} size={34} />
                        <div className="list__text">
                          <strong>{name}</strong>
                          <span>{task?.title ?? 'Removed task'}</span>
                        </div>
                        <Badge tone="danger">{late === 0 ? 'Due time passed' : `${late}d late`}</Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
