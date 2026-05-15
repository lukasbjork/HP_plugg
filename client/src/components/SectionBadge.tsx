// Färgad badge för HP-sektion (ORD, LÄS, MEK, etc.)
import type { Section } from '../lib/types';
import { SECTION_COLORS, SECTION_LABELS } from '../lib/sectionColors';

interface Props {
  section: Section | string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function SectionBadge({ section, showLabel = false, size = 'md' }: Props) {
  const colorClass = SECTION_COLORS[section as Section] ?? 'bg-gray-100 text-gray-800';
  const label = showLabel ? (SECTION_LABELS[section as Section] ?? section) : section;
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`section-badge font-mono font-bold ${colorClass} ${sizeClass}`}>
      {label}
    </span>
  );
}
