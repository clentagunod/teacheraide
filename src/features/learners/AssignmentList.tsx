import { Check, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { isOverdue } from '@/lib/analytics';
import { DEFAULT_DUE_TIME, formatDate, formatTime } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { subjectColor } from '@/lib/subjectColors';
import { validateDueDate, validateDueTime } from '@/lib/validation';
import { removeAssignment, updateAssignment } from '@/services/assignments';
import type { Assignment, AssignmentStatus } from '@/types';
import { useLocalClock } from '@/hooks/useLocalClock';

function AssignmentRow({
  assignment,
  siblings,
  today,
  time,
}: {
  assignment: Assignment;
  siblings: Assignment[];
  today: string;
  time: string;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const { tasks, subjects, taskById, subjectById } = useData();

  const [editing, setEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [taskId, setTaskId] = useState(assignment.taskId);
  const [dueDate, setDueDate] = useState(assignment.dueDate);
  const [dueTime, setDueTime] = useState(assignment.dueTime || DEFAULT_DUE_TIME);
  const [status, setStatus] = useState<AssignmentStatus>(assignment.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const task = taskById.get(assignment.taskId);
  const subject = subjectById.get(assignment.subjectId);
  const color = subjectColor(subject?.color ?? 'violet');
  const overdue = isOverdue(assignment, today, time);

  function startEdit() {
    setTaskId(assignment.taskId);
    setDueDate(assignment.dueDate);
    setDueTime(assignment.dueTime || DEFAULT_DUE_TIME);
    setStatus(assignment.status);
    setError(null);
    setEditing(true);
  }

  async function save() {
    setError(null);
    const dateError = validateDueDate(dueDate);
    if (dateError) return setError(dateError);
    const timeError = validateDueTime(dueTime);
    if (timeError) return setError(timeError);
    const nextTask = taskById.get(taskId);
    if (!nextTask) return setError('Choose a task.');
    if (siblings.some((s) => s.id !== assignment.id && s.taskId === taskId)) return setError('This learner already has that task.');

    setBusy(true);
    try {
      if (!user) throw new Error('Your session has expired. Sign in again.');
      const result = await updateAssignment(user, assignment.id, { taskId, subjectId: nextTask.subjectId, dueDate, dueTime: dueTime || DEFAULT_DUE_TIME, status });
      setEditing(false);
      toast.notify('success', 'Task updated.');
      if (result.auditWarning) toast.notify('info', result.auditWarning);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus() {
    setBusy(true);
    try {
      if (!user) throw new Error('Your session has expired. Sign in again.');
      const result = await updateAssignment(user, assignment.id, {
        taskId: assignment.taskId,
        subjectId: assignment.subjectId,
        dueDate: assignment.dueDate,
        dueTime: assignment.dueTime || DEFAULT_DUE_TIME,
        status: assignment.status === 'completed' ? 'pending' : 'completed',
      });
      if (result.auditWarning) toast.notify('info', result.auditWarning);
    } catch (err) {
      toast.notify('error', getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      if (!user) throw new Error('Your session has expired. Sign in again.');
      const result = await removeAssignment(user, assignment.id);
      toast.notify('success', 'Task removed from learner.');
      if (result.auditWarning) toast.notify('info', result.auditWarning);
    } catch (err) {
      toast.notify('error', getErrorMessage(err));
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className="assign assign--editing">
        <div className="assign__fields">
          <label className="assign__field">
            <span>Task</span>
            <select className="select" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              {subjects.map((s) => (
                <optgroup key={s.id} label={s.name}>
                  {tasks.filter((t) => t.subjectId === s.id && (t.active || t.id === assignment.taskId)).map((t) => (
                    <option key={t.id} value={t.id}>{t.title}{t.active ? '' : ' (archived)'}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="assign__field">
            <span>Due date</span>
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className="assign__field">
            <span>Due time</span>
            <input className="input" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
          </label>
          <label className="assign__field">
            <span>Status</span>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as AssignmentStatus)}>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </div>
        {error && <p className="field__error" role="alert">{error}</p>}
        <div className="assign__actions">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={save} loading={busy}>Save task</Button>
        </div>
      </li>
    );
  }

  return (
    <li className="assign">
      <span className="assign__dot" style={{ background: color.solid }} aria-hidden="true" />
      <div className="assign__text">
        <strong>{task ? `${task.title}${task.active ? '' : ' (archived)'}` : 'Removed task'}</strong>
        <span>{subject?.name ?? 'Unknown subject'} · due {formatDate(assignment.dueDate)} at {formatTime(assignment.dueTime || DEFAULT_DUE_TIME)}</span>
      </div>
      {assignment.status === 'completed' ? <Badge tone="success">Done</Badge> : overdue ? <Badge tone="danger">Overdue</Badge> : <Badge tone="accent">Pending</Badge>}

      {confirmingRemove ? (
        <div className="assign__confirm">
          <span>Remove?</span>
          <Button variant="danger" size="sm" onClick={remove} loading={busy}>Yes</Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmingRemove(false)} disabled={busy}>No</Button>
        </div>
      ) : (
        <div className="assign__icons">
          <IconButton label={assignment.status === 'completed' ? 'Mark as pending' : 'Mark as done'} onClick={toggleStatus} disabled={busy}>
            {assignment.status === 'completed' ? <RotateCcw size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
          </IconButton>
          <IconButton label="Edit task and due date" onClick={startEdit} disabled={busy}>
            <Pencil size={16} aria-hidden="true" />
          </IconButton>
          <IconButton label="Remove task" tone="danger" onClick={() => setConfirmingRemove(true)} disabled={busy}>
            <Trash2 size={16} aria-hidden="true" />
          </IconButton>
        </div>
      )}
    </li>
  );
}

export function AssignmentList({ learnerId }: { learnerId: string }) {
  const { assignments } = useData();
  const { date: today, time } = useLocalClock();
  const mine = assignments
    .filter((a) => a.learnerId === learnerId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.dueTime.localeCompare(b.dueTime));

  if (mine.length === 0) {
    return <p className="muted">No tasks assigned yet. Use “Assign task” on the Learners list.</p>;
  }
  return (
    <ul className="assign-list">
      {mine.map((a) => (
        <AssignmentRow key={a.id} assignment={a} siblings={mine} today={today} time={time} />
      ))}
    </ul>
  );
}
