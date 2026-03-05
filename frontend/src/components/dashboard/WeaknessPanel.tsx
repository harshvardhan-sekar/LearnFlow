import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getRecommendations } from "../../api/mastery";
import type { Recommendation } from "../../api/mastery";

interface WeaknessPanelProps {
  topicId: number;
  onTakeQuiz: (conceptKey: string, conceptName: string) => void;
}

export default function WeaknessPanel({
  topicId,
  onTakeQuiz,
}: WeaknessPanelProps) {
  const navigate = useNavigate();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getRecommendations(topicId)
      .then((data) => setRecs(data.slice(0, 5)))
      .catch(() => setRecs([]))
      .finally(() => setLoading(false));
  }, [topicId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-500 text-sm">
        Loading…
      </div>
    );
  }

  if (recs.length === 0) {
    return (
      <div className="text-slate-500 text-sm py-4 text-center">
        No concepts to review yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recs.map((rec) => (
        <WeaknessRow
          key={rec.concept_key}
          rec={rec}
          onStudyNow={() => navigate("/learn")}
          onTakeQuiz={() => onTakeQuiz(rec.concept_key, rec.concept_name)}
        />
      ))}
    </div>
  );
}

function WeaknessRow({
  rec,
  onStudyNow,
  onTakeQuiz,
}: {
  rec: Recommendation;
  onStudyNow: () => void;
  onTakeQuiz: () => void;
}) {
  const masteryPct = Math.round(rec.mastery * 100);
  // Normalize focus_weight to 0-1 range (max possible is 1.01)
  const weightPct = Math.round(Math.min(rec.focus_weight / 1.01, 1) * 100);

  return (
    <div className="bg-slate-700/30 border border-slate-700/50 rounded-xl p-3">
      <div className="flex items-start gap-3">
        {/* Concept info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white font-medium truncate">
            {rec.concept_name}
          </div>

          {/* Mastery bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  rec.mastery >= 0.7
                    ? "bg-green-500"
                    : rec.mastery >= 0.3
                    ? "bg-yellow-400"
                    : "bg-red-500"
                }`}
                style={{ width: `${masteryPct}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 w-8 text-right flex-shrink-0">
              {masteryPct}%
            </span>
          </div>

          {/* Focus weight indicator */}
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Focus</span>
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-sm ${
                    i < Math.ceil(weightPct / 20)
                      ? "bg-orange-400"
                      : "bg-slate-700"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={onStudyNow}
            className="px-2.5 py-1 rounded-md bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-medium transition-colors whitespace-nowrap"
          >
            Study Now
          </button>
          <button
            onClick={onTakeQuiz}
            className="px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap"
          >
            Take Quiz
          </button>
        </div>
      </div>
    </div>
  );
}
