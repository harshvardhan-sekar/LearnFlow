import { useState } from "react";

interface SubgoalGeneratorProps {
  hasExisting: boolean;
  onGenerate: () => Promise<void>;
}

export default function SubgoalGenerator({
  hasExisting,
  onGenerate,
}: SubgoalGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleClick() {
    if (hasExisting && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setLoading(true);
    try {
      await onGenerate();
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-amber-300">
          This will add AI subgoals alongside existing ones. Continue?
        </span>
        <button
          onClick={handleClick}
          className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors"
        >
          Yes
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-2 py-1 text-xs rounded bg-slate-600 text-slate-300 hover:bg-slate-500 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-purple-600/30 text-purple-300 border border-purple-500/30 hover:bg-purple-600/40 transition-colors disabled:opacity-50"
    >
      {loading ? (
        <>
          <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          Generating…
        </>
      ) : (
        <>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M7 1v4M5 3h4M11 5v3M9.5 6.5h3M4 9v3M2.5 10.5h3" />
          </svg>
          Generate Subgoals
        </>
      )}
    </button>
  );
}
