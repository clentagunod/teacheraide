import { describe, expect, it } from 'vitest';
import { toAssignment, toLearner, toStaffProfile, toSubject, toTask } from '@/services/mappers';

const snapshot = (id: string, data: Record<string, unknown>) => ({ id, data: () => data });

describe('subject mapping', () => {
  it('preserves administrator-created subject IDs and colors', () => {
    expect(toSubject(snapshot('custom-science', { name: 'Earth Science', color: 'teal' }))).toEqual({
      id: 'custom-science',
      name: 'Earth Science',
      color: 'teal',
    });

  });

  it('reads dynamic subject assignments and supports legacy profiles', () => {
    expect(toStaffProfile(snapshot('teacher-1', {
      role: 'teacher',
      subjectId: 'custom-science',
      learningArea: 'math',
    })).subjectId).toBe('custom-science');

    expect(toStaffProfile(snapshot('teacher-2', {
      role: 'teacher',
      learningArea: 'math',
    })).subjectId).toBe('math');
  });
});

describe('task mapping', () => {
  it('preserves task ownership and archive state while supporting legacy tasks', () => {
    expect(toTask(snapshot('task-1', {
      subjectId: 'math',
      title: 'Fractions',
      description: '',
      createdBy: 'teacher-1',
      active: false,
    }))).toMatchObject({ createdBy: 'teacher-1', active: false });

    expect(toTask(snapshot('task-2', {
      subjectId: 'math',
      title: 'Decimals',
      description: '',
    }))).toMatchObject({ createdBy: null, active: true });
  });
});

describe('assignment mapping', () => {
  it('keeps independent statuses and applies the default due time to legacy records', () => {
    const pending = toAssignment(snapshot('assignment-1', {
      learnerId: 'learner-1',
      taskId: 'english-1',
      subjectId: 'english',
      dueDate: '2026-10-18',
      status: 'pending',
    }));
    const completed = toAssignment(snapshot('assignment-2', {
      learnerId: 'learner-1',
      taskId: 'math-1',
      subjectId: 'math',
      dueDate: '2026-10-18',
      dueTime: '10:30',
      status: 'completed',
    }));

    expect(pending).toMatchObject({ status: 'pending', dueTime: '23:59' });
    expect(completed).toMatchObject({ status: 'completed', dueTime: '10:30' });
    expect(pending.id).not.toBe(completed.id);
  });
});

describe('learner mapping', () => {
  it('reads a stored middle initial and defaults it for older learner records', () => {
    expect(toLearner(snapshot('learner-1', {
      firstName: 'Ana',
      middleInitial: 'B',
      lastName: 'Reyes',
    })).middleInitial).toBe('B');

    expect(toLearner(snapshot('learner-2', {
      firstName: 'Ben',
      lastName: 'Cruz',
    })).middleInitial).toBe('');
  });
});
