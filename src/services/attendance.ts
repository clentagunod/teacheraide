import { getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { isValidISODate } from '@/lib/dates';
import { col, ref } from '@/services/firestore';
import { toAttendance } from '@/services/mappers';
import type { AttendanceRecord, AttendanceStatus } from '@/types';
import { sendAuditEvent } from '@/services/adminScript';

/** One document per day + section. Deterministic id means saving twice overwrites, never duplicates. */
export const attendanceId = (date: string, grade: number, sectionId: string): string =>
  `${date}_${grade}_${sectionId}`;

export async function getAttendance(
  _user: User,
  date: string,
  grade: number,
  sectionId: string,
): Promise<AttendanceRecord | null> {
  const snapshot = await getDocs(query(
    col('attendance'),
    where('date', '==', date),
    where('sectionId', '==', sectionId),
  ));
  const matching = snapshot.docs
    .map(toAttendance)
    .find((record) => record.grade === grade);
  return matching ?? null;
}

export interface SaveAttendanceInput {
  date: string;
  grade: number;
  section: string;
  sectionId: string;
  records: Record<string, AttendanceStatus>;
}

export async function saveAttendance(_user: User, input: SaveAttendanceInput): Promise<void> {
  if (!isValidISODate(input.date)) throw new Error('Invalid date');
  const id = attendanceId(input.date, input.grade, input.sectionId);
  await setDoc(ref('attendance', id), {
    date: input.date,
    grade: input.grade,
    section: input.section,
    sectionId: input.sectionId,
    records: input.records,
    updatedAt: serverTimestamp(),
  });
  await sendAuditEvent('save', 'attendance', id);
}
