import { addDoc, deleteDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, type Query, type WriteBatch } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { SubjectInput, TaskInput } from '@/lib/validation';
import { col, commitInChunks, ref, SCHOOL_ID } from '@/services/firestore';
import { sendAuditEvent } from '@/services/adminScript';
import type { StaffProfile } from '@/types';
import { canManageSchoolRecords } from '@/lib/roles';

const INITIAL_SUBJECTS: readonly SubjectInput[] = [
  { name: 'Math', color: 'violet' },
  { name: 'English', color: 'blue' },
  { name: 'Science', color: 'teal' },
];

export async function ensureInitialSubjects(): Promise<void> {
  const marker = ref('settings', 'catalog');
  await runTransaction(marker.firestore, async (transaction) => {
    if ((await transaction.get(marker)).exists()) return;
    const initialDocs = INITIAL_SUBJECTS.map((subject) => ({
      subject,
      reference: ref('subjects', subject.name.toLowerCase()),
    }));
    const snapshots = await Promise.all(initialDocs.map(({ reference }) => transaction.get(reference)));
    const now = serverTimestamp();
    transaction.set(marker, { initialized: true, createdAt: now, updatedAt: now });
    snapshots.forEach((snapshot, index) => {
      if (!snapshot.exists()) {
        const { subject, reference } = initialDocs[index];
        transaction.set(reference, { subjectId: reference.id, ...subject, active: true, createdAt: now, updatedAt: now });
      }
    });
  });
}

export async function addSubject(_user: User, input: SubjectInput): Promise<void> {
  const subject = doc(col('subjects'));
  await setDoc(subject, {
    subjectId: subject.id,
    ...input,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await sendAuditEvent('create', 'subject', subject.id);
}

export async function removeSubject(subjectId: string): Promise<{ auditWarning: string | null }> {
  const references = await Promise.all([
    getDocs(query(col('staff'), where('subjectId', '==', subjectId))),
    getDocs(query(col('tasks'), where('subjectId', '==', subjectId))),
    getDocs(query(col('assignments'), where('subjectId', '==', subjectId))),
  ]);
  if (references.some((snapshot) => !snapshot.empty)) {
    throw new Error('This subject is still used by a teacher, task, or learner assignment. Remove those references before deleting it.');
  }
  await deleteDoc(ref('subjects', subjectId));
  return { auditWarning: await auditWarning('delete', 'subject', subjectId) };
}

async function auditWarning(action: string, entity: string, entityId: string): Promise<string | null> {
  try {
    await sendAuditEvent(action, entity, entityId);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'The data was saved, but its audit event could not be delivered.';
  }
}

export async function addTask(user: User, subjectId: string, input: TaskInput): Promise<{ auditWarning: string | null }> {
  const task = await addDoc(col('tasks'), {
    subjectId,
    ...input,
    createdBy: user.uid,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { auditWarning: await auditWarning('create', 'task', task.id) };
}

export async function updateTask(_user: User, id: string, input: TaskInput): Promise<{ auditWarning: string | null }> {
  await updateDoc(ref('tasks', id), { ...input, updatedAt: serverTimestamp() });
  return { auditWarning: await auditWarning('update', 'task', id) };
}

/** Permanently removes a task and its assignments; teachers may remove only their own tasks. */
export async function removeTask(
  user: User,
  id: string,
  profile: Pick<StaffProfile, 'role' | 'sectionId' | 'subjectId'>,
): Promise<{ auditWarning: string | null }> {
  const manager = canManageSchoolRecords(profile.role);
  if (!manager && (profile.role !== 'teacher' || !profile.sectionId || !profile.subjectId)) {
    throw new Error('Only administrators, supervisors, or the teacher who created the task may delete it.');
  }
  const taskRef = ref('tasks', id);
  if (!manager) {
    const task = await getDoc(taskRef);
    if (!task.exists() || task.data().createdBy !== user.uid || task.data().subjectId !== profile.subjectId) {
      throw new Error('Teachers may delete only tasks they created for their assigned subject.');
    }
  }
  await updateDoc(ref('tasks', id), { active: false, updatedAt: serverTimestamp() });
  const assignmentsQuery: Query = manager
    ? query(col('assignments'), where('taskId', '==', id))
    : query(col('assignments'), where('sectionId', '==', profile.sectionId), where('subjectId', '==', profile.subjectId));
  const assignments = await getDocs(assignmentsQuery);
  const taskAssignments = manager
    ? assignments.docs
    : assignments.docs.filter((assignment) => assignment.data().taskId === id);
  const ops: Array<(b: WriteBatch) => void> = [
    ...taskAssignments.map((d) => (b: WriteBatch) => b.delete(d.ref)),
    (b: WriteBatch) => b.delete(taskRef),
  ];
  await commitInChunks(ops);
  return { auditWarning: await auditWarning('delete', 'task', id) };
}

export function sectionDocumentId(grade: number, name: string): string {
  return `${SCHOOL_ID}_${grade}_${encodeURIComponent(name.trim().toLowerCase())}`;
}

export async function addSection(_user: User, grade: number, name: string): Promise<void> {
  const cleanName = name.trim().replace(/\s+/g, ' ');
  const id = sectionDocumentId(grade, cleanName);
  if ((await getDoc(ref('sections', id))).exists()) throw new Error('That grade and section already exists.');
  await setDoc(ref('sections', id), {
    sectionId: id,
    grade,
    name: cleanName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await sendAuditEvent('create', 'section', id);
}
