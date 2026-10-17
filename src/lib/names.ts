import type { Learner } from '@/types';

export function learnerFullName(learner: Pick<Learner, 'firstName' | 'middleInitial' | 'lastName'>): string {
  const initial = learner.middleInitial.replace(/\.$/, '');
  return [learner.firstName, initial && `${initial}.`, learner.lastName]
    .filter(Boolean)
    .join(' ');
}

export function learnerLastNameFirst(learner: Pick<Learner, 'firstName' | 'middleInitial' | 'lastName'>): string {
  const initial = learner.middleInitial.replace(/\.$/, '');
  return `${learner.lastName}, ${learner.firstName}${initial ? ` ${initial}.` : ''}`;
}
