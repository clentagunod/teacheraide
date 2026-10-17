import { describe, expect, it } from 'vitest';
import { AuditDeliveryError, sendAuditEvent } from '@/services/adminScript';

describe('audit delivery', () => {
  it('rejects audit events when there is no signed-in user', async () => {
    await expect(sendAuditEvent('create', 'staff', 'new-user'))
      .rejects.toBeInstanceOf(AuditDeliveryError);
  });
});