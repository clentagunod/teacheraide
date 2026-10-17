const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

const longFormat = new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short', year: 'numeric' });
const shortFormat = new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short' });
const weekdayFormat = new Intl.DateTimeFormat('en-PH', { weekday: 'short' });
const fullFormat = new Intl.DateTimeFormat('en-PH', { weekday: 'long', day: 'numeric', month: 'long' });
const timeFormat = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' });

export const DEFAULT_DUE_TIME = '23:59';

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function currentTimeISO(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function formatTime(value: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return value;
  return timeFormat.format(new Date(2000, 0, 1, Number(match[1]), Number(match[2])));
}

export function isValidISODate(value: string): boolean {
  if (!ISO_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function parseISODate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole days from `fromISO` to `toISO` (positive when `toISO` is later). */
export function diffInDays(fromISO: string, toISO: string): number {
  const a = parseISODate(fromISO);
  const b = parseISODate(toISO);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export const formatDate = (iso: string): string => longFormat.format(parseISODate(iso));
export const formatShortDate = (iso: string): string => shortFormat.format(parseISODate(iso));
export const formatWeekday = (iso: string): string => weekdayFormat.format(parseISODate(iso));
export const formatFullDate = (iso: string): string => fullFormat.format(parseISODate(iso));
