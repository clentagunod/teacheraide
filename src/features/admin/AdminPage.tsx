import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { FileUp, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Badge, ErrorBanner, PageHeader, PageLoader } from '@/components/ui/Feedback';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useStaff } from '@/context/StaffContext';
import { useToast } from '@/components/ui/Toast';
import { GRADES, LIMITS } from '@/lib/validation';
import { getErrorMessage } from '@/lib/errors';
import { parseLearnerRoster, type ParsedLearnerRoster } from '@/lib/learnerImport';
import { addSection } from '@/services/catalog';
import { importLearners } from '@/services/learners';
import { sendAuditEvent } from '@/services/adminScript';
import { createStaffAccount } from '@/services/staff';

const AUDIT_SHEET_URL = import.meta.env.VITE_AUDIT_SHEET_URL as string | undefined;

export default function AdminPage() {
  const { user } = useAuth();
  const { profile } = useStaff();
  const toast = useToast();
  const { sections, staff, subjects, loadingByResource, errorByResource } = useData();
  const [grade, setGrade] = useState(1);
  const [sectionName, setSectionName] = useState('');
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [sectionBusy, setSectionBusy] = useState(false);
  const [roster, setRoster] = useState<ParsedLearnerRoster | null>(null);
  const [rosterFileName, setRosterFileName] = useState('');
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterBusy, setRosterBusy] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountRole, setAccountRole] = useState<'teacher' | 'supervisor'>('teacher');
  const [teacherGrade, setTeacherGrade] = useState<number | ''>('');
  const [teacherSectionId, setTeacherSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [teacherBusy, setTeacherBusy] = useState(false);
  const sectionsForGrade = useMemo(() => sections.filter((item) => item.grade === teacherGrade), [sections, teacherGrade]);

  async function handleRosterFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setRoster(null);
    setRosterFileName('');
    setRosterError(null);
    if (!file) return;
    if (file.size > 1_000_000) {
      setRosterError('Choose a JSON file smaller than 1 MB.');
      return;
    }

    try {
      const parsedRoster = parseLearnerRoster(await file.text(), sections);
      setRoster(parsedRoster);
      setRosterFileName(file.name);
    } catch (err) {
      setRosterError(getErrorMessage(err));
    }
  }

  async function handleImportRoster(event: FormEvent) {
    event.preventDefault();
    if (!user || !roster || rosterBusy) return;
    setRosterBusy(true);
    setRosterError(null);
    try {
      const result = await importLearners(user, roster.section.sectionId, roster.learners);
      setRoster(null);
      setRosterFileName('');
      const message = `Imported ${result.created} learner${result.created === 1 ? '' : 's'}; skipped ${result.skipped} existing.`;
      toast.notify(result.auditWarning ? 'error' : 'success', result.auditWarning ? `${message} Audit warning: ${result.auditWarning}` : message);
    } catch (err) {
      setRosterError(getErrorMessage(err));
    } finally {
      setRosterBusy(false);
    }
  }

  async function handleAddSection(event: FormEvent) {
    event.preventDefault();
    if (!user || sectionBusy) return;
    const cleanName = sectionName.trim().replace(/\s+/g, ' ');
    if (!cleanName) {
      setSectionError('Enter a section name.');
      return;
    }
    if (cleanName.length > LIMITS.section) {
      setSectionError(`Section names must be ${LIMITS.section} characters or fewer.`);
      return;
    }
    if (sections.some((item) => item.grade === grade && item.name.toLowerCase() === cleanName.toLowerCase())) {
      setSectionError('That section already exists in this grade.');
      return;
    }
    setSectionBusy(true);
    setSectionError(null);
    try {
      await addSection(user, grade, cleanName);
      setSectionName('');
      toast.notify('success', `Grade ${grade} · ${cleanName} was added.`);
    } catch (err) {
      setSectionError(getErrorMessage(err));
    } finally {
      setSectionBusy(false);
    }
  }

  async function handleCreateTeacher(event: FormEvent) {
    event.preventDefault();
    if (!user || teacherBusy) return;
    setTeacherError(null);
    if (!name.trim()) return setTeacherError(`Enter the ${accountRole}'s name.`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setTeacherError('Enter a valid email address.');
    if (password.length < 6) return setTeacherError('Use a temporary password with at least 6 characters.');
    const selectedSection = accountRole === 'teacher' ? sections.find((item) => item.sectionId === teacherSectionId) : undefined;
    if (accountRole === 'teacher' && (!selectedSection || selectedSection.grade !== teacherGrade)) return setTeacherError('Choose a section created by the administrator.');
    if (accountRole === 'teacher' && !subjects.some((subject) => subject.id === subjectId)) return setTeacherError('Choose a subject created by the administrator.');

    setTeacherBusy(true);
    try {
      const staffProfile = {
        email: email.trim().toLowerCase(),
        displayName: name.trim().replace(/\s+/g, ' '),
        role: accountRole,
        ...(selectedSection ? {
          grade: selectedSection.grade,
          sectionId: selectedSection.sectionId,
          section: selectedSection.name,
          subjectId,
        } : {
          grade: null,
          sectionId: null,
          section: null,
          subjectId: null,
        }),
      };
      const uid = await createStaffAccount(staffProfile, password);
      setName('');
      setEmail('');
      setPassword('');
      setTeacherSectionId('');
      setSubjectId('');
      toast.notify('success', `${accountRole === 'teacher' ? 'Teacher' : 'Supervisor'} account created. Share the temporary password securely.`);
      void sendAuditEvent('create', 'staff', uid).catch((error: unknown) => {
        toast.notify('info', error instanceof Error ? `Account created, but audit logging failed: ${error.message}` : 'Account created, but the audit event could not be delivered.');
      });
    } catch (err) {
      setTeacherError(getErrorMessage(err));
    } finally {
      setTeacherBusy(false);
    }
  }

  if (profile?.role !== 'admin') return <ErrorBanner message="Only administrators can manage staff and grade sections." />;
  if (loadingByResource.sections || loadingByResource.staff || loadingByResource.subjects) {
    return <PageLoader label="Loading administration…" />;
  }

  const error = [
    errorByResource.sections,
    errorByResource.staff,
    errorByResource.subjects,
  ].filter((message): message is string => message !== null).join(' ') || null;

  return (
    <>
      <PageHeader title="Administration" subtitle="Manage grade sections, teacher assignments and audit records." />
      {error && <ErrorBanner message={error} />}

      <div className="admin-grid">
        <section className="card admin-grid__wide">
          <div className="card__head">
            <div>
              <h2 className="card__title">Import learner roster</h2>
              <p className="card__sub">Upload the existing JSON roster format. The grade and section must already exist.</p>
            </div>
          </div>
          <form className="form" onSubmit={handleImportRoster}>
            <Field label="Roster JSON file" hint="Expected fields: Grade, Section, learners with Surname, Name, Middle I, and Gender.">
              {(p) => <input {...p} className="input" type="file" accept=".json,application/json" onChange={(event) => void handleRosterFile(event)} />}
            </Field>
            {rosterFileName && roster && (
              <p className="muted">
                {rosterFileName} · Grade {roster.grade} · {roster.section.name} · {roster.learners.length} learners ready
              </p>
            )}
            {rosterError && <div className="banner banner--error" role="alert">{rosterError}</div>}
            <Button type="submit" icon={<FileUp size={18} aria-hidden="true" />} loading={rosterBusy} disabled={!roster}>Import learners</Button>
          </form>
        </section>

        <section className="card">
          <div className="card__head">
            <div>
              <h2 className="card__title">Grade sections</h2>
              <p className="card__sub">Teachers can only be assigned sections created here.</p>
            </div>
          </div>
          <form className="form" onSubmit={handleAddSection}>
            <div className="form__row">
              <Field label="Grade">
                {(p) => (
                  <select {...p} className="select" value={grade} onChange={(event) => setGrade(Number(event.target.value))}>
                    {GRADES.map((value) => <option key={value} value={value}>Grade {value}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Section name">
                {(p) => <input {...p} className="input" value={sectionName} maxLength={LIMITS.section} onChange={(event) => setSectionName(event.target.value)} placeholder="e.g. Sampaguita" />}
              </Field>
            </div>
            {sectionError && <div className="banner banner--error" role="alert">{sectionError}</div>}
            <Button type="submit" icon={<Plus size={18} aria-hidden="true" />} loading={sectionBusy}>Add section</Button>
          </form>
          <ul className="admin-list">
            {sections.map((item) => (
              <li key={item.sectionId}>
                <span>Grade {item.grade} · {item.name}</span>
                <Badge>{staff.filter((person) => person.sectionId === item.sectionId).length} teachers</Badge>
              </li>
            ))}
            {sections.length === 0 && <li className="muted">No sections yet.</li>}
          </ul>
        </section>

        <section className="card">
          <div className="card__head">
            <div>
              <h2 className="card__title">Add staff account</h2>
              <p className="card__sub">Teachers need one section and subject. Supervisors have school-wide data access without Administration settings. Delete accounts in Firebase Console, then remove their Firestore staff profile.</p>
            </div>
          </div>
          <form className="form" onSubmit={handleCreateTeacher}>
            <Field label="Account role">
              {(p) => (
                <select {...p} className="select" value={accountRole} onChange={(event) => {
                  if (event.target.value === 'teacher' || event.target.value === 'supervisor') {
                    setAccountRole(event.target.value);
                    setTeacherError(null);
                  }
                }}>
                  <option value="teacher">Teacher</option>
                  <option value="supervisor">Supervisor</option>
                </select>
              )}
            </Field>
            <Field label={`${accountRole === 'teacher' ? 'Teacher' : 'Supervisor'} name`}>
              {(p) => <input {...p} className="input" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} autoComplete="name" />}
            </Field>
            <Field label="Email address">
              {(p) => <input {...p} className="input" value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="off" />}
            </Field>
            <Field label="Temporary password" hint={`Share securely with the ${accountRole}; do not reuse your own password.`}>
              {(p) => <input {...p} className="input" value={password} maxLength={128} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" />}
            </Field>
            {accountRole === 'teacher' && <>
            <div className="form__row">
              <Field label="Grade">
                {(p) => (
                  <select {...p} className="select" value={teacherGrade} onChange={(event) => { setTeacherGrade(event.target.value ? Number(event.target.value) : ''); setTeacherSectionId(''); }}>
                    <option value="">Select grade</option>
                    {[...new Set(sections.map((item) => item.grade))].sort((a, b) => a - b).map((value) => <option key={value} value={value}>Grade {value}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Section">
                {(p) => (
                  <select {...p} className="select" value={teacherSectionId} disabled={teacherGrade === ''} onChange={(event) => setTeacherSectionId(event.target.value)}>
                    <option value="">Select section</option>
                    {sectionsForGrade.map((item) => <option key={item.sectionId} value={item.sectionId}>{item.name}</option>)}
                  </select>
                )}
              </Field>
            </div>
            <Field label="Subject">
              {(p) => (
                <select {...p} className="select" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                  <option value="">Select subject</option>
                  {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
              )}
            </Field>
            {subjects.length === 0 && <p className="muted">Add a subject before creating teacher accounts.</p>}
            </>}
            {teacherError && <div className="banner banner--error" role="alert">{teacherError}</div>}
            <Button type="submit" icon={<Users size={18} aria-hidden="true" />} loading={teacherBusy}>Create {accountRole}</Button>
          </form>
        </section>

        <section className="card admin-grid__wide">
          <div className="card__head">
            <div>
              <h2 className="card__title">Staff accounts</h2>
              <p className="card__sub">Each teacher can access only their assigned section and subject.</p>
            </div>
            {AUDIT_SHEET_URL && <a className="btn btn--soft btn--sm" href={AUDIT_SHEET_URL} target="_blank" rel="noreferrer">Open audit log</a>}
          </div>
          <ul className="admin-list">
            {staff.map((person) => (
              <li key={person.id}>
                <div className="admin-list__person">
                  <strong>{person.displayName || person.email}</strong>
                  <span>{person.email} · {person.role === 'admin' ? 'Administrator' : person.role === 'supervisor' ? 'Supervisor · school-wide data access' : `Grade ${person.grade} · ${sections.find((item) => item.sectionId === person.sectionId)?.name ?? 'Section'} · ${subjects.find((subject) => subject.id === person.subjectId)?.name ?? 'No subject assigned'}`}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

    </>
  );
}
