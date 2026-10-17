import { FirebaseError } from 'firebase/app';
import { AuditDeliveryError } from '@/services/adminScript';

/** Turns any thrown value into a short, safe message for the UI (never leaks internals). */
export function getErrorMessage(err: unknown): string {
  if (err instanceof AuditDeliveryError) return err.message;
  const code = err instanceof FirebaseError
    ? err.code
    : err && typeof err === 'object' && 'code' in err && typeof err.code === 'string'
      ? err.code
      : '';
  if (code) {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'A Firebase account already exists for this email address.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
      case 'auth/invalid-email':
        return 'Incorrect email or password.';
      case 'auth/weak-password':
        return 'Choose a stronger temporary password.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Contact your administrator.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a few minutes and try again.';
      case 'auth/network-request-failed':
      case 'unavailable':
        return 'Network problem. Check your connection and try again.';
      case 'permission-denied':
        return 'Firestore denied this action. Verify the signed-in account has the correct Admin, Supervisor, or Teacher staff profile, that a teacher is assigned to the matching section and subject, and that the latest Firestore rules are published.';
      case 'unauthenticated':
        return 'Your session has expired. Please sign in again.';
      case 'resource-exhausted':
        return 'The service is busy right now. Please try again shortly.';
      case 'failed-precondition':
        return 'Firestore rejected this query because its composite index is not ready. Deploy the attendance index (collection: attendance; sectionId ascending, date ascending), then wait until it is READY in Firebase Console → Firestore → Indexes.';
      case 'invalid-argument':
        return 'The request contains invalid data. Refresh the page and try again.';
      default:
        return `The request failed (${code}). Check the browser console or contact your administrator.`;
    }
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return 'Something went wrong. Please try again.';
}
