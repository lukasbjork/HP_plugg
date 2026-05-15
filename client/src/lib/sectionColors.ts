// Färger och etiketter per HP-sektion
import type { Section } from './types';

export const SECTION_COLORS: Record<Section, string> = {
  ORD: 'bg-purple-100 text-purple-800',
  LÄS: 'bg-blue-100 text-blue-800',
  MEK: 'bg-cyan-100 text-cyan-800',
  XYZ: 'bg-green-100 text-green-800',
  KVA: 'bg-amber-100 text-amber-800',
  NOG: 'bg-red-100 text-red-800',
  DTK: 'bg-violet-100 text-violet-800',
};

export const SECTION_LABELS: Record<Section, string> = {
  ORD: 'Ordförståelse',
  LÄS: 'Läsförståelse',
  MEK: 'Meningskomplettering',
  XYZ: 'Algebra & geometri',
  KVA: 'Kvantitativ jämförelse',
  NOG: 'Tillräcklighet',
  DTK: 'Diagram & tabeller',
};

export const SECTION_TYPE: Record<Section, 'verb' | 'kvant'> = {
  ORD: 'verb',
  LÄS: 'verb',
  MEK: 'verb',
  XYZ: 'kvant',
  KVA: 'kvant',
  NOG: 'kvant',
  DTK: 'kvant',
};

export const ALL_SECTIONS: Section[] = ['ORD', 'LÄS', 'MEK', 'XYZ', 'KVA', 'NOG', 'DTK'];

// KI-antagningspoäng (historiskt ~2.0)
export const KI_TARGET_SCORE = 2.0;
