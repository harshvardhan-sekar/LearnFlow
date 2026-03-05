import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import client from "../../api/client";
import type { LearningTopic } from "../../types";
import { MasteryProvider, useMastery } from "../../contexts/MasteryContext";
import MasteryHeatmap from "./MasteryHeatmap";
import GoalEditor from "./GoalEditor";

// ── Inner page (needs MasteryContext) ────────────────────────────────────

function DashboardInner({ topicId }: { topicId: number }) {
  const navigate = useNavigate();
  const { snapshot, goals, topicTitle, loading, loadDashboard } = useMastery();

  useEffect(() => {
    loadDashboard(topicId);
  }, [topicId, loadDashboard]);

  const masteredPct = snapshot ? Math.round(snapshot.overall_pct) : 0;
  const masteredCount = snapshot?.mastered_count ?? 0;
  const totalCount = snapshot?.total_concepts ?? 0;
  const concepts = snapshot?.concepts ?? [];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate("/learn")}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Learning
          </button>

          <div className="h-4 w-px bg-slate-700" />

          <div className="flex-1 min-w-0">
            <h1 className="text-white font-semibold truncate">
              {topicTitle || "Dashboard"}
            </h1>
            {snapshot && (
              <p className="text-slate-400 text-sm">
                {masteredCount} / {totalCount} concepts mastered &mdash;{" "}
                {masteredPct}% overall
              </p>
            )}
          </div>

          {loading && (
            <span className="w-4 h-4 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin flex-shrink-0" />
          )}
        </div>
      </header>

      {/* 2×2 grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel 1 — Mastery Heatmap */}
          <Panel title="Mastery Heatmap" subtitle="Concepts by difficulty level">
            <MasteryHeatmap concepts={concepts} />
          </Panel>

          {/* Panel 2 — Goal Editor */}
          <Panel
            title="Learning Goals"
            subtitle={`${goals.filter((g) => !g.is_completed).length} active goal${goals.filter((g) => !g.is_completed).length !== 1 ? "s" : ""}`}
          >
            <GoalEditor concepts={concepts} />
          </Panel>

          {/* Panel 3 — Progress Overview */}
          <Panel title="Progress Overview" subtitle="Mastery distribution">
            <ProgressOverview snapshot={snapshot} />
          </Panel>

          {/* Panel 4 — Study Focus */}
          <Panel title="Study Focus" subtitle="Weakest concepts to review">
            <StudyFocus concepts={concepts} />
          </Panel>
        </div>
      </main>
    </div>
  );
}

// ── Sub-panels ────────────────────────────────────────────────────────────

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-white font-semibold text-sm">{title}</h2>
        {subtitle && (
          <p className="text-slate-400 text-xs mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

interface ProgressOverviewProps {
  snapshot: ReturnType<typeof useMastery>["snapshot"];
}

function ProgressOverview({ snapshot }: ProgressOverviewProps) {
  if (!snapshot) {
    return (
      <div className="text-slate-500 text-sm py-4 text-center">
        No mastery data yet.
      </div>
    );
  }

  const { total_concepts, mastered_count, in_progress_count, not_started_count, overall_pct } =
    snapshot;

  const bars = [
    { label: "Proficient", count: mastered_count, color: "bg-green-500", pct: total_concepts ? (mastered_count / total_concepts) * 100 : 0 },
    { label: "Developing", count: in_progress_count, color: "bg-yellow-400", pct: total_concepts ? (in_progress_count / total_concepts) * 100 : 0 },
    { label: "Not started", count: not_started_count, color: "bg-red-500", pct: total_concepts ? (not_started_count / total_concepts) * 100 : 0 },
  ];

  return (
    <div className="space-y-4">
      {/* Big number */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold text-white">
          {Math.round(overall_pct)}%
        </span>
        <span className="text-slate-400 text-sm pb-1">overall mastery</span>
      </div>

      {/* Stacked bar */}
      <div className="w-full h-3 rounded-full bg-slate-700 overflow-hidden flex">
        {bars.map(({ label, pct, color }) => (
          <div
            key={label}
            className={`h-full transition-all duration-500 ${color}`}
            style={{ width: `${pct}%` }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {bars.map(({ label, count, color, pct }) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${color}`} />
            <span className="text-slate-300 flex-1">{label}</span>
            <span className="text-slate-400">{count} concepts</span>
            <span className="text-slate-500 w-10 text-right">
              {Math.round(pct)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

import type { ConceptMasteryItem } from "../../types";

function StudyFocus({ concepts }: { concepts: ConceptMasteryItem[] }) {
  const sorted = [...concepts]
    .sort((a, b) => a.mastery_score - b.mastery_score)
    .slice(0, 5);

  if (sorted.length === 0) {
    return (
      <div className="text-slate-500 text-sm py-4 text-center">
        No concepts to review yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((c) => (
        <div key={c.concept_node_id} className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white truncate">{c.concept_name}</div>
            <div className="text-xs text-slate-500 capitalize">{c.difficulty}</div>
          </div>
          <div className="w-24 flex-shrink-0">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-0.5">
              <span>{Math.round(c.mastery_score * 100)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-700">
              <div
                className={`h-1.5 rounded-full ${
                  c.mastery_score >= 0.7
                    ? "bg-green-500"
                    : c.mastery_score >= 0.3
                    ? "bg-yellow-400"
                    : "bg-red-500"
                }`}
                style={{ width: `${Math.round(c.mastery_score * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Topic picker (shown when no topicId in URL) ───────────────────────────

function TopicPicker() {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const [topics, setTopics] = useState<LearningTopic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get<LearningTopic[]>("/topics")
      .then(({ data }) => setTopics(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <span className="w-4 h-4 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin" />
          Loading topics…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm bg-slate-800/80 backdrop-blur-md border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
        <button
          onClick={() => navigate("/learn")}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm mb-5"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back
        </button>
        <h1 className="text-xl font-bold text-white mb-1">Dashboard</h1>
        <p className="text-slate-400 text-sm mb-6">
          Select a topic to view your mastery progress.
        </p>
        <div className="space-y-2">
          {topics.map((t) => (
            <button
              key={t.id}
              onClick={() => setSearchParams({ topic: t.id })}
              className="w-full text-left px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600/50 hover:bg-slate-700 hover:border-slate-500 text-white text-sm transition-colors"
            >
              {t.title}
            </button>
          ))}
          {topics.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-4">
              No topics found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const topicParam = searchParams.get("topic");
  const topicId = topicParam ? Number(topicParam) : null;

  if (!topicId) return <TopicPicker />;

  return (
    <MasteryProvider>
      <DashboardInner topicId={topicId} />
    </MasteryProvider>
  );
}
