import { isValidISODate } from '@/lib/dates';
import type { LearnerGender, SubjectColor } from '@/types';

export const LIMITS = {
  name: 40,
  section: 30,
  subject: 40,
  taskTitle: 80,
  taskDescription: 300,
} as const;

export const GRADES: readonly number[] = Array.from({ length: 12 }, (_, i) => i + 1);
export const SUBJECT_COLOR_KEYS: readonly SubjectColor[] = ['violet', 'blue', 'pink', 'teal', 'amber', 'rose'];

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export interface ValidationResult<T> {
  valid: boolean;
  value: T;
  errors: FieldErrors<T>;
}

/** Trim and collapse runs of whitespace into single spaces. */
export function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Like `clean` but keeps line breaks (max one blank line). */
export function cleanMultiline(value: string): string {
  return value
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Reuse the spelling of an existing section when it matches case-insensitively. */
export function canonicalSection(input: string, existing: readonly string[]): string {
  const cleaned = clean(input);
  const match = existing.find((s) => s.toLowerCase() === cleaned.toLowerCase());
  return match ?? cleaned;
}

function finish<T>(value: T, errors: FieldErrors<T>): ValidationResult<T> {
  return { valid: Object.keys(errors).length === 0, value, errors };
}

export interface LearnerInput {
  firstName: string;
  middleInitial: string;
  lastName: string;
  gender: LearnerGender;
  grade: number;
  section: string;
  sectionId: string;
}

export function validateLearner(
  input: { firstName: string; middleInitial?: string; lastName: string; gender: LearnerGender | ''; grade: number | null; sectionId: string },
  sections: readonly { sectionId: string; grade: number; name: string }[] = [],
): ValidationResult<LearnerInput> {
  const errors: FieldErrors<LearnerInput> = {};
  const firstName = clean(input.firstName);
  const middleInitial = clean(input.middleInitial ?? '').replace(/\.$/, '');
  const lastName = clean(input.lastName);
  const gender = input.gender;
  const grade = input.grade ?? 0;
  const selectedSection = sections.find((section) => section.sectionId === input.sectionId && section.grade === grade);

  if (!firstName) errors.firstName = 'First name is required.';
  else if (firstName.length > LIMITS.name) errors.firstName = `Keep it under ${LIMITS.name} characters.`;
  if (middleInitial && !/^\p{L}$/u.test(middleInitial)) errors.middleInitial = 'Enter one letter for the middle initial.';
  if (gender !== 'female' && gender !== 'male') errors.gender = 'Select Female or Male.';
  if (!lastName) errors.lastName = 'Last name is required.';
  else if (lastName.length > LIMITS.name) errors.lastName = `Keep it under ${LIMITS.name} characters.`;
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) errors.grade = 'Choose a grade from 1 to 12.';
  if (!selectedSection) errors.sectionId = 'Choose a section created by the administrator.';
  else if (selectedSection.name.length > LIMITS.section) errors.sectionId = `Keep it under ${LIMITS.section} characters.`;

  return finish(
    { firstName, middleInitial, lastName, gender: gender === 'female' || gender === 'male' ? gender : 'female', grade, section: selectedSection?.name ?? '', sectionId: selectedSection?.sectionId ?? '' },
    errors,
  );
}

export interface SubjectInput {
  name: string;
  color: SubjectColor;
}

export function validateSubject(
  input: SubjectInput,
  otherNames: readonly string[] = [],
): ValidationResult<SubjectInput> {
  const errors: FieldErrors<SubjectInput> = {};
  const name = clean(input.name);
  if (!name) errors.name = 'Subject name is required.';
  else if (name.length > LIMITS.subject) errors.name = `Keep it under ${LIMITS.subject} characters.`;
  else if (otherNames.some((n) => n.toLowerCase() === name.toLowerCase())) errors.name = 'That subject already exists.';
  const color = SUBJECT_COLOR_KEYS.includes(input.color) ? input.color : 'violet';
  return finish({ name, color }, errors);
}

export interface TaskInput {
  title: string;
  description: string;
}

export function validateTask(
  input: TaskInput,
  otherTitles: readonly string[] = [],
): ValidationResult<TaskInput> {
  const errors: FieldErrors<TaskInput> = {};
  const title = clean(input.title);
  const description = cleanMultiline(input.description);
  if (!title) errors.title = 'Task title is required.';
  else if (title.length > LIMITS.taskTitle) errors.title = `Keep it under ${LIMITS.taskTitle} characters.`;
  else if (otherTitles.some((t) => t.toLowerCase() === title.toLowerCase())) errors.title = 'This subject already has a task with that title.';
  if (description.length > LIMITS.taskDescription) errors.description = `Keep it under ${LIMITS.taskDescription} characters.`;
  return finish({ title, description }, errors);
}

export function validateDueDate(value: string): string | null {
  if (!value) return 'Choose a due date.';
  if (!isValidISODate(value)) return 'Enter a valid date.';
  const year = Number(value.slice(0, 4));
  if (year < 2000 || year > 2100) return 'Enter a date between 2000 and 2100.';
  return null;
}

export function validateDueTime(value: string): string | null {
  if (!value) return null;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? null : 'Choose a valid due time.';
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.length <= 254;
}
