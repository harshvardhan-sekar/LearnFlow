interface StepNavigatorProps {
  currentStep: number; // 0-indexed
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
}

export default function StepNavigator({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
}: StepNavigatorProps) {
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;
  const pct = totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 100;

  return (
    <div className="flex flex-col gap-2">
      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-slate-700/60">
        <div
          className="h-1 rounded-full bg-blue-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPrev}
          disabled={isFirst}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Prev
        </button>

        <span className="text-xs text-slate-400 font-mono">
          {currentStep + 1} / {totalSteps}
        </span>

        <button
          onClick={onNext}
          disabled={isLast}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
