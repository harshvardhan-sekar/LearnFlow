import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import client from "../../api/client";
import type { LearningTopic } from "../../types";
import type { TestRecord } from "../../api/tests";
import { getTestHistory } from "../../api/tests";
import type { TestHistoryItem } from "../../api/tests";
import TestGenerator from "./TestGenerator";
import TestTaker from "./TestTaker";
import GradingResult from "./GradingResult";

type Stage = "config" | "taking" | "result";

export default function TestPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const topicParam = searchParams.get("topic");

  const [topics, setTopics] = useState<LearningTopic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(
    topicParam ? Number(topicParam) : null
  );
  const [fetchingTopics, setFetchingTopics] = useState(true);
  const [history, setHistory] = useState<TestHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [stage, setStage] = useState<Stage>("config");
  const [activeTest, setActiveTest] = useState<TestRecord | null>(null);
  const [gradedTest, setGradedTest] = useState<TestRecord | null>(null);

  // Load topics on mount; only auto-select first topic if no URL param provided
  useEffect(() => {
    client
      .get<LearningTopic[]>("/topics")
      .then(({ data }) => {
        setTopics(data);
        if (data.length > 0 && !topicParam) {
          setSelectedTopicId(Number(data[0].id));
        }
      })
      .finally(() => setFetchingTopics(false));
  }, [topicParam]);

  // Load history whenever topic changes
  useEffect(() => {
    if (selectedTopicId == null) return;
    setLoadingHistory(true);
    getTestHistory(selectedTopicId)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [selectedTopicId]);

  function handleTestGenerated(test: TestRecord) {
    setActiveTest(test);
    setStage("taking");
  }

  function handleGraded(test: TestRecord) {
    setGradedTest(test);
    setStage("result");
    // Refresh history
    if (selectedTopicId != null) {
      getTestHistory(selectedTopicId).then(setHistory).catch(() => {});
    }
  }

  function handleRetake() {
    setActiveTest(null);
    setGradedTest(null);
    setStage("config");
  }

  // After viewing results, navigate to dashboard so mastery updates are visible
  function handleDone() {
    if (selectedTopicId != null) {
      navigate(`/dashboard?topic=${selectedTopicId}`);
    } else {
      setActiveTest(null);
      setGradedTest(null);
      setStage("config");
    }
  }

  function handleCancel() {
    setActiveTest(null);
    setStage("config");
  }

  if (fetchingTopics) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <p className="text-slate-400 animate-pulse">Loading topics…</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-900 flex flex-col overflow-hidden">
      {/* Minimal page header */}
      <header className="flex items-center px-6 py-3 border-b border-slate-700/50 flex-shrink-0">
        <h1 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
          Tests
        </h1>
      </header>

      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* Sidebar: topic selector + history */}
        <aside className="w-64 flex-shrink-0 border-r border-slate-700/50 flex flex-col p-5 gap-5 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-2">
              Topic
            </label>
            <select
              value={selectedTopicId ?? ""}
              onChange={(e) => {
                const id = Number(e.target.value);
                setSelectedTopicId(id);
                setStage("config");
                setActiveTest(null);
                setGradedTest(null);
              }}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg
                         px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              Test History
            </p>
            {loadingHistory ? (
              <p className="text-xs text-slate-600 animate-pulse">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-slate-600">No tests yet for this topic.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {history.map((h) => (
                  <HistoryItem key={h.id} item={h} />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-8 overflow-y-auto">
          {topics.length === 0 ? (
            <div className="text-center text-slate-400 mt-16">
              <p>No topics found. Create a topic first in the learning view.</p>
            </div>
          ) : selectedTopicId == null ? null : (
            <div className="max-w-xl mx-auto">
              {stage === "config" && (
                <TestGenerator
                  topicId={selectedTopicId}
                  onTestGenerated={handleTestGenerated}
                />
              )}
              {stage === "taking" && activeTest && (
                <TestTaker
                  test={activeTest}
                  onGraded={handleGraded}
                  onCancel={handleCancel}
                />
              )}
              {stage === "result" && gradedTest && (
                <GradingResult
                  test={gradedTest}
                  onRetake={handleRetake}
                  onDone={handleDone}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── History item ──────────────────────────────────────────────────────────

function HistoryItem({ item }: { item: TestHistoryItem }) {
  const pct =
    item.max_score && item.max_score > 0
      ? Math.round(((item.total_score ?? 0) / item.max_score) * 100)
      : null;

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 capitalize">{item.grading_mode}</span>
        {pct != null ? (
          <span
            className={`text-xs font-semibold ${
              pct >= 70 ? "text-emerald-400" : pct >= 40 ? "text-amber-400" : "text-red-400"
            }`}
          >
            {pct}%
          </span>
        ) : (
          <span className="text-xs text-slate-600">Incomplete</span>
        )}
      </div>
      <p className="text-xs text-slate-600 mt-0.5">
        {new Date(item.created_at).toLocaleDateString()} · {item.questions_count ?? 0}q
      </p>
    </div>
  );
}
