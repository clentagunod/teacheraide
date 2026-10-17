import type { UserRole } from '@/types';

export function canManageSchoolRecords(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'supervisor';
}
