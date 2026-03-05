import { useState } from "react";
import type { TestRecord } from "../../api/tests";
import { generateTest } from "../../api/tests";

interface TestGeneratorProps {
  topicId: number;
  sessionId?: number;
  onTestGenerated: (test: TestRecord) => void;
}

const QUESTION_COUNTS = [3, 5, 10] as const;

export default function TestGenerator({
  topicId,
  sessionId,
  onTestGenerated,
}: TestGeneratorProps) {
  const [numQuestions, setNumQuestions] = useState<number>(5);
  const [gradingMode, setGradingMode] = useState<"informal" | "formal">("informal");
  const [source, setSource] = useState<"ai" | "expert">("ai");
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
    <div className="flex items-center justify-center h-full">
      <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-8 max-w-lg w-full space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Generate a Test</h2>
          <p className="text-sm text-slate-400">
            Test your knowledge with adaptive questions based on your mastery
          </p>
        </div>

        <div className="space-y-4">
          {/* Number of Questions — pill buttons */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">
              Number of Questions
            </label>
            <div className="flex gap-2">
              {QUESTION_COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => setNumQuestions(n)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                    numQuestions === n
                      ? "bg-blue-600/30 text-blue-400 border border-blue-500/30"
                      : "bg-slate-700/50 text-slate-400 border border-slate-700 hover:border-slate-600"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Grading Mode — card-style buttons with subtitles */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Grading Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => setGradingMode("informal")}
                className={`flex-1 py-2.5 rounded-xl text-sm transition-all text-center ${
                  gradingMode === "informal"
                    ? "bg-emerald-600/30 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-700/50 text-slate-400 border border-slate-700 hover:border-slate-600"
                }`}
              >
                Informal
                <br />
                <span className="text-xs opacity-60">Concept-focused</span>
              </button>
              <button
                onClick={() => setGradingMode("formal")}
                className={`flex-1 py-2.5 rounded-xl text-sm transition-all text-center ${
                  gradingMode === "formal"
                    ? "bg-violet-600/30 text-violet-400 border border-violet-500/30"
                    : "bg-slate-700/50 text-slate-400 border border-slate-700 hover:border-slate-600"
                }`}
              >
                Formal
                <br />
                <span className="text-xs opacity-60">Academic precision</span>
              </button>
            </div>
          </div>

          {/* Source selector */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Source</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSource("ai")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                  source === "ai"
                    ? "bg-blue-600/30 text-blue-400 border border-blue-500/30"
                    : "bg-slate-700/50 text-slate-400 border border-slate-700 hover:border-slate-600"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.5 4.5H18l-3.5 2.5L16 14.5 12 11.5 8 14.5l1.5-4.5L6 7.5h4.5z" />
                </svg>
                AI Generated
              </button>
              <button
                onClick={() => setSource("expert")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                  source === "expert"
                    ? "bg-blue-600/30 text-blue-400 border border-blue-500/30"
                    : "bg-slate-700/50 text-slate-400 border border-slate-700 hover:border-slate-600"
                }`}
              >
                Expert Quiz
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                     disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
        >
          {loading ? "Generating questions…" : "Start Test"}
        </button>
      </div>
    </div>
  );
}
