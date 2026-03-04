import { useState } from "react";
import type { AssessmentQuestion } from "../../types";

interface AssessmentModalProps {
  title: string;
  questions: AssessmentQuestion[];
  onSubmit: (answers: Record<string, string>) => void;
  loading?: boolean;
}

export default function AssessmentModal({
  title,
  questions,
  onSubmit,
  loading = false,
}: AssessmentModalProps) {
  // answers maps question.id → selected option index (as string)
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function handleSubmit() {
    let correct = 0;
    for (const q of questions) {
      const userAnswer = answers[q.id];
      if (userAnswer != null && userAnswer === q.correct_answer) {
        correct++;
      }
    }
    setScore({ correct, total: questions.length });
    setShowResults(true);
  }

  function handleContinue() {
    onSubmit(answers);
  }

  const allAnswered = questions.every((q) => answers[q.id] != null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700/50 px-6 py-4 rounded-t-2xl">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Answer all questions to continue.
          </p>
        </div>

        <div className="px-6 py-4 space-y-6">
          {questions.map((q, idx) => (
            <div key={q.id} className="space-y-3">
              <p className="text-sm font-medium text-slate-200">
                <span className="text-blue-400 mr-2">{idx + 1}.</span>
                {q.question}
              </p>

              {q.type === "mcq" && q.options ? (
                <div className="space-y-2 pl-5">
                  {q.options.map((option, optIdx) => {
                    const optionIndex = String(optIdx);
                    const isSelected = answers[q.id] === optionIndex;
                    const isCorrect = showResults && optionIndex === q.correct_answer;
                    const isWrong = showResults && isSelected && !isCorrect;

                    let ringClass = "border-slate-600/50";
                    if (showResults && isCorrect) ringClass = "border-green-500/70 bg-green-500/10";
                    if (isWrong) ringClass = "border-red-500/70 bg-red-500/10";
                    if (!showResults && isSelected) ringClass = "border-blue-500/70 bg-blue-500/10";

                    return (
                      <label
                        key={optIdx}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${ringClass}`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={optionIndex}
                          checked={isSelected}
                          onChange={() => setAnswer(q.id, optionIndex)}
                          disabled={showResults}
                          className="accent-blue-500"
                        />
                        <span className="text-sm text-slate-300">{option}</span>
                        {showResults && isCorrect && (
                          <span className="ml-auto text-xs text-green-400">Correct</span>
                        )}
                        {isWrong && (
                          <span className="ml-auto text-xs text-red-400">Incorrect</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="pl-5">
                  <input
                    type="text"
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    disabled={showResults}
                    placeholder="Type your answer..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  {showResults && (
                    <p className="text-xs mt-1.5 text-slate-400">
                      Correct answer:{" "}
                      <span className="text-green-400">{q.correct_answer}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700/50 px-6 py-4 rounded-b-2xl">
          {showResults && score ? (
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-300">
                Score:{" "}
                <span className="font-bold text-white">
                  {score.correct}/{score.total}
                </span>{" "}
                <span className="text-slate-500">
                  ({Math.round((score.correct / score.total) * 100)}%)
                </span>
              </div>
              <button
                onClick={handleContinue}
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white text-sm font-medium transition-colors"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : "Continue"}
              </button>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={!allAnswered}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                Submit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
