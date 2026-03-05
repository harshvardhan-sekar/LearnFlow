import { useState } from "react";
import type { TestRecord } from "../../api/tests";
import { generateTest } from "../../api/tests";

interface TestGeneratorProps {
  topicId: number;
  sessionId?: number;
  onTestGenerated: (test: TestRecord) => void;
}

export default function TestGenerator({
  topicId,
  sessionId,
  onTestGenerated,
}: TestGeneratorProps) {
  const [numQuestions, setNumQuestions] = useState(5);
  const [gradingMode, setGradingMode] = useState<"informal" | "formal">("informal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    setLoading(true);
    try {
      const test = await generateTest(topicId, numQuestions, gradingMode, sessionId);
      onTestGenerated(test);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to generate test. Make sure a concept graph exists for this topic.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Take a Test</h2>
        <p className="text-sm text-slate-400">
          Configure your test and let the AI generate adaptive questions based on your
          current mastery.
        </p>
      </div>

      {/* Number of questions */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">
          Number of Questions
          <span className="ml-2 text-indigo-400 font-semibold">{numQuestions}</span>
        </label>
        <input
          type="range"
          min={1}
          max={20}
          value={numQuestions}
          onChange={(e) => setNumQuestions(Number(e.target.value))}
          className="w-full accent-indigo-500"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>1</span>
          <span>10</span>
          <span>20</span>
        </div>
      </div>

      {/* Grading mode toggle */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">Grading Mode</label>
        <div className="flex rounded-lg border border-slate-700 overflow-hidden">
          <button
            onClick={() => setGradingMode("informal")}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              gradingMode === "informal"
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            Informal
          </button>
          <button
            onClick={() => setGradingMode("formal")}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              gradingMode === "formal"
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            Formal
          </button>
        </div>
        <p className="text-xs text-slate-500">
          {gradingMode === "informal"
            ? "Focuses on understanding — lenient with phrasing and terminology."
            : "Strict academic evaluation — precise terminology and completeness required."}
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                   disabled:cursor-not-allowed text-white font-semibold transition-colors"
      >
        {loading ? "Generating questions…" : "Generate Test"}
      </button>
    </div>
  );
}
