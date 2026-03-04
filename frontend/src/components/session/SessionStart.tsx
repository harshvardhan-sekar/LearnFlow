import { useEffect, useState } from "react";
import client from "../../api/client";
import { useSession } from "../../contexts/SessionContext";
import type { LearningTopic } from "../../types";

export default function SessionStart() {
  const { startSession, loading } = useSession();
  const [topics, setTopics] = useState<LearningTopic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [fetchingTopics, setFetchingTopics] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTopics() {
      try {
        const { data } = await client.get<LearningTopic[]>("/topics");
        setTopics(data);
        if (data.length > 0) setSelectedTopicId(data[0].id);
      } catch {
        setError("Failed to load topics. Please try again.");
      } finally {
        setFetchingTopics(false);
      }
    }
    loadTopics();
  }, []);

  async function handleStart() {
    if (!selectedTopicId) return;
    setError(null);
    try {
      await startSession(selectedTopicId);
    } catch {
      setError("Failed to start session. Please try again.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-md border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-2">Start a Learning Session</h1>
        <p className="text-slate-400 text-sm mb-6">
          Choose a topic to begin studying. You'll set subgoals, search the web, and chat with an AI tutor.
        </p>

        {fetchingTopics ? (
          <div className="text-slate-400 text-sm py-4 text-center">Loading topics...</div>
        ) : topics.length === 0 ? (
          <div className="text-slate-400 text-sm py-4 text-center">
            No topics available. Ask your instructor to add learning topics.
          </div>
        ) : (
          <>
            <label
              htmlFor="topic-select"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              Learning Topic
            </label>
            <select
              id="topic-select"
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-700/50 border border-slate-600/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 mb-2"
            >
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
            {topics.find((t) => t.id === selectedTopicId)?.description && (
              <p className="text-xs text-slate-500 mb-6">
                {topics.find((t) => t.id === selectedTopicId)?.description}
              </p>
            )}
          </>
        )}

        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        <button
          onClick={handleStart}
          disabled={!selectedTopicId || loading || fetchingTopics}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
        >
          {loading ? "Starting..." : "Start Session"}
        </button>
      </div>
    </div>
  );
}
