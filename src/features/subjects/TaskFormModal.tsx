import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { getErrorMessage } from '@/lib/errors';
import { LIMITS, validateTask, type FieldErrors, type TaskInput } from '@/lib/validation';
import { addTask, updateTask } from '@/services/catalog';
import type { Task } from '@/types';

interface TaskFormModalProps {
  subjectId: string;
  task?: Task;
  onClose: () => void;
}

export function TaskFormModal({ subjectId, task, onClose }: TaskFormModalProps) {
  const { user } = useAuth();
  const toast = useToast();
  const { tasks } = useData();
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [errors, setErrors] = useState<FieldErrors<TaskInput>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFormError(null);
    const siblings = tasks.filter((t) => t.active && t.subjectId === subjectId && t.id !== task?.id).map((t) => t.title);
    const result = validateTask({ title, description }, siblings);
    setErrors(result.errors);
    if (!result.valid) return;

    setBusy(true);
    try {
      if (!user) throw new Error('Your session has expired. Sign in again.');
      const response = task
        ? await updateTask(user, task.id, result.value)
        : await addTask(user, subjectId, result.value);
      toast.notify('success', task ? 'Task updated.' : 'Task added.');
      if (response.auditWarning) toast.notify('info', response.auditWarning);
      onClose();
    } catch (err) {
      setFormError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={task ? 'Edit task' : 'Add task'}
      description="Tasks can be assigned to learners from here or from the Learners page."
      onClose={onClose}
      dismissible={!busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="task-form" loading={busy}>{task ? 'Save task' : 'Add task'}</Button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} noValidate className="form">
        <Field label="Title" error={errors.title}>
          {(p) => <input {...p} className="input" value={title} maxLength={LIMITS.taskTitle} autoComplete="off" onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field label="Description (optional)" error={errors.description} hint={`${description.length}/${LIMITS.taskDescription}`}>
          {(p) => <textarea {...p} className="textarea" rows={4} value={description} maxLength={LIMITS.taskDescription} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        {formError && <div className="banner banner--error" role="alert">{formError}</div>}
      </form>
    </Modal>
  );
}
