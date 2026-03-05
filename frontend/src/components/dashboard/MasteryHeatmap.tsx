import { useState, useRef } from "react";
import type { ConceptMasteryItem } from "../../types";
import { useMastery } from "../../contexts/MasteryContext";

interface Props {
  concepts: ConceptMasteryItem[];
}

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

function cellBg(score: number): string {
  if (score >= 0.7) return "bg-green-500/80 border-green-400/40";
  if (score >= 0.3) return "bg-yellow-400/80 border-yellow-300/40";
  return "bg-red-500/70 border-red-400/40";
}

function cellLabel(score: number): string {
  if (score >= 0.7) return "Proficient";
  if (score >= 0.3) return "Developing";
  return "Beginner";
}

interface OverlayState {
  conceptNodeId: number;
  conceptName: string;
  sliderValue: number;
}

export default function MasteryHeatmap({ concepts }: Props) {
  const { overrideMastery } = useMastery();

  const [tooltip, setTooltip] = useState<ConceptMasteryItem | null>(null);
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const [saving, setSaving] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const grouped: Record<Difficulty, ConceptMasteryItem[]> = {
    easy: [],
    medium: [],
    hard: [],
  };
  for (const c of concepts) {
    const d = c.difficulty as Difficulty;
    if (grouped[d]) grouped[d].push(c);
    else grouped.medium.push(c);
  }

  function handlePointerDown(concept: ConceptMasteryItem) {
    holdTimer.current = setTimeout(() => {
      setOverlay({
        conceptNodeId: concept.concept_node_id,
        conceptName: concept.concept_name,
        sliderValue: concept.mastery_score,
      });
    }, 600);
  }

  function handlePointerUp() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  async function handleOverrideSave() {
    if (!overlay) return;
    setSaving(true);
    try {
      await overrideMastery(overlay.conceptNodeId, overlay.sliderValue);
      setOverlay(null);
    } finally {
      setSaving(false);
    }
  }

  const difficultyLabels: Record<Difficulty, string> = {
    easy: "Foundational",
    medium: "Intermediate",
    hard: "Advanced",
  };

  return (
    <div className="relative">
      <div className="space-y-5">
        {DIFFICULTIES.map((diff) => {
          const row = grouped[diff];
          if (row.length === 0) return null;
          return (
            <div key={diff}>
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                {difficultyLabels[diff]}
              </div>
              <div className="flex flex-wrap gap-2">
                {row.map((concept) => (
                  <div
                    key={concept.concept_node_id}
                    className={`relative px-3 py-2 rounded-lg border text-xs font-medium text-white cursor-pointer select-none transition-transform active:scale-95 ${cellBg(concept.mastery_score)}`}
                    style={{ minWidth: "80px", maxWidth: "160px" }}
                    onMouseEnter={() => setTooltip(concept)}
                    onMouseLeave={() => setTooltip(null)}
                    onPointerDown={() => handlePointerDown(concept)}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                  >
                    <div className="truncate">{concept.concept_name}</div>
                    <div className="text-white/70 mt-0.5">
                      {Math.round(concept.mastery_score * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {concepts.length === 0 && (
          <div className="text-slate-500 text-sm py-8 text-center">
            No concept graph yet for this topic.
            <br />
            Generate one from the admin panel to see mastery here.
          </div>
        )}
      </div>

      {/* Legend */}
      {concepts.length > 0 && (
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-700/50">
          <span className="text-xs text-slate-500">Legend:</span>
          {[
            { label: "Beginner", color: "bg-red-500/80" },
            { label: "Developing", color: "bg-yellow-400/80" },
            { label: "Proficient", color: "bg-green-500/80" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${color}`} />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
          ))}
          <span className="text-xs text-slate-500 ml-auto italic">
            Hold a cell to override
          </span>
        </div>
      )}

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl text-xs text-white max-w-xs"
          style={{ bottom: "1.5rem", right: "1.5rem" }}
        >
          <div className="font-semibold mb-1">{tooltip.concept_name}</div>
          <div className="text-slate-300 space-y-0.5">
            <div>
              Level:{" "}
              <span className="text-white">{cellLabel(tooltip.mastery_score)}</span>
            </div>
            <div>
              Score:{" "}
              <span className="text-white">
                {Math.round(tooltip.mastery_score * 100)}%
              </span>
            </div>
            <div>
              Attempts:{" "}
              <span className="text-white">{tooltip.attempts_count}</span>
            </div>
          </div>
        </div>
      )}

      {/* Override slider modal */}
      {overlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 shadow-2xl w-80">
            <div className="text-white font-semibold mb-1">
              {overlay.conceptName}
            </div>
            <div className="text-slate-400 text-xs mb-5">
              Manual mastery override
            </div>

            <div className="flex items-center justify-between text-sm text-slate-300 mb-2">
              <span>0%</span>
              <span className="text-white font-bold text-xl">
                {Math.round(overlay.sliderValue * 100)}%
              </span>
              <span>100%</span>
            </div>

            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={overlay.sliderValue}
              onChange={(e) =>
                setOverlay({
                  ...overlay,
                  sliderValue: parseFloat(e.target.value),
                })
              }
              className="w-full accent-blue-500 mb-4"
            />

            <div
              className={`text-center text-sm font-medium py-1.5 rounded-lg mb-5 border ${cellBg(overlay.sliderValue)} text-white`}
            >
              {cellLabel(overlay.sliderValue)}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setOverlay(null)}
                className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleOverrideSave}
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white text-sm font-medium transition-colors"
              >
                {saving ? "Saving…" : "Save Override"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
