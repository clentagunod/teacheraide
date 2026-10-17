import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStaffAccount } from '@/services/staff';

const mocks = vi.hoisted(() => ({
  createUserWithEmailAndPassword: vi.fn(),
  deleteApp: vi.fn(),
  deleteUser: vi.fn(),
  getAuth: vi.fn(),
  initializeApp: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  setPersistence: vi.fn(),
  staffRef: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  deleteApp: mocks.deleteApp,
  initializeApp: mocks.initializeApp,
}));
vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: mocks.createUserWithEmailAndPassword,
  deleteUser: mocks.deleteUser,
  getAuth: mocks.getAuth,
  inMemoryPersistence: 'memory',
  setPersistence: mocks.setPersistence,
}));
vi.mock('firebase/firestore', () => ({
  serverTimestamp: mocks.serverTimestamp,
  setDoc: mocks.setDoc,
}));
vi.mock('@/lib/firebase', () => ({ firebaseConfig: { projectId: 'test-project' } }));
vi.mock('@/services/firestore', () => ({ staffRef: mocks.staffRef }));

const profile = {
  email: 'teacher@example.com',
  displayName: 'Test Teacher',
  role: 'teacher' as const,
  grade: 1,
  sectionId: 'grade-1-section',
  section: 'Sampaguita',
  subjectId: 'math',
};

describe('createStaffAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.initializeApp.mockReturnValue({ name: 'staff-provision-test' });
    mocks.getAuth.mockReturnValue({ name: 'secondary-auth' });
    mocks.createUserWithEmailAndPassword.mockResolvedValue({ user: { uid: 'new-user-id' } });
    mocks.serverTimestamp.mockReturnValue('server-time');
    mocks.staffRef.mockReturnValue('staff-document');
    mocks.setPersistence.mockResolvedValue(undefined);
    mocks.setDoc.mockResolvedValue(undefined);
    mocks.deleteUser.mockResolvedValue(undefined);
    mocks.deleteApp.mockResolvedValue(undefined);
  });

  it('creates the Auth account and Firestore profile without persisting the secondary session', async () => {
    await expect(createStaffAccount(profile, 'temporary-password')).resolves.toBe('new-user-id');

    expect(mocks.setPersistence).toHaveBeenCalledWith({ name: 'secondary-auth' }, 'memory');
    expect(mocks.createUserWithEmailAndPassword).toHaveBeenCalledWith(
      { name: 'secondary-auth' },
      profile.email,
      'temporary-password',
    );
    expect(mocks.setDoc).toHaveBeenCalledWith('staff-document', {
      ...profile,
      createdAt: 'server-time',
      updatedAt: 'server-time',
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.deleteApp).toHaveBeenCalledOnce();
  });

  it('rolls back the new Auth user if its Firestore profile cannot be written', async () => {
    const writeError = new Error('Firestore write failed');
    mocks.setDoc.mockRejectedValueOnce(writeError);

    await expect(createStaffAccount(profile, 'temporary-password')).rejects.toBe(writeError);

    expect(mocks.deleteUser).toHaveBeenCalledWith({ uid: 'new-user-id' });
    expect(mocks.deleteApp).toHaveBeenCalledOnce();
  });
});
