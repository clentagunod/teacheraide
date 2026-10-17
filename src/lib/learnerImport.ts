import type { SchoolSection } from '@/types';
import { getErrorMessage } from '@/lib/errors';
import { clean, validateLearner, type LearnerInput } from '@/lib/validation';

export interface ParsedLearnerRoster {
  grade: number;
  section: SchoolSection;
  learners: LearnerInput[];
}

export function getLearnerImportErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied') {
    return 'Firestore denied the learner writes. Publish the latest firestore.rules to the same Firebase project the app uses. Its learner create rule must allow the gender and middleInitial fields. Also confirm your staff profile role is admin and the selected section exists in that project.';
  }
  return getErrorMessage(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, label: string, row: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(row ? `Learner row ${row}: ${label} is required.` : `${label} is required in the roster.`);
  }
  return value.trim();
}

function duplicateKey(learner: Pick<LearnerInput, 'firstName' | 'middleInitial' | 'lastName'>): string {
  return [learner.firstName, learner.middleInitial, learner.lastName]
    .map((part) => part.toLocaleLowerCase())
    .join('|');
}

export function parseLearnerRoster(content: string, sections: readonly SchoolSection[]): ParsedLearnerRoster {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  if (!isRecord(parsed)) throw new Error('The roster JSON must be an object containing Grade, Section, and learners.');
  const gradeValue = parsed.Grade;
  const grade = typeof gradeValue === 'number' || (typeof gradeValue === 'string' && /^\d+$/.test(gradeValue.trim()))
    ? Number(gradeValue)
    : NaN;
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
    throw new Error('The roster Grade must be a whole number from 1 to 12.');
  }
  const sectionName = requiredString(parsed.Section, 'Section', 0);
  const section = sections.find((item) =>
    item.grade === grade && item.name.toLocaleLowerCase() === clean(sectionName).toLocaleLowerCase(),
  );
  if (!section) throw new Error(`Grade ${grade} · ${sectionName} has not been created in Administration. Create the section before importing learners.`);
  if (!Array.isArray(parsed.learners) || parsed.learners.length === 0) {
    throw new Error('The roster must contain at least one learner.');
  }
  if (parsed.learners.length > 500) throw new Error('Import is limited to 500 learners at a time.');

  const seen = new Set<string>();
  const learners = parsed.learners.map((item, index) => {
    const row = index + 1;
    if (!isRecord(item)) throw new Error(`Learner row ${row} must be an object.`);
    const firstName = requiredString(item.Name, 'Name', row);
    const middleValue = item['Middle I'];
    if (middleValue !== undefined && middleValue !== null && typeof middleValue !== 'string') {
      throw new Error(`Learner row ${row}: Middle I must be text.`);
    }
    const middleSource = typeof middleValue === 'string' ? middleValue.trim() : '';
    const middleInitial = middleSource.replace(/[.\s]/g, '');
    const lastName = requiredString(item.Surname, 'Surname', row);
    const gender = requiredString(item.Gender, 'Gender', row).toLocaleLowerCase();
    if (gender !== 'female' && gender !== 'male') {
      throw new Error(`Learner row ${row}: Gender must be Female or Male.`);
    }

    const result = validateLearner({
      firstName,
      middleInitial,
      lastName,
      gender,
      grade,
      sectionId: section.sectionId,
    }, [section]);
    const firstValidationError = Object.values(result.errors)[0];
    if (!result.valid) throw new Error(`Learner row ${row}: ${firstValidationError}`);

    const key = duplicateKey(result.value);
    if (seen.has(key)) throw new Error(`Learner row ${row}: this learner appears more than once in the roster.`);
    seen.add(key);
    return result.value;
  });

  return { grade, section, learners };
}