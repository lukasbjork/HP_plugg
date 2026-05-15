// Progressbar med valfri etikett
interface Props {
  value: number;       // 0–100
  color?: string;
  label?: string;
  showPercent?: boolean;
  height?: 'thin' | 'normal' | 'thick';
}

export function ProgressBar({ value, color = 'bg-ki-blue', label, showPercent = true, height = 'normal' }: Props) {
  const heightClass = { thin: 'h-1.5', normal: 'h-2.5', thick: 'h-4' }[height];
  const pct = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="flex justify-between mb-1 text-sm">
          {label && <span className="text-ki-gray-dark">{label}</span>}
          {showPercent && <span className="font-medium text-ki-text">{pct}%</span>}
        </div>
      )}
      <div className={`w-full bg-ki-gray-mid rounded-full ${heightClass}`}>
        <div
          className={`${color} ${heightClass} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
