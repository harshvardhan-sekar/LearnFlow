import { useCallback, useState } from "react";
import { requestHint } from "../../api/hints";
import { useLogging } from "../../contexts/LoggingContext";
import { useSSE } from "../../hooks/useSSE";

interface ThoughtBubbleProps {
  questionId: number;
  conceptKey: string;
  onClose: () => void;
}

const LEVEL_LABELS: Record<number, string> = {
  0: "Need a hint?",
  1: "More help",
  2: "Show me",
};

const LEVEL_BADGE: Record<number, string> = {
  1: "Nudge",
  2: "Concept",
  3: "Solution",
};

export default function ThoughtBubble({
  questionId,
  conceptKey,
  onClose,
}: ThoughtBubbleProps) {
  const [hintLevel, setHintLevel] = useState(0);
  const { content, isStreaming, error, start, reset } = useSSE();
  const { logEvent } = useLogging();

  const fetchHint = useCallback(
    async (level: number) => {
      reset();
      setHintLevel(level);
      logEvent("hint_request", {
        question_id: questionId,
        hint_level: level,
        concept_key: conceptKey,
      });
      try {
        const response = await requestHint({
          question_id: questionId,
          concept_key: conceptKey,
          level,
        });
        await start(response);
      } catch {
        // error surfaced via useSSE error state
      }
    },
    [questionId, conceptKey, reset, start, logEvent]
  );

  const nextLevel = hintLevel + 1;
  const canEscalate = nextLevel <= 3 && !isStreaming;

  return (
    <div className="relative mt-3 select-none">
      {/* Comic-book thought cloud tail: three trailing circles */}
      <div className="flex items-end gap-1.5 ml-6 mb-1">
        <span className="w-3 h-3 rounded-full bg-slate-700/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-slate-700/70" />
        <span className="w-2 h-2 rounded-full bg-slate-700/50" />
      </div>

      {/* Thought bubble body */}
      <div
        className="relative rounded-3xl bg-slate-800/90 backdrop-blur-sm
                   border border-slate-600/50 px-5 py-4 shadow-xl"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close hint"
          className="absolute top-2.5 right-3.5 text-slate-500 hover:text-slate-300
                     text-xl leading-none transition-colors"
        >
          ×
        </button>

        {/* Content */}
        {hintLevel === 0 ? (
          <p className="text-slate-400 text-sm italic pr-8">
            Stuck? I can give a gentle nudge, explain the concept, or walk you
            through the full solution.
          </p>
        ) : (
          <div className="pr-8">
            <span
              className="inline-block text-xs font-semibold uppercase tracking-wider
                         text-indigo-400 mb-2"
            >
              {LEVEL_BADGE[hintLevel]}
            </span>
            <p className="text-slate-100 text-sm leading-relaxed whitespace-pre-wrap min-h-[1.25rem]">
              {content}
              {isStreaming && (
                <span
                  className="inline-block w-1.5 h-4 bg-indigo-400 animate-pulse
                             ml-0.5 align-text-bottom rounded-sm"
                />
              )}
            </p>
            {error && (
              <p className="text-red-400 text-xs mt-2">{error}</p>
            )}
          </div>
        )}

        {/* Escalation button */}
        {canEscalate && (
          <div className="mt-3">
            <button
              onClick={() => fetchHint(nextLevel)}
              className={`text-sm px-4 py-1.5 rounded-full font-medium transition-colors ${
                hintLevel === 0
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                  : hintLevel === 1
                    ? "bg-slate-700 hover:bg-slate-600 text-slate-200"
                    : "bg-amber-600/80 hover:bg-amber-500 text-white"
              }`}
            >
              {LEVEL_LABELS[hintLevel]}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
