import { onSnapshot, query, where, type Query, type QueryDocumentSnapshot } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useStaff } from '@/context/StaffContext';
import { addDays, todayISO } from '@/lib/dates';
import { compareText } from '@/lib/analytics';
import { getErrorMessage } from '@/lib/errors';
import { canManageSchoolRecords } from '@/lib/roles';
import { useAuth } from '@/context/AuthContext';
import { col } from '@/services/firestore';
import { ensureInitialSubjects } from '@/services/catalog';
import { toAssignment, toAttendance, toLearner, toSchoolSection, toStaffProfile, toSubject, toTask } from '@/services/mappers';
import type { Assignment, AttendanceRecord, Learner, SchoolSection, StaffProfile, Subject, Task } from '@/types';

/** Attendance older than this is still stored; it is just not kept live in memory. */
export const ATTENDANCE_WINDOW_DAYS = 90;

interface DataState {
  learners: Learner[];
  subjects: Subject[];
  staff: StaffProfile[];
  tasks: Task[];
  assignments: Assignment[];
  /** Recent attendance only (see ATTENDANCE_WINDOW_DAYS). */
  attendance: AttendanceRecord[];
  sections: SchoolSection[];
  learnerById: Map<string, Learner>;
  subjectById: Map<string, Subject>;
  taskById: Map<string, Task>;
  loadingByResource: {
    learners: boolean;
    subjects: boolean;
    staff: boolean;
    tasks: boolean;
    assignments: boolean;
    attendance: boolean;
    sections: boolean;
  };
  errorByResource: {
    learners: string | null;
    subjects: string | null;
    staff: string | null;
    tasks: string | null;
    assignments: string | null;
    attendance: string | null;
    sections: string | null;
  };
  loading: boolean;
  error: string | null;
}

const DataContext = createContext<DataState | null>(null);

function useLive<T>(source: Query | null, mapper: (s: QueryDocumentSnapshot) => T, label: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!source) {
      setItems([]);
      setError(null);
      setLoading(false);
      return undefined;
    }
    setItems([]);
    setLoading(true);
    setError(null);
    return onSnapshot(
      source,
      (snap) => {
        setItems(snap.docs.map(mapper));
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(`Could not load ${label}: ${getErrorMessage(err)}`);
        setLoading(false);
      },
    );
  }, [source, mapper]);

  return { items, loading, error };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { profile } = useStaff();
  const { user } = useAuth();
  const role = profile?.role;
  const assignedSectionId = profile?.sectionId;
  const assignedSubjectId = profile?.subjectId;
  const manager = canManageSchoolRecords(profile?.role);
  const [catalogSetupLoading, setCatalogSetupLoading] = useState(false);
  const [catalogSetupError, setCatalogSetupError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.role !== 'admin' || !user) {
      setCatalogSetupLoading(false);
      setCatalogSetupError(null);
      return undefined;
    }
    let active = true;
    setCatalogSetupLoading(true);
    setCatalogSetupError(null);
    void ensureInitialSubjects()
      .catch((err: unknown) => {
        if (active) setCatalogSetupError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setCatalogSetupLoading(false);
      });
    return () => { active = false; };
  }, [profile?.role, user]);

  const learnersQ = useMemo(
    () => manager
      ? col('learners')
      : assignedSectionId ? query(col('learners'), where('sectionId', '==', assignedSectionId)) : null,
    [manager, assignedSectionId],
  );
  const sectionsQ = useMemo(
    () => manager
      ? col('sections')
      : assignedSectionId ? query(col('sections'), where('sectionId', '==', assignedSectionId)) : null,
    [manager, assignedSectionId],
  );
  const staffQ = useMemo(() => role === 'admin' ? col('staff') : null, [role]);
  const subjectsQ = useMemo(
    () => manager
      ? col('subjects')
      : role === 'teacher' && assignedSubjectId
        ? query(col('subjects'), where('subjectId', '==', assignedSubjectId))
        : null,
    [manager, role, assignedSubjectId],
  );
  const tasksQ = useMemo(
    () => manager
      ? col('tasks')
      : assignedSubjectId ? query(col('tasks'), where('subjectId', '==', assignedSubjectId)) : null,
    [manager, assignedSubjectId],
  );
  const assignmentsQ = useMemo(
    () => manager
      ? col('assignments')
      : assignedSectionId && assignedSubjectId
        ? query(col('assignments'), where('sectionId', '==', assignedSectionId), where('subjectId', '==', assignedSubjectId))
        : null,
    [manager, assignedSectionId, assignedSubjectId],
  );
  const attendanceQ = useMemo(
    () => manager
      ? query(col('attendance'), where('date', '>=', addDays(todayISO(), -ATTENDANCE_WINDOW_DAYS)))
      : assignedSectionId
        ? query(col('attendance'), where('sectionId', '==', assignedSectionId), where('date', '>=', addDays(todayISO(), -ATTENDANCE_WINDOW_DAYS)))
        : null,
    [manager, assignedSectionId],
  );

  const l = useLive(learnersQ, toLearner, 'learners');
  const sectionsLive = useLive(sectionsQ, toSchoolSection, 'grade sections');
  const staffLive = useLive(staffQ, toStaffProfile, 'staff accounts');
  const subjectsLive = useLive(subjectsQ, toSubject, 'subjects');
  const t = useLive(tasksQ, toTask, 'tasks');
  const a = useLive(assignmentsQ, toAssignment, 'assignments');
  const at = useLive(attendanceQ, toAttendance, 'attendance');

  const learners = useMemo(
    () => [...l.items].sort((x, y) => compareText(x.lastName, y.lastName) || compareText(x.firstName, y.firstName)),
    [l.items],
  );
  const subjects = useMemo(() => [...subjectsLive.items].sort((x, y) => compareText(x.name, y.name)), [subjectsLive.items]);
  const tasks = useMemo(() => [...t.items].sort((x, y) => compareText(x.title, y.title)), [t.items]);
  const sections = useMemo(() => [...sectionsLive.items].sort((x, y) => x.grade - y.grade || compareText(x.name, y.name)), [sectionsLive.items]);

  const loadingByResource = {
    learners: l.loading,
    subjects: subjectsLive.loading || catalogSetupLoading,
    staff: staffLive.loading,
    tasks: t.loading,
    assignments: a.loading,
    attendance: at.loading,
    sections: sectionsLive.loading,
  };
  const errorByResource = {
    learners: l.error,
    subjects: [subjectsLive.error, catalogSetupError].filter((message): message is string => message !== null).join(' ') || null,
    staff: staffLive.error,
    tasks: t.error,
    assignments: a.error,
    attendance: at.error,
    sections: sectionsLive.error,
  };

  const value = useMemo<DataState>(
    () => ({
      learners,
      subjects,
      staff: staffLive.items,
      tasks,
      assignments: a.items,
      attendance: at.items,
      sections,
      learnerById: new Map(learners.map((x) => [x.id, x])),
      subjectById: new Map(subjects.map((x) => [x.id, x])),
      taskById: new Map(tasks.map((x) => [x.id, x])),
      loadingByResource,
      errorByResource,
      loading: Object.values(loadingByResource).some(Boolean),
      error: Object.values(errorByResource)
        .filter((message): message is string => message !== null)
        .join(' ') || null,
    }),
    [learners, subjects, tasks, sections, staffLive.items, a.items, at.items, loadingByResource.learners, loadingByResource.subjects, loadingByResource.staff, loadingByResource.tasks, loadingByResource.assignments, loadingByResource.attendance, loadingByResource.sections, errorByResource.learners, errorByResource.subjects, errorByResource.staff, errorByResource.tasks, errorByResource.assignments, errorByResource.attendance, errorByResource.sections],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
