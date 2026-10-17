import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useStaff } from '@/context/StaffContext';
import { getErrorMessage } from '@/lib/errors';
import { learnerFullName } from '@/lib/names';
import { GRADES, LIMITS, validateLearner, type FieldErrors, type LearnerInput } from '@/lib/validation';
import { AssignmentList } from '@/features/learners/AssignmentList';
import { addLearner, updateLearner } from '@/services/learners';
import type { Learner, LearnerGender } from '@/types';

interface LearnerFormModalProps {
  /** Omit to add a new learner. */
  learner?: Learner;
  /** Pre-fill grade/section when adding. */
  defaults?: { grade: number | null; section: string };
  onClose: () => void;
}

export function LearnerFormModal({ learner, defaults, onClose }: LearnerFormModalProps) {
  const { user } = useAuth();
  const { profile } = useStaff();
  const toast = useToast();
  const { learners, sections } = useData();
  const isEdit = Boolean(learner);

  const [firstName, setFirstName] = useState(learner?.firstName ?? '');
  const [middleInitial, setMiddleInitial] = useState(learner?.middleInitial ?? '');
  const [lastName, setLastName] = useState(learner?.lastName ?? '');
  const [gender, setGender] = useState<LearnerGender | ''>(learner?.gender ?? '');
  const assignedSection = profile?.role === 'teacher' ? sections.find((item) => item.sectionId === profile.sectionId) : undefined;
  const defaultSection = sections.find((item) => item.grade === defaults?.grade && item.name === defaults?.section);
  const [grade, setGrade] = useState<number | null>(learner?.grade ?? assignedSection?.grade ?? profile?.grade ?? defaults?.grade ?? null);
  const [sectionId, setSectionId] = useState(learner?.sectionId ?? assignedSection?.sectionId ?? profile?.sectionId ?? defaultSection?.sectionId ?? '');
  const [errors, setErrors] = useState<FieldErrors<LearnerInput>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFormError(null);

    const result = validateLearner({ firstName, middleInitial, lastName, gender, grade, sectionId }, sections);
    setErrors(result.errors);
    if (!result.valid) return;

    const duplicate = learners.some(
      (l) =>
        l.id !== learner?.id &&
        l.grade === result.value.grade &&
        l.section === result.value.section &&
        l.firstName.toLowerCase() === result.value.firstName.toLowerCase() &&
        l.middleInitial.toLowerCase() === result.value.middleInitial.toLowerCase() &&
        l.lastName.toLowerCase() === result.value.lastName.toLowerCase(),
    );
    if (duplicate) {
      setFormError('A learner with this name already exists in that section.');
      return;
    }

    setBusy(true);
    try {
      if (!user) throw new Error('Your session has expired. Sign in again.');
      if (learner) await updateLearner(user, learner.id, result.value);
      else await addLearner(user, result.value);
      toast.notify('success', learner ? 'Learner updated.' : `${learnerFullName(result.value)} was added.`);
      onClose();
    } catch (err) {
      setFormError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      size={isEdit ? 'lg' : 'md'}
      title={isEdit ? 'Edit learner' : 'Add learner'}
      description={isEdit ? 'Update details, or change a task or due date below.' : 'Add a learner to a grade and section.'}
      onClose={onClose}
      dismissible={!busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>{isEdit ? 'Close' : 'Cancel'}</Button>
          <Button type="submit" form="learner-form" loading={busy}>{isEdit ? 'Save details' : 'Add learner'}</Button>
        </>
      }
    >
      <form id="learner-form" onSubmit={handleSubmit} noValidate className="form">
        <div className="learner-name-fields">
          <Field label="First name" error={errors.firstName}>
            {(p) => <input {...p} className="input" value={firstName} maxLength={LIMITS.name} autoComplete="off" onChange={(e) => setFirstName(e.target.value)} />}
          </Field>
          <Field label="Middle initial" error={errors.middleInitial} hint="Optional">
            {(p) => <input {...p} className="input" value={middleInitial} maxLength={2} autoComplete="additional-name" onChange={(e) => setMiddleInitial(e.target.value)} />}
          </Field>
          <Field label="Last name" error={errors.lastName}>
            {(p) => <input {...p} className="input" value={lastName} maxLength={LIMITS.name} autoComplete="off" onChange={(e) => setLastName(e.target.value)} />}
          </Field>
        </div>
        <Field label="Gender" error={errors.gender}>
          {(p) => (
            <select {...p} className="select" value={gender} onChange={(event) => {
              const value = event.target.value;
              if (value === 'female' || value === 'male' || value === '') setGender(value);
            }}>
              <option value="">Select gender</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          )}
        </Field>
        <div className="form__row">
          <Field label="Grade" error={errors.grade}>
            {(p) => (
              <select {...p} className="select" value={grade ?? ''} disabled={profile?.role === 'teacher'} onChange={(e) => { setGrade(e.target.value ? Number(e.target.value) : null); setSectionId(''); }}>
                <option value="">Select grade</option>
                {GRADES.filter((g) => profile?.role !== 'teacher' ? sections.some((section) => section.grade === g) : g === assignedSection?.grade).map((g) => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Section" error={errors.sectionId} hint="Sections are created by the administrator.">
            {(p) => (
              <select {...p} className="select" value={sectionId} disabled={profile?.role === 'teacher' || !grade} onChange={(e) => setSectionId(e.target.value)}>
                <option value="">Select section</option>
                {sections.filter((section) => section.grade === grade).map((section) => (
                  <option key={section.sectionId} value={section.sectionId}>{section.name}</option>
                ))}
              </select>
            )}
          </Field>
        </div>
        {formError && <div className="banner banner--error" role="alert">{formError}</div>}
      </form>

      {learner && (
        <div className="modal-section">
          <h3 className="card__subtitle">Assigned tasks</h3>
          <AssignmentList learnerId={learner.id} />
        </div>
      )}
    </Modal>
  );
}
