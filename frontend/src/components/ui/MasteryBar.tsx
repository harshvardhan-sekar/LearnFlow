interface MasteryBarProps {
  mastery: number; // 0.0 – 1.0
  showLabel?: boolean;
  className?: string;
}

function masteryColor(mastery: number): string {
  if (mastery <= 0.33) return "bg-red-500";
  if (mastery <= 0.66) return "bg-yellow-400";
  return "bg-green-500";
}

function masteryLabel(mastery: number): string {
  if (mastery <= 0.33) return "Beginner";
  if (mastery <= 0.66) return "Developing";
  return "Proficient";
}

export default function MasteryBar({
  mastery,
  showLabel = false,
  className = "",
}: MasteryBarProps) {
  const pct = Math.min(100, Math.max(0, Math.round(mastery * 100)));
  const color = masteryColor(mastery);

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-1">
        {showLabel && (
          <span className="text-xs text-slate-400">{masteryLabel(mastery)}</span>
        )}
        <span className="text-xs text-slate-400 ml-auto">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-700">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
