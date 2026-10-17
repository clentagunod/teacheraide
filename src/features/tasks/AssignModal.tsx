import { BookOpen } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { EmptyState, PageLoader } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useStaff } from '@/context/StaffContext';
import { useData } from '@/context/DataContext';
import { listGrades, listSections } from '@/lib/analytics';
import { addDays, DEFAULT_DUE_TIME, todayISO } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { learnerFullName } from '@/lib/names';
import { validateDueDate, validateDueTime } from '@/lib/validation';
import { assignTasks, MAX_TASKS_PER_BULK_ASSIGNMENT } from '@/services/assignments';
import type { Learner } from '@/types';

export type AssignTarget = { kind: 'learner'; learner: Learner } | { kind: 'section'; grade?: number | null; section?: string | null };

interface AssignModalProps {
  target: AssignTarget;
  /** When set, the subject and task are fixed (used from the Subjects page). */
  presetTaskId?: string;
  onClose: () => void;
}

export function AssignModal({ target, presetTaskId, onClose }: AssignModalProps) {
  const { user } = useAuth();
  const { profile } = useStaff();
  const toast = useToast();
  const { learners, subjects, tasks, assignments, taskById, sections: schoolSections, loadingByResource } = useData();
  const availableSubjects = useMemo(
    () => profile?.role === 'teacher' ? subjects.filter((subject) => subject.id === profile.subjectId) : subjects,
    [profile?.role, profile?.subjectId, subjects],
  );
  const availableSubjectIds = useMemo(() => new Set(availableSubjects.map((subject) => subject.id)), [availableSubjects]);
  const availableTasks = useMemo(
    () => tasks.filter((task) => task.active && availableSubjectIds.has(task.subjectId)),
    [tasks, availableSubjectIds],
  );

  const preset = presetTaskId ? taskById.get(presetTaskId) : undefined;
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>(preset ? [preset.id] : []);
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [dueDate, setDueDate] = useState(addDays(todayISO(), 7));
  const [dueTime, setDueTime] = useState(DEFAULT_DUE_TIME);
  const [gradeSel, setGradeSel] = useState<number | null>(target.kind === 'section' ? target.grade ?? null : null);
  const [sectionSel, setSectionSel] = useState<string | null>(target.kind === 'section' ? target.section ?? null : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTasks = useMemo(
    () => availableTasks.filter((task) => selectedTaskIds.includes(task.id)),
    [availableTasks, selectedTaskIds],
  );

  const grades = useMemo(() => listGrades(learners), [learners]);
  const grade = gradeSel !== null && grades.includes(gradeSel) ? gradeSel : grades[0] ?? null;
  const sections = useMemo(() => (grade === null ? [] : listSections(learners, grade)), [learners, grade]);
  const section = sectionSel !== null && sections.includes(sectionSel) ? sectionSel : sections[0] ?? null;

  const recipients = useMemo(
    () => (target.kind === 'learner' ? [target.learner] : learners.filter((l) => l.grade === grade && l.section === section)),
    [target, learners, grade, section],
  );

  const catalogLoading = loadingByResource.subjects || loadingByResource.tasks;
  const noCatalog = !catalogLoading && (availableSubjects.length === 0 || availableTasks.length === 0);

  useEffect(() => {
    if (catalogLoading || selectionInitialized) return;
    const initialTask = presetTaskId && availableTasks.some((task) => task.id === presetTaskId)
      ? presetTaskId
      : availableTasks[0]?.id;
    setSelectedTaskIds(initialTask ? [initialTask] : []);
    setSelectionInitialized(true);
  }, [catalogLoading, selectionInitialized, presetTaskId, availableTasks]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (selectedTasks.length === 0) return setError('Select at least one task.');
    if (selectedTasks.length > MAX_TASKS_PER_BULK_ASSIGNMENT) {
      return setError(`Select no more than ${MAX_TASKS_PER_BULK_ASSIGNMENT} tasks at a time.`);
    }
    const dateError = validateDueDate(dueDate);
    if (dateError) return setError(dateError);
    const timeError = validateDueTime(dueTime);
    if (timeError) return setError(timeError);
    if (recipients.length === 0) return setError('There are no learners in that section.');

    const existingKeys = new Set(assignments.map((assignment) => `${assignment.learnerId}:${assignment.taskId}`));
    const toAssign = selectedTasks.flatMap((task) => recipients
      .filter((learner) => !existingKeys.has(`${learner.id}:${task.id}`))
      .map((learner) => ({
        learner: {
          id: learner.id,
          grade: learner.grade,
          section: learner.section,
          sectionId: learner.sectionId,
        },
        taskId: task.id,
        subjectId: task.subjectId,
      })));
    if (toAssign.length === 0) return setError('All selected tasks are already assigned to these learners.');

    if (target.kind === 'section') {
      const sectionId = schoolSections.find((item) => item.grade === grade && item.name === section)?.sectionId;
      if (!sectionId) return setError('Choose a section created by the administrator.');
      if (recipients.some((learner) => learner.sectionId !== sectionId)) {
        return setError('The selected roster does not match the section.');
      }
    }
    setBusy(true);
    try {
      if (!user) throw new Error('Your session has expired. Sign in again.');
      const result = await assignTasks(user, {
        assignments: toAssign,
        dueDate,
        dueTime: dueTime || DEFAULT_DUE_TIME,
      });
      const skipped = recipients.length * selectedTasks.length - result.created;
      toast.notify('success', `Created ${result.created} task assignment${result.created === 1 ? '' : 's'}${skipped > 0 ? `; skipped ${skipped} already assigned` : ''}.`);
      if (result.auditWarning) toast.notify('info', result.auditWarning);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  const title = target.kind === 'learner' ? `Assign task to ${learnerFullName(target.learner)}` : 'Assign task to a section';

  return (
    <Modal
      open
      title={title}
      description={target.kind === 'learner' ? `${learnerFullName(target.learner)} · Grade ${target.learner.grade} ${target.learner.section}` : 'Every learner in the section gets the task.'}
      onClose={onClose}
      dismissible={!busy}
      footer={
        noCatalog || catalogLoading ? (
          <Button variant="ghost" onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" form="assign-form" loading={busy} disabled={selectedTasks.length === 0}>
              Assign {recipients.length * selectedTasks.length} task assignment{recipients.length * selectedTasks.length === 1 ? '' : 's'}
            </Button>
          </>
        )
      }
    >
      {catalogLoading ? (
        <PageLoader label="Loading subjects and tasks…" />
      ) : noCatalog ? (
        <EmptyState
          icon={<BookOpen size={24} />}
          title="Create a subject and task first"
          message="Tasks belong to a subject. Add them, then come back to assign."
          action={<Link to="/subjects" className="btn btn--dark btn--md" onClick={onClose}>Go to Subjects &amp; Tasks</Link>}
        />
      ) : (
        <form id="assign-form" onSubmit={handleSubmit} noValidate className="form">
          {target.kind === 'section' && (
            <div className="form__row">
              <Field label="Grade">
                {(p) => (
                  <select {...p} className="select" value={grade ?? ''} onChange={(e) => { setGradeSel(Number(e.target.value)); setSectionSel(null); }}>
                    {grades.map((g) => (
                      <option key={g} value={g}>Grade {g}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Section" hint={`${recipients.length} learner${recipients.length === 1 ? '' : 's'}`}>
                {(p) => (
                  <select {...p} className="select" value={section ?? ''} onChange={(e) => setSectionSel(e.target.value)}>
                    {sections.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          )}

          <div className="field">
            <span className="field__label">Tasks</span>
            <p id="assign-task-help" className="field__hint">
              Choose up to {MAX_TASKS_PER_BULK_ASSIGNMENT} tasks. Each learner-task pair has its own status; tasks already assigned are skipped.
            </p>
            <div className="form__task-picker" role="group" aria-label="Tasks to assign" aria-describedby="assign-task-help">
                {availableSubjects.map((subject) => {
                  const subjectTasks = availableTasks.filter((task) => task.subjectId === subject.id);
                  if (subjectTasks.length === 0) return null;
                  return (
                    <fieldset key={subject.id} className="form__task-group">
                      <legend>{subject.name}</legend>
                      {subjectTasks.map((task) => (
                        <label key={task.id} className="form__task-option" htmlFor={`assign-task-${task.id}`}>
                          <input
                            id={`assign-task-${task.id}`}
                            type="checkbox"
                            checked={selectedTaskIds.includes(task.id)}
                            disabled={Boolean(presetTaskId && task.id !== presetTaskId)}
                            onChange={(event) => setSelectedTaskIds((current) => event.target.checked
                              ? [...current, task.id]
                              : current.filter((id) => id !== task.id))}
                          />
                          <span>{task.title}</span>
                        </label>
                      ))}
                    </fieldset>
                  );
                })}
            </div>
          </div>

          <Field label="Due date">
            {(p) => <input {...p} className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}
          </Field>
          <Field label="Due time (optional)" hint={`Defaults to ${DEFAULT_DUE_TIME} local time.`}>
            {(p) => <input {...p} className="input" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />}
          </Field>

          {error && <div className="banner banner--error" role="alert">{error}</div>}
        </form>
      )}
    </Modal>
  );
}
