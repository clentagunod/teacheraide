import { addDoc, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { LearnerInput } from '@/lib/validation';
import { db } from '@/lib/firebase';
import { col, commitInChunks, ref } from '@/services/firestore';
import { sendAuditEvent } from '@/services/adminScript';
import { getLearnerImportErrorMessage } from '@/lib/learnerImport';

const LEARNER_IMPORT_BATCH_SIZE = 5;

export async function addLearner(_user: User, input: LearnerInput): Promise<void> {
  const learner = await addDoc(col('learners'), { ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await sendAuditEvent('create', 'learner', learner.id);
}

export interface LearnerImportResult {
  created: number;
  skipped: number;
  auditWarning: string | null;
}

function learnerNameKey(learner: { firstName?: unknown; middleInitial?: unknown; lastName?: unknown }): string {
  return [learner.firstName, learner.middleInitial, learner.lastName]
    .map((part) => typeof part === 'string' ? part.trim().toLocaleLowerCase() : '')
    .join('|');
}

export async function importLearners(
  _user: User,
  sectionId: string,
  inputs: readonly LearnerInput[],
): Promise<LearnerImportResult> {
  const existing = await getDocs(query(col('learners'), where('sectionId', '==', sectionId)));
  const knownNames = new Set(existing.docs.map((snapshot) => learnerNameKey(snapshot.data())));
  const pending = inputs.filter((learner) => {
    const key = learnerNameKey(learner);
    if (knownNames.has(key)) return false;
    knownNames.add(key);
    return true;
  });
  const createdIds: string[] = [];

  try {
    for (let offset = 0; offset < pending.length; offset += LEARNER_IMPORT_BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = pending.slice(offset, offset + LEARNER_IMPORT_BATCH_SIZE);
      const refs = chunk.map(() => doc(col('learners')));
      chunk.forEach((learner, index) => {
        batch.set(refs[index], {
          ...learner,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      createdIds.push(...refs.map((learnerRef) => learnerRef.id));
    }
  } catch (error) {
    const detail = getLearnerImportErrorMessage(error);
    throw new Error(`Import stopped after ${createdIds.length} learner${createdIds.length === 1 ? '' : 's'} were added. ${detail}`);
  }

  let auditWarning: string | null = null;
  try {
    for (let offset = 0; offset < createdIds.length; offset += 10) {
      await Promise.all(createdIds.slice(offset, offset + 10).map((id) => sendAuditEvent('create', 'learner', id)));
    }
  } catch (error) {
    auditWarning = error instanceof Error ? error.message : 'Audit delivery failed.';
  }

  return { created: createdIds.length, skipped: inputs.length - pending.length, auditWarning };
}

export async function updateLearner(_user: User, id: string, input: LearnerInput): Promise<void> {
  const learnerRef = ref('learners', id);
  const current = await getDoc(learnerRef);
  if (!current.exists()) throw new Error('This learner no longer exists.');
  const currentData = current.data();
  if (currentData.sectionId !== input.sectionId) {
    const assignments = await getDocs(query(col('assignments'), where('learnerId', '==', id)));
    if (assignments.size > 499) {
      throw new Error('This learner has too many assignments to transfer safely. Remove old assignments before changing sections.');
    }
    const batch = writeBatch(db);
    batch.update(learnerRef, { ...input, updatedAt: serverTimestamp() });
    assignments.docs.forEach((assignment) => {
      batch.update(assignment.ref, {
        grade: input.grade,
        section: input.section,
        sectionId: input.sectionId,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } else {
    await updateDoc(learnerRef, { ...input, updatedAt: serverTimestamp() });
  }
  await sendAuditEvent('update', 'learner', id);
}

/** Removes the learner and every task assignment that belongs to them. */
export async function removeLearner(_user: User, id: string): Promise<void> {
  const owned = await getDocs(query(col('assignments'), where('learnerId', '==', id)));
  const ops = owned.docs.map((d) => (batch: import('firebase/firestore').WriteBatch) => batch.delete(d.ref));
  ops.push((batch) => batch.delete(ref('learners', id)));
  await commitInChunks(ops);
  await sendAuditEvent('delete', 'learner', id);
}
