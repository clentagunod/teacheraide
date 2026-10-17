import { describe, expect, it } from 'vitest';
import { learnerFullName, learnerLastNameFirst } from '@/lib/names';
import type { Learner } from '@/types';

const learner: Learner = {
  id: 'learner-1',
  firstName: 'Ana',
  middleInitial: 'B',
  lastName: 'Reyes',
  gender: 'female',
  grade: 7,
  section: 'Rizal',
  sectionId: 'g7-r',
};

describe('learner name formatting', () => {
  it('includes the middle initial in both name orders', () => {
    expect(learnerFullName(learner)).toBe('Ana B. Reyes');
    expect(learnerLastNameFirst(learner)).toBe('Reyes, Ana B.');
  });

  it('avoids an empty middle-initial placeholder', () => {
    expect(learnerFullName({ ...learner, middleInitial: '' })).toBe('Ana Reyes');
  });
});
