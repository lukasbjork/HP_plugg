// Nedräkningstimer-komponent
interface Props {
  secondsLeft: number;
  totalSeconds: number;
  label?: string;
}

export function Timer({ secondsLeft, totalSeconds, label }: Props) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const pct = totalSeconds > 0 ? (secondsLeft / totalSeconds) * 100 : 0;

  // Färgkodar timern baserat på tid kvar
  const color = pct > 33 ? 'text-ki-blue' : pct > 10 ? 'text-amber-600' : 'text-red-600';
  const barColor = pct > 33 ? 'bg-ki-blue' : pct > 10 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex flex-col items-center gap-1">
      {label && <span className="text-xs text-ki-gray-dark">{label}</span>}
      <span className={`font-mono text-2xl font-bold ${color}`}>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
      <div className="w-24 h-1.5 bg-ki-gray-mid rounded-full">
        <div
          className={`h-1.5 rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
