import type { SubjectColor } from '@/types';

export const SUBJECT_COLORS: Record<SubjectColor, { label: string; solid: string; soft: string }> = {
  violet: { label: 'Violet', solid: '#5B4BFF', soft: '#EEEBFF' },
  blue: { label: 'Blue', solid: '#2F80ED', soft: '#E5F0FF' },
  pink: { label: 'Pink', solid: '#D63FA4', soft: '#FCE8F5' },
  teal: { label: 'Teal', solid: '#14A38B', soft: '#DDF6F1' },
  amber: { label: 'Amber', solid: '#D98E04', soft: '#FFF3D6' },
  rose: { label: 'Rose', solid: '#E5484D', soft: '#FDECEC' },
};

export function subjectColor(color: string): { solid: string; soft: string } {
  return SUBJECT_COLORS[color as SubjectColor] ?? SUBJECT_COLORS.violet;
}
