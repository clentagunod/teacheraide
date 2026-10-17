import { collection, doc, writeBatch, type CollectionReference, type DocumentReference, type WriteBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type CollectionName = 'learners' | 'tasks' | 'assignments' | 'attendance' | 'sections' | 'staff' | 'subjects' | 'settings';

/** Shared records for this single-school deployment live under one predictable root. */
export const SCHOOL_ID = 'teacher-aide';
export const col = (name: CollectionName): CollectionReference => collection(db, 'schools', SCHOOL_ID, name);
export const ref = (name: CollectionName, id: string): DocumentReference => doc(db, 'schools', SCHOOL_ID, name, id);
export const staffRef = (uid: string): DocumentReference => ref('staff', uid);

// Firestore allows 500 writes per batch; stay below it.
const BATCH_LIMIT = 450;

/**
 * Runs write operations in batches. Each batch is atomic; very large sets (>450 ops)
 * span several batches, which are committed in order.
 */
export async function commitInChunks(
  ops: Array<(batch: WriteBatch) => void>,
  batchLimit = BATCH_LIMIT,
): Promise<void> {
  for (let i = 0; i < ops.length; i += batchLimit) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + batchLimit)) op(batch);
    await batch.commit();
  }
}
