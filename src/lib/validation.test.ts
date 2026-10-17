import { describe, expect, it } from 'vitest';
import { addDays, diffInDays, isValidISODate, toISODate } from '@/lib/dates';
import { canonicalSection, clean, validateDueDate, validateLearner, validateSubject, validateTask } from '@/lib/validation';

describe('text cleaning', () => {
  it('trims and collapses whitespace', () => {
    expect(clean('  Maria   Clara \n')).toBe('Maria Clara');
  });

  it('reuses existing section spelling', () => {
    expect(canonicalSection('rizal ', ['Rizal', 'Bonifacio'])).toBe('Rizal');
    expect(canonicalSection('Mabini', ['Rizal'])).toBe('Mabini');
  });
});

describe('validateLearner', () => {
  it('accepts valid input and cleans it', () => {
    const sections = [{ grade: 7, name: 'Rizal', sectionId: 'grade_7_rizal' }];
    const r = validateLearner({ firstName: ' Ana ', middleInitial: ' B. ', lastName: 'Reyes', gender: 'female', grade: 7, sectionId: 'grade_7_rizal' }, sections);
    expect(r.valid).toBe(true);
    expect(r.value).toEqual({ firstName: 'Ana', middleInitial: 'B', lastName: 'Reyes', gender: 'female', grade: 7, section: 'Rizal', sectionId: 'grade_7_rizal' });
  });

  it('allows an empty middle initial and rejects more than one initial', () => {
    const sections = [{ grade: 7, name: 'Rizal', sectionId: 'grade_7_rizal' }];
    expect(validateLearner({ firstName: 'Ana', lastName: 'Reyes', gender: 'male', grade: 7, sectionId: 'grade_7_rizal' }, sections).value.middleInitial).toBe('');
    expect(validateLearner({ firstName: 'Ana', middleInitial: 'AB', lastName: 'Reyes', gender: 'male', grade: 7, sectionId: 'grade_7_rizal' }, sections).errors.middleInitial)
      .toBe('Enter one letter for the middle initial.');
    expect(validateLearner({ firstName: 'Ana', lastName: 'Reyes', gender: '', grade: 7, sectionId: 'grade_7_rizal' }, sections).errors.gender)
      .toBe('Select Female or Male.');
  });

  it('reports every invalid field', () => {
    const r = validateLearner({ firstName: '', lastName: 'x'.repeat(41), gender: '', grade: null, sectionId: '' });
    expect(Object.keys(r.errors).sort()).toEqual(['firstName', 'gender', 'grade', 'lastName', 'sectionId']);
  });
});

describe('subjects and tasks', () => {
  it('rejects duplicate subject names case-insensitively', () => {
    expect(validateSubject({ name: 'math', color: 'blue' }, ['Math']).valid).toBe(false);
  });

  it('rejects duplicate task titles within a subject', () => {
    expect(validateTask({ title: 'Quiz 1', description: '' }, ['quiz 1']).valid).toBe(false);
    expect(validateTask({ title: 'Quiz 2', description: '' }, ['quiz 1']).valid).toBe(true);
  });
});

describe('dates', () => {
  it('validates ISO dates strictly', () => {
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2026-02-28')).toBe(true);
    expect(isValidISODate('26-1-1')).toBe(false);
  });

  it('does date math on calendar days', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(diffInDays('2026-10-10', '2026-10-16')).toBe(6);
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('validates due dates', () => {
    expect(validateDueDate('')).not.toBeNull();
    expect(validateDueDate('2026-10-16')).toBeNull();
    expect(validateDueDate('1999-01-01')).not.toBeNull();
  });
});
