import { addDays } from '@/lib/dates';
import type { Assignment, AttendanceRecord, Learner, Scope } from '@/types';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export const compareText = (a: string, b: string): number => collator.compare(a, b);

export function inScope(learner: Pick<Learner, 'grade' | 'section'>, scope: Scope): boolean {
  return (
    (scope.grade === null || learner.grade === scope.grade) &&
    (scope.section === null || learner.section === scope.section)
  );
}

export function isOverdue(a: Pick<Assignment, 'status' | 'dueDate' | 'dueTime'>, today: string, time = '00:00'): boolean {
  return a.status === 'pending'
    && (a.dueDate < today || (a.dueDate === today && a.dueTime <= time));
}

export function listGrades(learners: readonly Pick<Learner, 'grade'>[]): number[] {
  return [...new Set(learners.map((l) => l.grade))].sort((a, b) => a - b);
}

export function listSections(learners: readonly Pick<Learner, 'grade' | 'section'>[], grade?: number | null): string[] {
  const set = new Set<string>();
  for (const l of learners) {
    if (grade == null || l.grade === grade) set.add(l.section);
  }
  return [...set].sort(compareText);
}

export interface StatusCounts {
  completed: number;
  pending: number;
  overdue: number;
  total: number;
}

export function countStatuses(assignments: readonly Assignment[], today: string, time = '00:00'): StatusCounts {
  const counts: StatusCounts = { completed: 0, pending: 0, overdue: 0, total: assignments.length };
  for (const a of assignments) {
    if (a.status === 'completed') counts.completed += 1;
    else if (isOverdue(a, today, time)) counts.overdue += 1;
    else counts.pending += 1;
  }
  return counts;
}

export interface GroupRow {
  key: string;
  grade: number;
  section: string | null;
  label: string;
  learners: number;
  /** Learners with at least one assigned task. */
  assigned: number;
  notAssigned: number;
  pending: number;
  overdue: number;
  completed: number;
}

export function buildGroupSummary(
  learners: readonly Learner[],
  assignments: readonly Assignment[],
  today: string,
  by: 'section' | 'grade',
  time = '00:00',
): GroupRow[] {
  const rows = new Map<string, GroupRow>();
  const learnerKey = new Map<string, string>();

  for (const l of learners) {
    const key = by === 'grade' ? String(l.grade) : `${l.grade}|${l.section}`;
    learnerKey.set(l.id, key);
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        grade: l.grade,
        section: by === 'section' ? l.section : null,
        label: by === 'grade' ? `Grade ${l.grade}` : `Grade ${l.grade} · ${l.section}`,
        learners: 0,
        assigned: 0,
        notAssigned: 0,
        pending: 0,
        overdue: 0,
        completed: 0,
      };
      rows.set(key, row);
    }
    row.learners += 1;
  }

  const assignedLearners = new Set<string>();
  for (const a of assignments) {
    const key = learnerKey.get(a.learnerId);
    if (!key) continue;
    const row = rows.get(key);
    if (!row) continue;
    assignedLearners.add(a.learnerId);
    if (a.status === 'completed') row.completed += 1;
    else if (isOverdue(a, today, time)) row.overdue += 1;
    else row.pending += 1;
  }

  for (const l of learners) {
    const key = learnerKey.get(l.id);
    const row = key ? rows.get(key) : undefined;
    if (row && assignedLearners.has(l.id)) row.assigned += 1;
  }
  rows.forEach((row) => {
    row.notAssigned = row.learners - row.assigned;
  });

  return [...rows.values()].sort((a, b) => a.grade - b.grade || compareText(a.section ?? '', b.section ?? ''));
}

export interface TrendPoint {
  date: string;
  /** Attendance rate, 0–100. */
  rate: number;
  present: number;
  absent: number;
}

/**
 * Attendance rate per recorded day inside the scope. Only learners that still exist
 * (`learnerIds`) are counted, and days without any record are skipped.
 */
export function buildAttendanceTrend(
  records: readonly AttendanceRecord[],
  learnerIds: ReadonlySet<string>,
  scope: Scope,
  days: number,
  today: string,
): TrendPoint[] {
  const from = addDays(today, -(days - 1));
  const byDate = new Map<string, { present: number; absent: number }>();

  for (const rec of records) {
    if (rec.date < from || rec.date > today) continue;
    if (scope.grade !== null && rec.grade !== scope.grade) continue;
    if (scope.section !== null && rec.section !== scope.section) continue;
    const bucket = byDate.get(rec.date) ?? { present: 0, absent: 0 };
    for (const [learnerId, status] of Object.entries(rec.records)) {
      if (!learnerIds.has(learnerId)) continue;
      if (status === 'present') bucket.present += 1;
      else bucket.absent += 1;
    }
    byDate.set(rec.date, bucket);
  }

  return [...byDate.entries()]
    .map(([date, { present, absent }]) => ({
      date,
      present,
      absent,
      rate: present + absent === 0 ? 0 : Math.round((present / (present + absent)) * 100),
    }))
    .filter((p) => p.present + p.absent > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}
