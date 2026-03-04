import { useSession } from "../../contexts/SessionContext";

export default function SessionSummary() {
  const { currentTopic, lastAssessment, lastReflection, subgoals, resetSession } =
    useSession();

  const completedCount = subgoals.filter((s) => s.is_completed).length;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-lg bg-slate-800/80 backdrop-blur-md border border-slate-700/50 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Session Complete</h1>
          {currentTopic && (
            <p className="text-slate-400 mt-1">{currentTopic.title}</p>
          )}
        </div>

        {/* Subgoal Progress */}
        <div className="bg-slate-700/30 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-medium text-slate-300">Subgoal Progress</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{
                  width: subgoals.length
                    ? `${(completedCount / subgoals.length) * 100}%`
                    : "0%",
                }}
              />
            </div>
            <span className="text-sm text-slate-400 whitespace-nowrap">
              {completedCount}/{subgoals.length}
            </span>
          </div>
        </div>

        {/* Assessment Score */}
        {lastAssessment && lastAssessment.score !== null && (
          <div className="bg-slate-700/30 rounded-xl p-4 space-y-1">
            <h3 className="text-sm font-medium text-slate-300">
              Post-Assessment Score
            </h3>
            <p className="text-2xl font-bold text-white">
              {lastAssessment.score}/{lastAssessment.total}
              <span className="text-sm text-slate-500 ml-2">
                ({Math.round((lastAssessment.score / lastAssessment.total) * 100)}%)
              </span>
            </p>
          </div>
        )}

        {/* Reflection Summary */}
        {lastReflection && (
          <div className="bg-slate-700/30 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-medium text-slate-300">Your Reflection</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              {lastReflection.content}
            </p>
            <div className="flex gap-4 text-xs text-slate-500">
              <span>Confidence: {lastReflection.confidence}/5</span>
              <span>Difficulty: {lastReflection.difficulty}/5</span>
            </div>
          </div>
        )}

        <button
          onClick={resetSession}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors"
        >
          Start New Session
        </button>
      </div>
    </div>
  );
}
