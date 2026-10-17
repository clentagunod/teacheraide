import { describe, expect, it } from 'vitest';
import { FirebaseError } from 'firebase/app';
import { AuditDeliveryError } from '@/services/adminScript';
import { getErrorMessage } from '@/lib/errors';

describe('getErrorMessage', () => {
  it('explains access denials without incorrectly blaming the sign-in session', () => {
    expect(getErrorMessage(new FirebaseError('permission-denied', 'Firestore rejected the request.')))
      .toContain('correct Admin, Supervisor, or Teacher staff profile');
  });

  it('explains duplicate Firebase accounts during staff creation', () => {
    expect(getErrorMessage(new FirebaseError('auth/email-already-in-use', 'Email already exists.')))
      .toBe('A Firebase account already exists for this email address.');
  });

  it('identifies Firestore index errors', () => {
    expect(getErrorMessage({ code: 'failed-precondition' })).toContain('sectionId ascending, date ascending');
  });

  it('surfaces safe service errors that do not provide a Firebase code', () => {
    expect(getErrorMessage(new Error('The attendance record is not available.')))
      .toBe('The attendance record is not available.');
  });

  it('preserves the audit delivery warning', () => {
    expect(getErrorMessage(new AuditDeliveryError('Apps Script is not configured')))
      .toContain('The data change was saved');
  });
});
