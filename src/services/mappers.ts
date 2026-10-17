import type { DocumentData } from 'firebase/firestore';
import { DEFAULT_DUE_TIME } from '@/lib/dates';
import type { Assignment, AttendanceRecord, AttendanceStatus, Learner, LearnerGender, SchoolSection, StaffProfile, Subject, SubjectColor, Task, UserRole } from '@/types';

/** Structural type satisfied by both QueryDocumentSnapshot and DocumentSnapshot. */
export interface Snap {
  id: string;
  data(): DocumentData | undefined;
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export function toLearner(s: Snap): Learner {
  const d = s.data() ?? {};
  const gender: LearnerGender | null = d.gender === 'female' || d.gender === 'male' ? d.gender : null;
  return {
    id: s.id,
    firstName: str(d.firstName),
    middleInitial: str(d.middleInitial),
    lastName: str(d.lastName),
    gender,
    grade: num(d.grade),
    section: str(d.section),
    sectionId: str(d.sectionId),
  };
}

export function toTask(s: Snap): Task {
  const d = s.data() ?? {};
  return {
    id: s.id,
    subjectId: str(d.subjectId),
    title: str(d.title),
    description: str(d.description),
    createdBy: str(d.createdBy) || null,
    active: d.active !== false,
  };
}

export function toSubject(s: Snap): Subject {
  const d = s.data() ?? {};
  const colors: SubjectColor[] = ['violet', 'blue', 'pink', 'teal', 'amber', 'rose'];
  const color = colors.find((item) => item === d.color) ?? 'violet';
  return { id: s.id, name: str(d.name), color };
}

export function toAssignment(s: Snap): Assignment {
  const d = s.data() ?? {};
  return {
    id: s.id,
    learnerId: str(d.learnerId),
    taskId: str(d.taskId),
    subjectId: str(d.subjectId),
    dueDate: str(d.dueDate),
    dueTime: str(d.dueTime, DEFAULT_DUE_TIME),
    status: d.status === 'completed' ? 'completed' : 'pending',
  };
}

export function toAttendance(s: Snap): AttendanceRecord {
  const d = s.data() ?? {};
  const records: Record<string, AttendanceStatus> = {};
  const raw: unknown = d.records;
  if (raw && typeof raw === 'object') {
    for (const [learnerId, status] of Object.entries(raw as Record<string, unknown>)) {
      if (status === 'present' || status === 'absent') records[learnerId] = status;
    }
  }
  return { id: s.id, date: str(d.date), grade: num(d.grade), section: str(d.section), sectionId: str(d.sectionId), records };
}

export function toStaffProfile(s: Snap): StaffProfile {
  const d = s.data() ?? {};
  const role: UserRole = d.role === 'admin' || d.role === 'supervisor' ? d.role : 'teacher';
  return {
    id: s.id,
    email: str(d.email),
    displayName: str(d.displayName),
    role,
    grade: role === 'teacher' ? num(d.grade) : null,
    sectionId: role === 'teacher' ? str(d.sectionId) : null,
    subjectId: role === 'teacher'
      ? str(d.subjectId, str(d.learningArea)) || null
      : null,
  };
}

export function toSchoolSection(s: Snap): SchoolSection {
  const d = s.data() ?? {};
  return { id: s.id, sectionId: str(d.sectionId, s.id), grade: num(d.grade), name: str(d.name) };
}
