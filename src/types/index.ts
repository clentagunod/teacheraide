export type AssignmentStatus = 'pending' | 'completed';
export type AttendanceStatus = 'present' | 'absent';
export type SubjectColor = 'violet' | 'blue' | 'pink' | 'teal' | 'amber' | 'rose';
export type UserRole = 'admin' | 'supervisor' | 'teacher';
export type LearnerGender = 'female' | 'male';

export interface StaffProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  grade: number | null;
  sectionId: string | null;
  subjectId: string | null;
}

export interface SchoolSection {
  id: string;
  sectionId: string;
  grade: number;
  name: string;
}

export interface Learner {
  id: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  gender: LearnerGender | null;
  grade: number;
  section: string;
  sectionId: string;
}

export interface Subject {
  id: string;
  name: string;
  color: SubjectColor;
}

export interface Task {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  createdBy: string | null;
  active: boolean;
}

export interface Assignment {
  id: string;
  learnerId: string;
  taskId: string;
  subjectId: string;
  /** Local calendar day, "YYYY-MM-DD". Stored as text to avoid timezone drift. */
  dueDate: string;
  /** Local wall-clock time, "HH:mm"; older records default to 23:59. */
  dueTime: string;
  status: AssignmentStatus;
}

export interface AttendanceRecord {
  id: string;
  /** "YYYY-MM-DD" */
  date: string;
  grade: number;
  section: string;
  sectionId: string;
  /** learnerId → status */
  records: Record<string, AttendanceStatus>;
}

/** Dashboard filter. `null` means "all". A section is only meaningful together with a grade. */
export interface Scope {
  grade: number | null;
  section: string | null;
}
