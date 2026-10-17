import { ChevronLeft, ChevronRight, ListPlus, Pencil, Plus, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Avatar, Badge, EmptyState, ErrorBanner, PageHeader, PageLoader } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useStaff } from '@/context/StaffContext';
import { useData } from '@/context/DataContext';
import { isOverdue, listGrades, listSections } from '@/lib/analytics';
import { useLocalClock } from '@/hooks/useLocalClock';
import { getErrorMessage } from '@/lib/errors';
import { canManageSchoolRecords } from '@/lib/roles';
import { learnerFullName, learnerLastNameFirst } from '@/lib/names';
import { LearnerFormModal } from '@/features/learners/LearnerFormModal';
import { AssignModal, type AssignTarget } from '@/features/tasks/AssignModal';
import { removeLearner } from '@/services/learners';
import type { Learner } from '@/types';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'overdue' | 'unassigned';
type FormState = { mode: 'add' } | { mode: 'edit'; learnerId: string } | null;

interface Tally {
  pending: number;
  overdue: number;
  completed: number;
}

export default function LearnersPage() {
  const { user } = useAuth();
  const { profile } = useStaff();
  const manager = canManageSchoolRecords(profile?.role);
  const toast = useToast();
  const { learners, assignments, sections: schoolSections, loadingByResource, errorByResource, learnerById } = useData();
  const canAddLearner = profile?.role === 'teacher' || schoolSections.length > 0;
  const { date: today, time } = useLocalClock();
  const [params, setParams] = useSearchParams();

  // The URL is the single source of truth for the search text and status filter, so the topbar
  // search, the overdue bell, refreshes and shared links all behave the same way.
  const q = params.get('q') ?? '';
  const rawStatus = params.get('filter');
  const status: StatusFilter = rawStatus === 'overdue' || rawStatus === 'unassigned' ? rawStatus : 'all';

  const [gradeFilter, setGradeFilter] = useState<number | 'all'>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const [form, setForm] = useState<FormState>(null);
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [removing, setRemoving] = useState<Learner | null>(null);

  function updateParams(patch: { q?: string; filter?: StatusFilter }) {
    const next = new URLSearchParams(params);
    if (patch.q !== undefined) {
      if (patch.q) next.set('q', patch.q);
      else next.delete('q');
    }
    if (patch.filter !== undefined) {
      if (patch.filter === 'all') next.delete('filter');
      else next.set('filter', patch.filter);
    }
    setParams(next, { replace: true });
    setPage(1);
  }

  const grades = useMemo(() => listGrades(learners), [learners]);
  const sections = useMemo(() => listSections(learners, gradeFilter === 'all' ? null : gradeFilter), [learners, gradeFilter]);
  const effectiveSection = sectionFilter === 'all' || sections.includes(sectionFilter) ? sectionFilter : 'all';

  const tallies = useMemo(() => {
    const map = new Map<string, Tally>();
    for (const a of assignments) {
      const t = map.get(a.learnerId) ?? { pending: 0, overdue: 0, completed: 0 };
      if (a.status === 'completed') t.completed += 1;
      else if (isOverdue(a, today, time)) t.overdue += 1;
      else t.pending += 1;
      map.set(a.learnerId, t);
    }
    return map;
  }, [assignments, today, time]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return learners.filter((l) => {
      if (gradeFilter !== 'all' && l.grade !== gradeFilter) return false;
      if (effectiveSection !== 'all' && l.section !== effectiveSection) return false;
      const t = tallies.get(l.id);
      if (status === 'overdue' && !(t && t.overdue > 0)) return false;
      if (status === 'unassigned' && t) return false;
      if (term && !`${learnerFullName(l)} ${learnerLastNameFirst(l)}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [learners, q, gradeFilter, effectiveSection, status, tallies]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const filtersActive = q.trim() !== '' || gradeFilter !== 'all' || effectiveSection !== 'all' || status !== 'all';

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  async function handleRemove() {
    if (!removing) return;
    try {
      if (!user) throw new Error('Your session has expired. Sign in again.');
      await removeLearner(user, removing.id);
      toast.notify('success', `${learnerFullName(removing)} was removed.`);
      setRemoving(null);
    } catch (err) {
      toast.notify('error', getErrorMessage(err));
    }
  }

  if (loadingByResource.learners || loadingByResource.assignments || loadingByResource.sections) {
    return <PageLoader label="Loading learners…" />;
  }

  const error = [
    errorByResource.learners,
    errorByResource.assignments,
    errorByResource.sections,
  ].filter((message): message is string => message !== null).join(' ') || null;

  const editing = form?.mode === 'edit' ? learnerById.get(form.learnerId) : undefined;

  return (
    <>
      <PageHeader
        title="Learners"
        subtitle={`${learners.length} learner${learners.length === 1 ? '' : 's'} across ${listSections(learners).length} section${listSections(learners).length === 1 ? '' : 's'}`}
        actions={
          <>
            <Button variant="soft" icon={<ListPlus size={18} aria-hidden="true" />} onClick={() => setAssignTarget({ kind: 'section', grade: gradeFilter === 'all' ? null : gradeFilter, section: effectiveSection === 'all' ? null : effectiveSection })} disabled={learners.length === 0}>
              Assign to section
            </Button>
            <Button icon={<Plus size={18} aria-hidden="true" />} onClick={() => setForm({ mode: 'add' })} disabled={!canAddLearner}>Add learner</Button>
          </>
        }
      />
      {error && <ErrorBanner message={error} />}

      <section className="card">
        <div className="toolbar">
          <label className="searchbox searchbox--grow">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={q} maxLength={60} onChange={(e) => updateParams({ q: e.target.value })} placeholder="Search by name" aria-label="Search learners by name" />
          </label>
          <select className="select" aria-label="Filter by grade" value={gradeFilter} onChange={(e) => { resetPage(setGradeFilter)(e.target.value === 'all' ? 'all' : Number(e.target.value)); setSectionFilter('all'); }}>
            <option value="all">All grades</option>
            {grades.map((g) => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
          <select className="select" aria-label="Filter by section" value={effectiveSection} onChange={(e) => resetPage(setSectionFilter)(e.target.value)}>
            <option value="all">All sections</option>
            {sections.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select className="select" aria-label="Filter by task status" value={status} onChange={(e) => updateParams({ filter: e.target.value as StatusFilter })}>
            <option value="all">All statuses</option>
            <option value="overdue">Has overdue tasks</option>
            <option value="unassigned">No tasks assigned</option>
          </select>
        </div>

        {learners.length === 0 ? (
          <EmptyState
            icon={<Users size={26} />}
            title="No learners yet"
            message={canAddLearner ? 'Add your first learner to get started.' : 'Create a grade section in Administration before adding learners.'}
            action={canAddLearner ? <Button icon={<UserPlus size={18} aria-hidden="true" />} onClick={() => setForm({ mode: 'add' })}>Add learner</Button> : undefined}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search size={24} />}
            title="No learners match"
            message="Try a different search or clear the filters."
            action={
              filtersActive ? (
                <Button variant="soft" onClick={() => { updateParams({ q: '', filter: 'all' }); setGradeFilter('all'); setSectionFilter('all'); }}>Clear filters</Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table table--rows">
                <thead>
                  <tr>
                    <th>Learner</th>
                    <th>Class</th>
                    <th>Tasks</th>
                    <th className="actions-col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((l) => {
                    const t = tallies.get(l.id);
                    const name = learnerFullName(l);
                    return (
                      <tr key={l.id}>
                        <td>
                          <div className="person">
                            <Avatar name={name} />
                            <div>
                              <strong>{learnerLastNameFirst(l)}</strong>
                              <span className="person__meta">{l.gender === 'female' ? 'Female' : l.gender === 'male' ? 'Male' : 'Gender not set'}</span>
                            </div>
                          </div>
                        </td>
                        <td>Grade {l.grade} · {l.section}</td>
                        <td>
                          {!t ? (
                            <Badge>No tasks</Badge>
                          ) : (
                            <div className="badges">
                              {t.overdue > 0 && <Badge tone="danger">{t.overdue} overdue</Badge>}
                              {t.pending > 0 && <Badge tone="accent">{t.pending} pending</Badge>}
                              {t.completed > 0 && <Badge tone="success">{t.completed} done</Badge>}
                            </div>
                          )}
                        </td>
                        <td className="actions-col">
                          <div className="row-actions">
                            <IconButton label={`Assign task to ${name}`} onClick={() => setAssignTarget({ kind: 'learner', learner: l })}>
                              <ListPlus size={17} aria-hidden="true" />
                            </IconButton>
                            <IconButton label={`Edit ${name}`} onClick={() => setForm({ mode: 'edit', learnerId: l.id })}>
                              <Pencil size={17} aria-hidden="true" />
                            </IconButton>
                            {manager && (
                              <IconButton label={`Remove ${name}`} tone="danger" onClick={() => setRemoving(l)}>
                                <Trash2 size={17} aria-hidden="true" />
                              </IconButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pager">
              <span>
                Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="pager__buttons">
                <IconButton label="Previous page" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                  <ChevronLeft size={18} aria-hidden="true" />
                </IconButton>
                <span>Page {safePage} of {pageCount}</span>
                <IconButton label="Next page" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>
                  <ChevronRight size={18} aria-hidden="true" />
                </IconButton>
              </div>
            </div>
          </>
        )}
      </section>

      {form?.mode === 'add' && (
        <LearnerFormModal
          defaults={{ grade: gradeFilter === 'all' ? null : gradeFilter, section: effectiveSection === 'all' ? '' : effectiveSection }}
          onClose={() => setForm(null)}
        />
      )}
      {editing && <LearnerFormModal learner={editing} onClose={() => setForm(null)} />}
      {assignTarget && <AssignModal target={assignTarget} onClose={() => setAssignTarget(null)} />}

      <ConfirmDialog
        open={removing !== null}
        title="Remove learner?"
        message={
          removing && (
            <>
              <strong>{learnerFullName(removing)}</strong> and all of their assigned tasks will be permanently removed. Past attendance marks stay in the records but no longer count in reports.
            </>
          )
        }
        confirmLabel="Remove learner"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={handleRemove}
      />
    </>
  );
}
