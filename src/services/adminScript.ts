import { auth } from '@/lib/firebase';

const ENDPOINT = (import.meta.env.VITE_AUDIT_API_URL || import.meta.env.VITE_ADMIN_API_URL) as string | undefined;

export class AuditDeliveryError extends Error {
  constructor(cause: string) {
    super(`The data change was saved, but the audit log could not be confirmed (${cause}). Do not retry the data change; check the audit sheet.`);
    this.name = 'AuditDeliveryError';
  }
}

function requiredEndpoint(): string {
  if (!ENDPOINT) throw new Error('Set VITE_AUDIT_API_URL to the deployed Apps Script web app URL.');
  let url: URL;
  try {
    url = new URL(ENDPOINT);
  } catch {
    throw new Error('VITE_AUDIT_API_URL must be a valid Google Apps Script web app URL.');
  }
  if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || !url.pathname.startsWith('/macros/s/')) {
    throw new Error('VITE_AUDIT_API_URL must be a Google Apps Script web app URL.');
  }
  return url.toString();
}

export async function sendAuditEvent(action: string, entity: string, entityId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new AuditDeliveryError('the signed-in user could not be verified');
  let endpoint: string;
  try {
    endpoint = requiredEndpoint();
  } catch {
    throw new AuditDeliveryError('Apps Script is not configured');
  }
  let idToken: string;
  try {
    idToken = await user.getIdToken();
  } catch {
    throw new AuditDeliveryError('the sign-in token could not be refreshed');
  }
  const body = new URLSearchParams({ action: 'audit', idToken, eventAction: action, entity, entityId });
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    await fetch(endpoint, { method: 'POST', mode: 'no-cors', body, signal: controller.signal });
  } catch {
    throw new AuditDeliveryError(controller.signal.aborted ? 'the Apps Script request timed out' : 'the Apps Script request failed');
  } finally {
    window.clearTimeout(timeout);
  }
}
