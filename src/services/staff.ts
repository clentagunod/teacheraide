import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, getAuth, inMemoryPersistence, setPersistence } from 'firebase/auth';
import { serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseConfig } from '@/lib/firebase';
import { staffRef } from '@/services/firestore';
import type { StaffProfile } from '@/types';

export type NewStaffProfile = Omit<Pick<StaffProfile, 'email' | 'displayName' | 'role' | 'grade' | 'sectionId' | 'subjectId'>, 'role'> & {
  role: 'teacher' | 'supervisor';
  section: string | null;
};

export async function createStaffAccount(profile: NewStaffProfile, password: string): Promise<string> {
  const secondaryApp = initializeApp(firebaseConfig, `staff-provision-${crypto.randomUUID()}`);
  const secondaryAuth = getAuth(secondaryApp);
  let createdUser: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>['user'] | null = null;

  try {
    await setPersistence(secondaryAuth, inMemoryPersistence);
    const credential = await createUserWithEmailAndPassword(secondaryAuth, profile.email, password);
    createdUser = credential.user;
    await setDoc(staffRef(createdUser.uid), {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return createdUser.uid;
  } catch (error) {
    if (createdUser) {
      try {
        await deleteUser(createdUser);
      } catch (rollbackError) {
        const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : 'unknown rollback error';
        throw new Error(`The staff profile could not be saved, and the new sign-in account could not be rolled back (${rollbackMessage}). Remove the incomplete account in Firebase Console.`);
      }
    }
    throw error;
  } finally {
    await deleteApp(secondaryApp);
  }
}
