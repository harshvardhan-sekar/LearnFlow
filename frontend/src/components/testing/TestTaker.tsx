import { useState } from "react";
import type { AnswerItem, TestRecord } from "../../api/tests";
import { gradeTest } from "../../api/tests";
import ThoughtBubble from "./ThoughtBubble";

interface TestTakerProps {
  test: TestRecord;
  onGraded: (gradedTest: TestRecord) => void;
  onCancel: () => void;
}

export default function TestTaker({ test, onGraded, onCancel }: TestTakerProps) {
  const questions = test.questions;
  const [currentIndex, setCurrentIndex] = useState(0);
  // answers keyed by question id
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // track which question (by id) has its ThoughtBubble open
  const [hintOpenFor, setHintOpenFor] = useState<number | null>(null);

  const question = questions[currentIndex];
  const total = questions.length;
  const isLast = currentIndex === total - 1;
  const allAnswered = questions.every((q) => (answers[q.id] ?? "").trim() !== "");

  function setAnswer(questionId: number, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const payload: AnswerItem[] = questions.map((q) => ({
        question_id: q.id,
        answer: answers[q.id] ?? "",
      }));
      const graded = await gradeTest(test.id, payload);
      onGraded(graded);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit test. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Question {currentIndex + 1} of {total}
          </h2>
          <p className="text-xs text-slate-500 capitalize">
            {test.grading_mode} grading · {question.question_type}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-slate-700 rounded-full mb-6">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
        />
      </div>

      {/* Question card */}
      <div className="flex-1 flex flex-col gap-5">
        {/* Question text + hint toggle */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <p className="text-slate-100 text-base leading-relaxed flex-1">
              {question.question_text}
            </p>
            <button
              onClick={() =>
                setHintOpenFor(hintOpenFor === question.id ? null : question.id)
              }
              title="Get a hint"
              className={`flex-shrink-0 mt-0.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                hintOpenFor === question.id
                  ? "border-indigo-500 bg-indigo-900/30 text-indigo-300"
                  : "border-slate-600 text-slate-500 hover:border-slate-500 hover:text-slate-300"
              }`}
            >
              💭 Hint
            </button>
          </div>
          {hintOpenFor === question.id && (
            <ThoughtBubble
              questionId={question.id}
              conceptKey={question.concept_node_id?.toString() ?? ""}
              onClose={() => setHintOpenFor(null)}
            />
          )}
        </div>

        {question.question_type === "objective" && question.options ? (
          <MCQOptions
            options={question.options}
            selected={answers[question.id] ?? null}
            onSelect={(val) => setAnswer(question.id, val)}
          />
        ) : (
          <textarea
            rows={6}
            placeholder="Write your answer here…"
            value={answers[question.id] ?? ""}
            onChange={(e) => setAnswer(question.id, e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3
                       text-slate-100 placeholder-slate-500 text-sm resize-none
                       focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        )}
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 mt-4">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => { setHintOpenFor(null); setCurrentIndex((i) => Math.max(0, i - 1)); }}
          disabled={currentIndex === 0}
          className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400
                     hover:text-slate-200 hover:border-slate-600 disabled:opacity-30
                     disabled:cursor-not-allowed transition-colors text-sm"
        >
          Previous
        </button>

        {isLast ? (
          <button
            onClick={handleSubmit}
            disabled={submitting || !allAnswered}
            className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500
                       disabled:opacity-50 disabled:cursor-not-allowed text-white
                       font-semibold transition-colors text-sm"
          >
            {submitting ? "Grading…" : "Submit & Grade"}
          </button>
        ) : (
          <button
            onClick={() => { setHintOpenFor(null); setCurrentIndex((i) => Math.min(total - 1, i + 1)); }}
            className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600
                       text-slate-200 font-medium transition-colors text-sm"
          >
            Next
          </button>
        )}
      </div>

      {/* Answer progress dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {questions.map((q, idx) => (
          <button
            key={q.id}
            onClick={() => { setHintOpenFor(null); setCurrentIndex(idx); }}
            title={`Question ${idx + 1}`}
            className={`w-2 h-2 rounded-full transition-colors ${
              idx === currentIndex
                ? "bg-indigo-400"
                : (answers[q.id] ?? "").trim()
                  ? "bg-emerald-500"
                  : "bg-slate-600"
            }`}
          />
        ))}
      </div>
      {!allAnswered && (
        <p className="text-center text-xs text-slate-500 mt-2">
          Answer all questions before submitting.
        </p>
      )}
    </div>
  );
}

// ── MCQ sub-component ─────────────────────────────────────────────────────

interface MCQOptionsProps {
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;
}

function MCQOptions({ options, selected, onSelect }: MCQOptionsProps) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt, idx) => {
        const isSelected = selected === opt;
        return (
          <button
            key={idx}
            onClick={() => onSelect(opt)}
            className={`flex items-start gap-3 w-full text-left px-4 py-3 rounded-lg border
                        transition-colors text-sm ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-900/30 text-indigo-200"
                            : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
                        }`}
          >
            <span
              className={`mt-0.5 w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${
                isSelected ? "border-indigo-400 bg-indigo-500" : "border-slate-500"
              }`}
            >
              {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
            </span>
            <span>{opt}</span>
          </button>
        );
      })}
    </div>
  );
}
