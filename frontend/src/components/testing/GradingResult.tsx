import { useState } from "react";
import type { QuestionResult, QuestionRubric, RubricCriterion, TestRecord } from "../../api/tests";

interface GradingResultProps {
  test: TestRecord;
  onRetake: () => void;
  onDone: () => void;
}

export default function GradingResult({ test, onRetake, onDone }: GradingResultProps) {
  const total = test.total_score ?? 0;
  const maxTotal = test.max_score ?? test.questions.length;
  const pct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Score summary */}
      <div className="flex flex-col items-center gap-2 py-6 border-b border-slate-700">
        <ScoreRing pct={pct} />
        <p className="text-2xl font-bold text-white mt-2">
          {total.toFixed(1)} / {maxTotal.toFixed(1)}
        </p>
        <p className="text-sm text-slate-400">
          {test.grading_mode === "formal" ? "Formal" : "Informal"} grading ·{" "}
          {test.questions.length} questions
        </p>
      </div>

      {/* Per-question rubric cards */}
      <div className="flex flex-col gap-4">
        {test.questions.map((q, idx) => (
          <QuestionCard key={q.id} question={q} index={idx} />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onRetake}
          className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300
                     hover:border-slate-500 hover:text-white transition-colors text-sm font-medium"
        >
          Retake
        </button>
        <button
          onClick={onDone}
          className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500
                     text-white font-semibold transition-colors text-sm"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ── Score ring ────────────────────────────────────────────────────────────

function ScoreRing({ pct }: { pct: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 70 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={radius} fill="none" stroke="#334155" strokeWidth="8" />
      <circle
        cx="48"
        cy="48"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 48 48)"
      />
      <text x="48" y="53" textAnchor="middle" fontSize="18" fontWeight="bold" fill="white">
        {pct}%
      </text>
    </svg>
  );
}

// ── Per-question card ─────────────────────────────────────────────────────

function QuestionCard({ question, index }: { question: QuestionResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const score = question.score ?? 0;
  const maxScore = question.max_score ?? 1;
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const rubric = question.rubric as QuestionRubric | null;
  const lowConfidence = rubric?.low_confidence ?? false;

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      {/* Card header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
      >
        {/* Score badge */}
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
            pct >= 70
              ? "bg-emerald-900/50 text-emerald-400 border border-emerald-700"
              : pct >= 40
                ? "bg-amber-900/50 text-amber-400 border border-amber-700"
                : "bg-red-900/50 text-red-400 border border-red-700"
          }`}
        >
          {score.toFixed(1)}/{maxScore.toFixed(1)}
        </span>

        <span className="flex-1 text-sm text-slate-300 line-clamp-2">
          Q{index + 1}: {question.question_text}
        </span>

        {lowConfidence && (
          <span className="text-xs text-amber-400 border border-amber-700 px-2 py-0.5 rounded-full flex-shrink-0">
            Low confidence
          </span>
        )}

        <svg
          className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-4 border-t border-slate-700">
          {/* User answer */}
          <div className="mt-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Your Answer
            </p>
            <p className="text-sm text-slate-300 bg-slate-800 rounded px-3 py-2 whitespace-pre-wrap">
              {question.user_answer || <span className="italic text-slate-500">No answer provided</span>}
            </p>
          </div>

          {/* MCQ: correct answer */}
          {question.question_type === "objective" && question.correct_answer && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                Correct Answer
              </p>
              <p className="text-sm text-emerald-300 bg-emerald-900/20 border border-emerald-800 rounded px-3 py-2">
                {question.correct_answer}
              </p>
            </div>
          )}

          {/* Rubric */}
          {rubric?.criteria && rubric.criteria.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                Rubric
              </p>
              <div className="flex flex-col gap-2">
                {rubric.criteria.map((c: RubricCriterion, i: number) => (
                  <RubricRow key={i} criterion={c} />
                ))}
              </div>
            </div>
          )}

          {/* Feedback */}
          {question.feedback && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                Feedback
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">{question.feedback}</p>
            </div>
          )}

          {/* Citations */}
          {rubric?.citations && rubric.citations.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                Sources
              </p>
              <ul className="flex flex-col gap-1">
                {rubric.citations.map((cite: string, i: number) => (
                  <li key={i} className="text-xs text-indigo-400 break-all">
                    {cite}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lowConfidence && (
            <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-800 rounded px-3 py-2">
              The AI was less certain about this grade. Consider reviewing it manually.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Rubric row ─────────────────────────────────────────────────────────────

function RubricRow({ criterion }: { criterion: RubricCriterion }) {
  const pct = criterion.max > 0 ? criterion.points / criterion.max : 0;
  return (
    <div className="bg-slate-800 rounded px-3 py-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-slate-400">{criterion.criterion}</span>
        <span className="text-xs font-semibold text-slate-300">
          {criterion.points}/{criterion.max}
        </span>
      </div>
      <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${
            pct >= 0.7 ? "bg-emerald-500" : pct >= 0.4 ? "bg-amber-500" : "bg-red-500"
          }`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      {criterion.comment && (
        <p className="text-xs text-slate-500 mt-1">{criterion.comment}</p>
      )}
    </div>
  );
}
