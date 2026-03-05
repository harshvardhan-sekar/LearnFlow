import { useEffect, useState, useRef } from "react";
import client from "../../api/client";
import { useSession } from "../../contexts/SessionContext";
import type { LearningTopic } from "../../types";

export default function SessionStart() {
  const { startSession, loading } = useSession();
  const [topics, setTopics] = useState<LearningTopic[]>([]);
  const [query, setQuery] = useState("");
  const [description, setDescription] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [fetchingTopics, setFetchingTopics] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadTopics() {
      try {
        const { data } = await client.get<LearningTopic[]>("/topics");
        setTopics(data);
      } catch {
        // Non-blocking: user can still type a custom topic
      } finally {
        setFetchingTopics(false);
      }
    }
    loadTopics();
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredTopics = topics.filter((t) =>
    t.title.toLowerCase().includes(query.toLowerCase())
  );

  const exactMatch = topics.find(
    (t) => t.title.toLowerCase() === query.trim().toLowerCase()
  );

  async function handleStart() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setError(null);
    setCreating(true);

    try {
      let topicId: string;

      if (exactMatch) {
        // Use existing topic
        topicId = exactMatch.id;
      } else {
        // Create new topic on the fly
        const { data: newTopic } = await client.post<LearningTopic>("/topics", {
          title: trimmed,
          description: description.trim() || null,
        });
        topicId = newTopic.id ?? String(newTopic.id);
      }

      await startSession(String(topicId));
    } catch {
      setError("Failed to start session. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  function selectTopic(topic: LearningTopic) {
    setQuery(topic.title);
    setDescription(topic.description ?? "");
    setShowSuggestions(false);
  }

  const isReady = query.trim().length > 0;
  const isWorking = loading || creating;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-md border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-2">
          Start a Learning Session
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          Enter any topic you'd like to learn about. You'll set subgoals, search
          the web, and chat with an AI tutor.
        </p>

        {/* Topic input with autocomplete */}
        <div ref={wrapperRef} className="relative mb-2">
          <label
            htmlFor="topic-input"
            className="block text-sm font-medium text-slate-300 mb-2"
          >
            What do you want to learn?
          </label>
          <input
            id="topic-input"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isReady && !isWorking) {
                e.preventDefault();
                handleStart();
              }
            }}
            placeholder={
              fetchingTopics
                ? "Loading..."
                : 'e.g. "Machine Learning Basics", "World War II"'
            }
            autoComplete="off"
            className="w-full px-3 py-2.5 rounded-lg bg-slate-700/50 border border-slate-600/50 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
          />

          {/* Suggestions dropdown */}
          {showSuggestions && query.trim().length > 0 && filteredTopics.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-slate-700 border border-slate-600/50 rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {filteredTopics.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => selectTopic(topic)}
                  className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-600/70 transition-colors first:rounded-t-lg last:rounded-b-lg"
                >
                  <span className="font-medium">{topic.title}</span>
                  {topic.description && (
                    <span className="block text-xs text-slate-400 mt-0.5 truncate">
                      {topic.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Show "new topic" hint when user is typing something new */}
        {query.trim().length > 0 && !exactMatch && !fetchingTopics && (
          <p className="text-xs text-blue-400/80 mb-4">
            A new topic "{query.trim()}" will be created for you.
          </p>
        )}

        {/* Optional description for new topics */}
        {query.trim().length > 0 && !exactMatch && (
          <div className="mb-4">
            <label
              htmlFor="topic-desc"
              className="block text-xs font-medium text-slate-400 mb-1"
            >
              Description (optional)
            </label>
            <input
              id="topic-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what you want to learn"
              className="w-full px-3 py-2 rounded-lg bg-slate-700/30 border border-slate-600/30 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40"
            />
          </div>
        )}

        {exactMatch?.description && (
          <p className="text-xs text-slate-500 mb-4">{exactMatch.description}</p>
        )}

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <button
          onClick={handleStart}
          disabled={!isReady || isWorking}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
        >
          {isWorking ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {creating ? "Creating topic..." : "Starting..."}
            </span>
          ) : (
            "Start Session"
          )}
        </button>
      </div>
    </div>
  );
}
