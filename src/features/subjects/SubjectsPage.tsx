import { BookOpen, ListPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge, EmptyState, ErrorBanner, PageHeader, PageLoader } from '@/components/ui/Feedback';
import { Field } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useStaff } from '@/context/StaffContext';
import { useData } from '@/context/DataContext';
import { isOverdue } from '@/lib/analytics';
import { useLocalClock } from '@/hooks/useLocalClock';
import { getErrorMessage } from '@/lib/errors';
import { canManageSchoolRecords } from '@/lib/roles';
import { SUBJECT_COLOR_KEYS, validateSubject } from '@/lib/validation';
import { SUBJECT_COLORS, subjectColor } from '@/lib/subjectColors';
import { TaskFormModal } from '@/features/subjects/TaskFormModal';
import { AssignModal } from '@/features/tasks/AssignModal';
import { addSubject, removeSubject, removeTask } from '@/services/catalog';
import type { Subject, SubjectColor, Task } from '@/types';

export default function SubjectsPage() {
  const { user } = useAuth();
  const { profile } = useStaff();
  const manager = canManageSchoolRecords(profile?.role);
  const toast = useToast();
  const { subjects, tasks, assignments, staff, loadingByResource, errorByResource } = useData();
  const { date: today, time } = useLocalClock();

  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState<SubjectColor>('violet');
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [subjectBusy, setSubjectBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<{ task?: Task } | null>(null);
  const [assignTaskId, setAssignTaskId] = useState<string | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);

  const visibleSubjects = profile?.role === 'teacher' ? subjects.filter((s) => s.id === profile.subjectId) : subjects;
  const selected = visibleSubjects.find((s) => s.id === selectedId) ?? visibleSubjects[0];
  const selectedTasks = useMemo(
    () => tasks.filter((task) => task.subjectId === selected?.id && (task.active || manager)),
    [tasks, selected, manager],
  );
  const activeTaskCount = selectedTasks.filter((task) => task.active).length;

  const taskCountBySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (t.active) map.set(t.subjectId, (map.get(t.subjectId) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  const assignmentStats = useMemo(() => {
    const map = new Map<string, { total: number; overdue: number }>();
    for (const a of assignments) {
      const s = map.get(a.taskId) ?? { total: 0, overdue: 0 };
      s.total += 1;
      if (isOverdue(a, today, time)) s.overdue += 1;
      map.set(a.taskId, s);
    }
    return map;
  }, [assignments, today, time]);

  const loading = loadingByResource.subjects
    || loadingByResource.tasks
    || loadingByResource.assignments
    || loadingByResource.staff;
  const error = [
    errorByResource.subjects,
    errorByResource.tasks,
    errorByResource.assignments,
    errorByResource.staff,
  ].filter((message): message is string => message !== null).join(' ') || null;

  async function handleAddSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || subjectBusy) return;
    const result = validateSubject({ name: newSubjectName, color: newSubjectColor }, subjects.map((item) => item.name));
    if (!result.valid) {
      setSubjectError(result.errors.name ?? 'Enter a valid subject name.');
      return;
    }
    setSubjectBusy(true);
    setSubjectError(null);
    try {
      await addSubject(user, result.value);
      setNewSubjectName('');
      toast.notify('success', `${result.value.name} was added.`);
    } catch (err) {
      setSubjectError(getErrorMessage(err));
    } finally {
      setSubjectBusy(false);
    }
  }

  async function handleDeleteSubject() {
    if (!user || !deletingSubject) return;
    if (tasks.some((task) => task.subjectId === deletingSubject.id)
      || assignments.some((assignment) => assignment.subjectId === deletingSubject.id)
      || staff.some((person) => person.subjectId === deletingSubject.id)) {
      toast.notify('error', 'This subject is still used by a teacher, task, or learner assignment. Remove those references before deleting it.');
      setDeletingSubject(null);
      return;
    }
    try {
      const result = await removeSubject(deletingSubject.id);
      toast.notify('success', 'Subject deleted.');
      if (result.auditWarning) toast.notify('info', result.auditWarning);
      setDeletingSubject(null);
    } catch (err) {
      toast.notify('error', getErrorMessage(err));
    }
  }

  async function handleDeleteTask() {
    if (!user || !profile || !deletingTask) return;
    try {
      const result = await removeTask(user, deletingTask.id, profile);
      setDeletingTask(null);
      toast.notify('success', 'Task deleted.');
      if (result.auditWarning) toast.notify('info', result.auditWarning);
    } catch (err) {
      toast.notify('error', getErrorMessage(err));
    }
  }

  if (loading) return <PageLoader label="Loading subjects…" />;

  const taskAssignmentCount = deletingTask ? assignmentStats.get(deletingTask.id)?.total ?? 0 : 0;

  return (
    <>
      <PageHeader
        title="Subjects & Tasks"
        subtitle="Manage subjects, add tasks to them, then assign tasks to learners."
      />
      {error && <ErrorBanner message={error} />}

      {manager && (
        <section className="card subjects__admin" aria-labelledby="add-subject-title">
          <div className="card__head">
            <div>
              <h2 id="add-subject-title" className="card__title">Add subject</h2>
              <p className="card__sub">Subjects with teachers, tasks, or assignments cannot be deleted.</p>
            </div>
          </div>
          <form className="form" onSubmit={handleAddSubject}>
            <div className="form__row">
              <Field label="Subject name">
                {(p) => <input {...p} className="input" value={newSubjectName} maxLength={40} onChange={(event) => setNewSubjectName(event.target.value)} placeholder="e.g. History" />}
              </Field>
              <Field label="Color">
                {(p) => (
                  <select {...p} className="select" value={newSubjectColor} onChange={(event) => {
                    const color = SUBJECT_COLOR_KEYS.find((item) => item === event.target.value);
                    if (color) setNewSubjectColor(color);
                  }}>
                    {SUBJECT_COLOR_KEYS.map((color) => <option key={color} value={color}>{SUBJECT_COLORS[color].label}</option>)}
                  </select>
                )}
              </Field>
            </div>
            {subjectError && <div className="banner banner--error" role="alert">{subjectError}</div>}
            <Button type="submit" icon={<Plus size={18} aria-hidden="true" />} loading={subjectBusy}>Add subject</Button>
          </form>
        </section>
      )}

      {visibleSubjects.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<BookOpen size={26} />}
            title="No subjects yet"
            message={manager ? 'Add a subject to get started.' : 'Your account does not have a subject assigned. Contact the administrator.'}
          />
        </div>
      ) : (
        <div className="subjects">
          <nav className="card subjects__list" aria-label="Subjects">
            <ul>
              {visibleSubjects.map((s) => {
                const color = subjectColor(s.color);
                const active = s.id === selected?.id;
                return (
                  <li key={s.id}>
                    <button type="button" className={`subject-item ${active ? 'is-active' : ''}`.trim()} aria-current={active ? 'true' : undefined} onClick={() => setSelectedId(s.id)}>
                      <span className="subject-item__dot" style={{ background: color.solid }} aria-hidden="true" />
                      <span className="subject-item__name">{s.name}</span>
                      <span className="subject-item__count">{taskCountBySubject.get(s.id) ?? 0}</span>
                    </button>
                    {manager && (
                      <IconButton label={`Delete ${s.name}`} tone="danger" onClick={() => setDeletingSubject(s)}>
                        <Trash2 size={16} aria-hidden="true" />
                      </IconButton>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {selected && (
            <section className="card subjects__detail" aria-labelledby="subject-title">
              <div className="card__head">
                <div className="subject-title">
                  <span className="subject-title__chip" style={{ background: subjectColor(selected.color).soft, color: subjectColor(selected.color).solid }}>
                    <BookOpen size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 id="subject-title" className="card__title">{selected.name}</h2>
                    <p className="card__sub">{activeTaskCount} active task{activeTaskCount === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <div className="card__actions">
                  <Button variant="soft" size="sm" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setTaskForm({})}>Add task</Button>
                </div>
              </div>

              {selectedTasks.length === 0 ? (
                <EmptyState title="No tasks in this subject" message="Add a task, then assign it to a learner or a whole section." action={<Button onClick={() => setTaskForm({})}>Add task</Button>} />
              ) : (
                <ul className="tasks">
                  {selectedTasks.map((t) => {
                    const stats = assignmentStats.get(t.id);
                    return (
                      <li key={t.id} className="task">
                        <div className="task__text">
                          <strong>{t.title}</strong>
                          {t.description && <p>{t.description}</p>}
                          <div className="badges">
                            {!t.active && <Badge>Archived</Badge>}
                            <Badge>{stats ? `${stats.total} learner${stats.total === 1 ? '' : 's'}` : 'Not assigned'}</Badge>
                            {stats && stats.overdue > 0 && <Badge tone="danger">{stats.overdue} overdue</Badge>}
                          </div>
                        </div>
                        <div className="row-actions">
                          {t.active && (
                            <>
                              <Button variant="soft" size="sm" icon={<ListPlus size={16} aria-hidden="true" />} onClick={() => setAssignTaskId(t.id)}>Assign</Button>
                              <IconButton label={`Edit ${t.title}`} onClick={() => setTaskForm({ task: t })}>
                                <Pencil size={17} aria-hidden="true" />
                              </IconButton>
                            </>
                          )}
                          {(manager || (t.active && profile?.role === 'teacher' && t.createdBy === user?.uid)) && (
                            <IconButton
                              label={`Delete ${t.title}`}
                              tone="danger"
                              onClick={() => setDeletingTask(t)}
                            >
                              <Trash2 size={17} aria-hidden="true" />
                            </IconButton>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      {taskForm && selected && <TaskFormModal subjectId={selected.id} task={taskForm.task} onClose={() => setTaskForm(null)} />}
      {assignTaskId && <AssignModal target={{ kind: 'section' }} presetTaskId={assignTaskId} onClose={() => setAssignTaskId(null)} />}

      <ConfirmDialog
        open={deletingTask !== null}
        title="Delete task?"
        message={
          deletingTask && (
            <><strong>{deletingTask.title}</strong> will be permanently deleted and removed from {taskAssignmentCount} learner{taskAssignmentCount === 1 ? '' : 's'}. This cannot be undone.</>
          )
        }
        confirmLabel="Delete task"
        danger
        onCancel={() => setDeletingTask(null)}
        onConfirm={handleDeleteTask}
      />
      <ConfirmDialog
        open={deletingSubject !== null}
        title="Delete subject?"
        message={deletingSubject && <>Delete <strong>{deletingSubject.name}</strong>? It can only be deleted after its teachers, tasks, and assignments have been removed. This cannot be undone.</>}
        confirmLabel="Delete subject"
        danger
        onCancel={() => setDeletingSubject(null)}
        onConfirm={handleDeleteSubject}
      />
    </>
  );
}
