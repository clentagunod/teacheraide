import { describe, expect, it } from 'vitest';
import { buildAttendanceTrend, buildGroupSummary, countStatuses, inScope, isOverdue, listSections } from '@/lib/analytics';
import type { Assignment, AttendanceRecord, Learner } from '@/types';

const learners: Learner[] = [
  { id: 'a', firstName: 'Ana', middleInitial: '', lastName: 'Reyes', gender: 'female', grade: 7, section: 'Rizal', sectionId: 'g7-r' },
  { id: 'b', firstName: 'Ben', middleInitial: '', lastName: 'Cruz', gender: 'male', grade: 7, section: 'Rizal', sectionId: 'g7-r' },
  { id: 'c', firstName: 'Cai', middleInitial: '', lastName: 'Lim', gender: null, grade: 8, section: 'Bonifacio', sectionId: 'g8-b' },
];

const assignments: Assignment[] = [
  { id: '1', learnerId: 'a', taskId: 't1', subjectId: 's1', dueDate: '2026-10-10', dueTime: '23:59', status: 'pending' },
  { id: '2', learnerId: 'a', taskId: 't2', subjectId: 's1', dueDate: '2026-10-20', dueTime: '23:59', status: 'pending' },
  { id: '3', learnerId: 'b', taskId: 't1', subjectId: 's1', dueDate: '2026-10-10', dueTime: '23:59', status: 'completed' },
];

const today = '2026-10-16';

describe('overdue logic', () => {
  it('flags only pending tasks past their due date', () => {
    expect(isOverdue(assignments[0], today)).toBe(true);
    expect(isOverdue(assignments[1], today)).toBe(false);
    expect(isOverdue(assignments[2], today)).toBe(false);
  });

  it('does not treat a task due today as overdue', () => {
    expect(isOverdue({ status: 'pending', dueDate: today, dueTime: '23:59' }, today, '23:58')).toBe(false);
  });

  it('marks a task overdue after its specified time on the due date', () => {
    const task = { status: 'pending' as const, dueDate: today, dueTime: '09:30' };
    expect(isOverdue(task, today, '09:29')).toBe(false);
    expect(isOverdue(task, today, '09:30')).toBe(true);
    expect(isOverdue({ ...task, status: 'completed' }, today, '10:00')).toBe(false);
  });

  it('counts statuses', () => {
    expect(countStatuses(assignments, today)).toEqual({ completed: 1, pending: 1, overdue: 1, total: 3 });
  });
});

describe('scope', () => {
  it('filters by grade and section', () => {
    expect(inScope(learners[0], { grade: null, section: null })).toBe(true);
    expect(inScope(learners[0], { grade: 8, section: null })).toBe(false);
    expect(inScope(learners[2], { grade: 8, section: 'Bonifacio' })).toBe(true);
  });

  it('lists sections for a grade', () => {
    expect(listSections(learners, 7)).toEqual(['Rizal']);
    expect(listSections(learners)).toEqual(['Bonifacio', 'Rizal']);
  });
});

describe('group summary', () => {
  it('splits assigned and not assigned learners per section', () => {
    const rows = buildGroupSummary(learners, assignments, today, 'section');
    const rizal = rows.find((r) => r.section === 'Rizal');
    const boni = rows.find((r) => r.section === 'Bonifacio');
    expect(rizal).toMatchObject({ learners: 2, assigned: 2, notAssigned: 0, overdue: 1, completed: 1, pending: 1 });
    expect(boni).toMatchObject({ learners: 1, assigned: 0, notAssigned: 1 });
  });

  it('rolls up per grade', () => {
    const rows = buildGroupSummary(learners, assignments, today, 'grade');
    expect(rows.map((r) => r.label)).toEqual(['Grade 7', 'Grade 8']);
  });
});

describe('attendance trend', () => {
  const records: AttendanceRecord[] = [
    { id: 'r1', date: '2026-10-15', grade: 7, section: 'Rizal', sectionId: 'g7-r', records: { a: 'present', b: 'absent', gone: 'present' } },
    { id: 'r2', date: '2026-10-16', grade: 7, section: 'Rizal', sectionId: 'g7-r', records: { a: 'present', b: 'present' } },
    { id: 'r3', date: '2026-09-01', grade: 7, section: 'Rizal', sectionId: 'g7-r', records: { a: 'present' } },
  ];

  it('computes rates, ignores deleted learners and out-of-range days', () => {
    const trend = buildAttendanceTrend(records, new Set(['a', 'b']), { grade: null, section: null }, 7, today);
    expect(trend).toEqual([
      { date: '2026-10-15', rate: 50, present: 1, absent: 1 },
      { date: '2026-10-16', rate: 100, present: 2, absent: 0 },
    ]);
  });

  it('respects the scope', () => {
    const trend = buildAttendanceTrend(records, new Set(['a', 'b']), { grade: 8, section: null }, 7, today);
    expect(trend).toEqual([]);
  });
});
