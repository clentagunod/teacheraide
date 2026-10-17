import { describe, expect, it } from 'vitest';
import { getLearnerImportErrorMessage, parseLearnerRoster } from '@/lib/learnerImport';
import type { SchoolSection } from '@/types';

const sections: SchoolSection[] = [
  { id: 'section-10-spj', sectionId: 'section-10-spj', grade: 10, name: 'SPJ' },
];

describe('parseLearnerRoster', () => {
  it('maps roster content into the existing learner fields without changing its structure', () => {
    const roster = parseLearnerRoster(JSON.stringify({
      Grade: '10',
      Section: 'SPJ',
      learners: [
        { Surname: 'ARNIEGO', Name: 'ERVIN', 'Middle I': 'M.', Gender: 'Male' },
        { Surname: 'ALCANO', Name: 'ASHLEY MAUREEN', 'Middle I': 'C.', Gender: 'Female' },
      ],
    }), sections);

    expect(roster.grade).toBe(10);
    expect(roster.section.sectionId).toBe('section-10-spj');
    expect(roster.learners).toEqual([
      {
        firstName: 'ERVIN',
        middleInitial: 'M',
        lastName: 'ARNIEGO',
        gender: 'male',
        grade: 10,
        section: 'SPJ',
        sectionId: 'section-10-spj',
      },
      {
        firstName: 'ASHLEY MAUREEN',
        middleInitial: 'C',
        lastName: 'ALCANO',
        gender: 'female',
        grade: 10,
        section: 'SPJ',
        sectionId: 'section-10-spj',
      },
    ]);
  });

  describe('getLearnerImportErrorMessage', () => {
    it('explains the Firestore configuration to verify after a permission denial', () => {
      const message = getLearnerImportErrorMessage({
        code: 'permission-denied',
        message: 'Missing or insufficient permissions.',
      });

      expect(message).toContain('Publish the latest firestore.rules');
      expect(message).toContain('gender and middleInitial');
      expect(message).toContain('staff profile role is admin');
      expect(message).toContain('selected section exists');
    });

    it('preserves the existing error message for other failures', () => {
      expect(getLearnerImportErrorMessage(new Error('Network unavailable.'))).toBe('Network unavailable.');
    });
  });

  it('rejects a section that has not been provisioned', () => {
    expect(() => parseLearnerRoster(JSON.stringify({
      Grade: '10',
      Section: 'SPJ',
      learners: [{ Surname: 'ARNIEGO', Name: 'ERVIN', 'Middle I': 'M.', Gender: 'Male' }],
    }), [])).toThrow('has not been created in Administration');
  });

  it('rejects duplicate learner records in the source roster', () => {
    const learner = { Surname: 'ARNIEGO', Name: 'ERVIN', 'Middle I': 'M.', Gender: 'Male' };
    expect(() => parseLearnerRoster(JSON.stringify({
      Grade: '10',
      Section: 'SPJ',
      learners: [learner, learner],
    }), sections)).toThrow('appears more than once');
  });
});