import { describe, expect, it } from 'vitest';
import { canManageSchoolRecords } from '@/lib/roles';

describe('school record permissions', () => {
  it('grants school-wide record access to admins and supervisors, but not teachers', () => {
    expect(canManageSchoolRecords('admin')).toBe(true);
    expect(canManageSchoolRecords('supervisor')).toBe(true);
    expect(canManageSchoolRecords('teacher')).toBe(false);
    expect(canManageSchoolRecords(null)).toBe(false);
  });
});
