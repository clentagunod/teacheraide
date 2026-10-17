import { deleteDoc, doc, serverTimestamp, updateDoc, type WriteBatch } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { col, commitInChunks, ref } from '@/services/firestore';
import type { AssignmentStatus, Learner } from '@/types';
import { sendAuditEvent } from '@/services/adminScript';
import { DEFAULT_DUE_TIME } from '@/lib/dates';

// Assignment rules validate the learner, task, subject, and staff profile for each write.
const ASSIGNMENT_BATCH_LIMIT = 5;

export interface AssignInput {
  assignments: {
    learner: Pick<Learner, 'id' | 'grade' | 'section' | 'sectionId'>;
    taskId: string;
    subjectId: string;
  }[];
  dueDate: string;
  dueTime?: string;
}

export interface AssignmentMutationResult {
  auditWarning: string | null;
}

export const MAX_TASKS_PER_BULK_ASSIGNMENT = 10;
export const assignmentDocumentId = (learnerId: string, taskId: string): string => `${learnerId}_${taskId}`;

async function auditWarning(action: string, entity: string, entityId: string): Promise<string | null> {
  try {
    await sendAuditEvent(action, entity, entityId);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'The change was saved, but its audit event could not be delivered.';
  }
}

/** Creates one independently tracked assignment for each learner-task pair. */
export async function assignTasks(_user: User, input: AssignInput): Promise<AssignmentMutationResult & { created: number }> {
  if (input.assignments.length === 0) throw new Error('Select at least one learner and task.');
  if (new Set(input.assignments.map((assignment) => assignment.taskId)).size > MAX_TASKS_PER_BULK_ASSIGNMENT) {
    throw new Error(`Assign no more than ${MAX_TASKS_PER_BULK_ASSIGNMENT} different tasks at a time.`);
  }
  const uniquePairs = new Set(input.assignments.map(({ learner, taskId }) => `${learner.id}:${taskId}`));
  if (uniquePairs.size !== input.assignments.length) throw new Error('Each learner can only receive a task once.');
  const ops = input.assignments.map(({ learner, taskId, subjectId }) => {
    const target = doc(col('assignments'), assignmentDocumentId(learner.id, taskId));
    return (batch: WriteBatch) =>
      batch.set(target, {
        learnerId: learner.id,
        grade: learner.grade,
        section: learner.section,
        sectionId: learner.sectionId,
        taskId,
        subjectId,
        dueDate: input.dueDate,
        dueTime: input.dueTime || DEFAULT_DUE_TIME,
        status: 'pending' as AssignmentStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
  });
  await commitInChunks(ops, ASSIGNMENT_BATCH_LIMIT);
  const auditWarnings = await Promise.all(
    [...new Set(input.assignments.map((assignment) => assignment.taskId))]
      .map((taskId) => auditWarning('assign', 'task', taskId)),
  );
  return {
    created: ops.length,
    auditWarning: auditWarnings.filter((message): message is string => message !== null).join(' ') || null,
  };
}

export interface AssignmentPatch {
  taskId: string;
  subjectId: string;
  dueDate: string;
  dueTime: string;
  status: AssignmentStatus;
}

export async function updateAssignment(_user: User, id: string, patch: AssignmentPatch): Promise<AssignmentMutationResult> {
  await updateDoc(ref('assignments', id), { ...patch, updatedAt: serverTimestamp() });
  return { auditWarning: await auditWarning('update', 'assignment', id) };
}

export async function removeAssignment(_user: User, id: string): Promise<AssignmentMutationResult> {
  await deleteDoc(ref('assignments', id));
  return { auditWarning: await auditWarning('delete', 'assignment', id) };
}
