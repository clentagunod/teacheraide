import { CalendarCheck, Check, ChevronLeft, ChevronRight, Search, UserX, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Meter } from '@/components/charts/Meter';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field } from '@/components/ui/Field';
import { Avatar, Badge, EmptyState, ErrorBanner, PageHeader, PageLoader } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { listGrades, listSections } from '@/lib/analytics';
import { addDays, formatDate, formatFullDate, isValidISODate, todayISO } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { learnerFullName, learnerLastNameFirst } from '@/lib/names';
import { getAttendance, saveAttendance } from '@/services/attendance';
import type { AttendanceStatus } from '@/types';

interface Selection {
  date: string;
  grade: number | null;
  section: string | null;
}

export default function AttendancePage() {
  const { user } = useAuth();
  const toast = useToast();
  const { learners, attendance, sections: schoolSections, loadingByResource, errorByResource } = useData();
  const today = todayISO();

  const [date, setDate] = useState(today);
  const [gradeSel, setGradeSel] = useState<number | null>(null);
  const [sectionSel, setSectionSel] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [baseline, setBaseline] = useState<Record<string, AttendanceStatus>>({});
  const [exists, setExists] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<Selection | null>(null);

  const grades = useMemo(() => listGrades(learners), [learners]);
  const grade = gradeSel !== null && grades.includes(gradeSel) ? gradeSel : grades[0] ?? null;
  const sections = useMemo(() => (grade === null ? [] : listSections(learners, grade)), [learners, grade]);
  const section = sectionSel !== null && sections.includes(sectionSel) ? sectionSel : sections[0] ?? null;
  const sectionId = schoolSections.find((item) => item.grade === grade && item.name === section)?.sectionId ?? null;

  const roster = useMemo(
    () => learners.filter((l) => l.grade === grade && l.section === section),
    [learners, grade, section],
  );

  // Load the saved record whenever the date or class changes. The roster is intentionally not a
  // dependency: adding a learner mid-edit must not wipe the marks the teacher has just made.
  useEffect(() => {
    if (loadingByResource.learners || loadingByResource.sections || !user || grade === null || section === null || sectionId === null) return undefined;
    let cancelled = false;
    setLoadingRecord(true);
    getAttendance(user, date, grade, sectionId)
      .then((record) => {
        if (cancelled) return;
        const saved = record?.records ?? {};
        setMarks(saved);
        setBaseline(saved);
        setExists(record !== null);
      })
      .catch((err) => {
        if (!cancelled) toast.notify('error', getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingRecord(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, date, grade, section, sectionId, loadingByResource.learners, loadingByResource.sections, toast]);

  const statusOf = (id: string): AttendanceStatus => marks[id] ?? 'present';
  const dirty = roster.some((l) => (marks[l.id] ?? 'present') !== (baseline[l.id] ?? 'present'));
  const canSave = roster.length > 0 && !loadingRecord && (dirty || !exists);

  const presentCount = roster.filter((l) => statusOf(l.id) === 'present').length;
  const absentCount = roster.length - presentCount;
  const rate = roster.length === 0 ? 0 : Math.round((presentCount / roster.length) * 100);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((l) => `${learnerFullName(l)} ${learnerLastNameFirst(l)}`.toLowerCase().includes(q));
  }, [roster, query]);

  const history = useMemo(
    () =>
      attendance
        .filter((r) => r.grade === grade && r.section === section)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 8)
        .map((r) => {
          const values = Object.values(r.records);
          const present = values.filter((v) => v === 'present').length;
          return { date: r.date, present, total: values.length, rate: values.length === 0 ? 0 : Math.round((present / values.length) * 100) };
        }),
    [attendance, grade, section],
  );

  function applySelection(next: Selection) {
    setDate(next.date);
    setGradeSel(next.grade);
    setSectionSel(next.section);
    setQuery('');
  }

  function requestChange(patch: Partial<Selection>) {
    const next: Selection = { date, grade, section, ...patch };
    if (dirty) setPending(next);
    else applySelection(next);
  }

  function setAll(status: AttendanceStatus) {
    setMarks((prev) => {
      const next = { ...prev };
      for (const l of roster) next[l.id] = status;
      return next;
    });
  }

  async function handleSave() {
    if (!user || grade === null || section === null || sectionId === null) return;
    if (!isValidISODate(date) || date > today) {
      toast.notify('error', 'Choose a valid date that is not in the future.');
      return;
    }
    const records: Record<string, AttendanceStatus> = {};
    for (const l of roster) records[l.id] = statusOf(l.id);

    setSaving(true);
    try {
      await saveAttendance(user, { date, grade, section, sectionId, records });
      setMarks(records);
      setBaseline(records);
      setExists(true);
      toast.notify('success', `Attendance saved for ${formatDate(date)}.`);
    } catch (err) {
      toast.notify('error', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loadingByResource.learners || loadingByResource.attendance || loadingByResource.sections) {
    return <PageLoader label="Loading attendance…" />;
  }

  const error = [
    errorByResource.learners,
    errorByResource.attendance,
    errorByResource.sections,
  ].filter((message): message is string => message !== null).join(' ') || null;

  return (
    <>
      <PageHeader title="Attendance" subtitle="Pick a date and class, then mark who is present or absent." />
      {error && <ErrorBanner message={error} />}

      {learners.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Users size={26} />} title="No learners yet" message="Add learners first, then come back to take attendance." />
        </div>
      ) : (
        <div className="attendance">
          <div className="attendance__main">
            <section className="card" aria-label="Choose date and class">
              <div className="filters">
                <Field label="Date">
                  {(p) => (
                    <div className="date-stepper">
                      <IconButton label="Previous day" onClick={() => requestChange({ date: addDays(date, -1) })}>
                        <ChevronLeft size={18} aria-hidden="true" />
                      </IconButton>
                      <input
                        {...p}
                        className="input"
                        type="date"
                        max={today}
                        value={date}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v && isValidISODate(v) && v <= today) requestChange({ date: v });
                        }}
                      />
                      <IconButton label="Next day" disabled={date >= today} onClick={() => requestChange({ date: addDays(date, 1) })}>
                        <ChevronRight size={18} aria-hidden="true" />
                      </IconButton>
                    </div>
                  )}
                </Field>
                <Field label="Grade">
                  {(p) => (
                    <select {...p} className="select" value={grade ?? ''} onChange={(e) => requestChange({ grade: Number(e.target.value), section: null })}>
                      {grades.map((g) => (
                        <option key={g} value={g}>Grade {g}</option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Section">
                  {(p) => (
                    <select {...p} className="select" value={section ?? ''} onChange={(e) => requestChange({ section: e.target.value })}>
                      {sections.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
            </section>

            <section className="card" aria-labelledby="roll-title">
              <div className="card__head">
                <div>
                  <h2 id="roll-title" className="card__title">{formatFullDate(date)}</h2>
                  <p className="card__sub">
                    Grade {grade} · {section}{' '}
                    {exists ? <Badge tone="success">Saved</Badge> : <Badge tone="warn">Not recorded yet</Badge>}
                    {dirty && <> <Badge tone="accent">Unsaved changes</Badge></>}
                  </p>
                </div>
                <div className="card__actions">
                  <Button variant="soft" size="sm" icon={<Check size={16} aria-hidden="true" />} onClick={() => setAll('present')} disabled={roster.length === 0}>
                    All present
                  </Button>
                  <Button variant="soft" size="sm" icon={<UserX size={16} aria-hidden="true" />} onClick={() => setAll('absent')} disabled={roster.length === 0}>
                    All absent
                  </Button>
                </div>
              </div>

              <div className="summary-pills">
                <span className="pill pill--success">Present <b>{presentCount}</b></span>
                <span className="pill pill--danger">Absent <b>{absentCount}</b></span>
                <span className="pill">Rate <b>{rate}%</b></span>
              </div>

              <label className="searchbox">
                <Search size={16} aria-hidden="true" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a learner" maxLength={60} aria-label="Find a learner" />
              </label>

              {loadingRecord ? (
                <PageLoader label="Loading record…" />
              ) : visible.length === 0 ? (
                <EmptyState title="No learners to show" message={roster.length === 0 ? 'This section has no learners.' : 'No one matches your search.'} />
              ) : (
                <ul className="roll">
                  {visible.map((l) => {
                    const status = statusOf(l.id);
                    const name = learnerFullName(l);
                    return (
                      <li key={l.id} className="roll__row">
                        <Avatar name={name} size={36} />
                        <span className="roll__name">{learnerLastNameFirst(l)}</span>
                        <div className="toggle" role="radiogroup" aria-label={`Attendance for ${name}`}>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={status === 'present'}
                            className={`toggle__btn ${status === 'present' ? 'is-present' : ''}`.trim()}
                            onClick={() => setMarks((m) => ({ ...m, [l.id]: 'present' }))}
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={status === 'absent'}
                            className={`toggle__btn ${status === 'absent' ? 'is-absent' : ''}`.trim()}
                            onClick={() => setMarks((m) => ({ ...m, [l.id]: 'absent' }))}
                          >
                            Absent
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="card__foot">
                <Button onClick={handleSave} loading={saving} disabled={!canSave}>
                  {exists && !dirty ? 'Saved' : 'Save attendance'}
                </Button>
              </div>
            </section>
          </div>

          <aside className="attendance__side">
            <section className="card" aria-labelledby="history-title">
              <h2 id="history-title" className="card__title">Recent records</h2>
              <p className="card__sub">Grade {grade} · {section}</p>
              {history.length === 0 ? (
                <EmptyState icon={<CalendarCheck size={22} />} title="No records yet" message="Saved days will show up here." />
              ) : (
                <ul className="history">
                  {history.map((h) => (
                    <li key={h.date}>
                      <button type="button" className={`history__item ${h.date === date ? 'is-active' : ''}`.trim()} onClick={() => requestChange({ date: h.date })}>
                        <span className="history__top"><strong>{formatDate(h.date)}</strong><span>{h.present}/{h.total}</span></span>
                        <Meter percent={h.rate} color={h.rate >= 90 ? 'var(--success)' : h.rate >= 75 ? 'var(--accent)' : 'var(--danger)'} label={`${formatDate(h.date)} attendance`} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        title="Discard unsaved changes?"
        message="You have attendance marks that have not been saved. Switching now will discard them."
        confirmLabel="Discard and switch"
        danger
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) applySelection(pending);
          setPending(null);
        }}
      />
    </>
  );
}
