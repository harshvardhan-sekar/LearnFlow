import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import client from "../../api/client";
import { generateStudyPlan } from "../../api/dashboard";
import { generateTest } from "../../api/tests";
import type { LearningTopic, StudyPlanItem } from "../../types";
import type { TestRecord } from "../../api/tests";
import { MasteryProvider, useMastery } from "../../contexts/MasteryContext";
import MasteryHeatmap from "./MasteryHeatmap";
import GoalEditor from "./GoalEditor";
import ProgressChart from "./ProgressChart";
import WeaknessPanel from "./WeaknessPanel";
import TestTaker from "../testing/TestTaker";
import GradingResult from "../testing/GradingResult";

// ── Quiz overlay (mini inline test triggered from WeaknessPanel) ──────────

type QuizStage = "taking" | "result";

interface QuizOverlayProps {
  topicId: number;
  conceptName: string;
  onClose: () => void;
  onGradingDone: () => void;
}

function QuizOverlay({
  topicId,
  conceptName,
  onClose,
  onGradingDone,
}: QuizOverlayProps) {
  const [stage, setStage] = useState<QuizStage | "loading">("loading");
  const [activeTest, setActiveTest] = useState<TestRecord | null>(null);
  const [gradedTest, setGradedTest] = useState<TestRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    generateTest(topicId, 3, "informal")
      .then((test) => {
        setActiveTest(test);
        setStage("taking");
      })
      .catch(() => {
        setError("Failed to generate quiz. Please try again.");
      });
  }, [topicId]);

  function handleGraded(test: TestRecord) {
    setGradedTest(test);
    setStage("result");
    onGradingDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold text-sm">Mini Quiz</h2>
            <p className="text-slate-400 text-xs mt-0.5">{conceptName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {stage === "loading" && !error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <span className="w-6 h-6 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">Generating questions…</p>
            </div>
          )}
          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
              {error}
            </div>
          )}
          {stage === "taking" && activeTest && (
            <TestTaker
              test={activeTest}
              onGraded={handleGraded}
              onCancel={onClose}
            />
          )}
          {stage === "result" && gradedTest && (
            <GradingResult
              test={gradedTest}
              onRetake={onClose}
              onDone={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inner page (needs MasteryContext) ────────────────────────────────────

function DashboardInner({ topicId }: { topicId: number }) {
  const {
    snapshot,
    goals,
    studyPlan,
    setStudyPlan,
    topicTitle,
    loading,
    loadDashboard,
    refresh,
  } = useMastery();

  const [planLoading, setPlanLoading] = useState(false);
  const [planItems, setPlanItems] = useState<StudyPlanItem[]>([]);

  // Quiz overlay state
  const [quizTarget, setQuizTarget] = useState<{
    conceptKey: string;
    conceptName: string;
  } | null>(null);

  useEffect(() => {
    loadDashboard(topicId).then(() => {});
  }, [topicId, loadDashboard]);

  // Sync plan items when a study plan loads from context
  useEffect(() => {
    if (studyPlan) {
      setPlanItems(studyPlan.items.map((item) => ({ ...item })));
    }
  }, [studyPlan]);

  const masteredPct = snapshot ? Math.round(snapshot.overall_pct) : 0;
  const masteredCount = snapshot?.mastered_count ?? 0;
  const totalCount = snapshot?.total_concepts ?? 0;
  const concepts = snapshot?.concepts ?? [];

  async function handleGenerateStudyPlan() {
    setPlanLoading(true);
    try {
      const data = await generateStudyPlan(topicId);
      const plan = data.study_plan;
      if (plan) {
        setStudyPlan(plan);
        setPlanItems(plan.items.map((item) => ({ ...item })));
      }
    } catch {
      // silent
    } finally {
      setPlanLoading(false);
    }
  }

  function handleQuizDone() {
    refresh();
  }

  return (
    <div className="h-full bg-slate-900 flex flex-col overflow-hidden">
      {/* Quiz overlay */}
      {quizTarget && (
        <QuizOverlay
          topicId={topicId}
          conceptName={quizTarget.conceptName}
          onClose={() => setQuizTarget(null)}
          onGradingDone={handleQuizDone}
        />
      )}

      {/* Page header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-md flex-shrink-0">
        <div className="px-6 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-slate-200 uppercase tracking-wider truncate">
              {topicTitle ? `Progress · ${topicTitle}` : "Progress"}
            </h1>
            {snapshot && (
              <p className="text-slate-400 text-xs mt-0.5">
                {masteredCount} / {totalCount} concepts mastered — {masteredPct}% overall
              </p>
            )}
          </div>

          {loading && (
            <span className="w-4 h-4 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin flex-shrink-0" />
          )}
        </div>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
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

          {/* Panel 3 — Progress Chart */}
          <Panel title="Progress Chart" subtitle="Test scores over time">
            <ProgressChart
              topicId={topicId}
              overallPct={snapshot?.overall_pct ?? 0}
              masteredCount={masteredCount}
              totalCount={totalCount}
            />
          </Panel>

          {/* Panel 4 — Weakness Panel */}
          <Panel
            title="Weak Areas"
            subtitle="Ranked by study priority · take action"
          >
            <WeaknessPanel
              topicId={topicId}
              onTakeQuiz={(conceptKey, conceptName) =>
                setQuizTarget({ conceptKey, conceptName })
              }
            />
          </Panel>
        </div>

        {/* Study Plan section */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-white font-semibold text-sm">Study Plan</h2>
              <p className="text-slate-400 text-xs mt-0.5">
                AI-generated priority plan based on your mastery and goals
              </p>
            </div>
            <button
              onClick={handleGenerateStudyPlan}
              disabled={planLoading}
              className="flex-shrink-0 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500
                         disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm
                         font-medium transition-colors"
            >
              {planLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating…
                </span>
              ) : studyPlan ? (
                "Regenerate Plan"
              ) : (
                "Generate Study Plan"
              )}
            </button>
          </div>

          {studyPlan && planItems.length > 0 && (
            <div className="mt-4 space-y-3">
              {studyPlan.summary && (
                <p className="text-slate-300 text-sm leading-relaxed">
                  {studyPlan.summary}
                </p>
              )}
              <div className="space-y-2">
                {planItems.map((item, idx) => (
                  <StudyPlanRow
                    key={idx}
                    item={item}
                    onToggle={() =>
                      setPlanItems((prev) =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, checked: !p.checked } : p
                        )
                      )
                    }
                  />
                ))}
              </div>
              <p className="text-slate-600 text-xs">
                Generated{" "}
                {new Date(studyPlan.generated_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Study plan row ─────────────────────────────────────────────────────────

function StudyPlanRow({
  item,
  onToggle,
}: {
  item: StudyPlanItem;
  onToggle: () => void;
}) {
  const priorityColors = {
    high: "text-red-400 bg-red-900/20 border-red-800/40",
    medium: "text-yellow-400 bg-yellow-900/20 border-yellow-800/40",
    low: "text-green-400 bg-green-900/20 border-green-800/40",
  } as const;

  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={item.checked}
          onChange={onToggle}
          className="sr-only"
        />
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
            item.checked
              ? "bg-indigo-600 border-indigo-600"
              : "bg-transparent border-slate-600 group-hover:border-slate-400"
          }`}
        >
          {item.checked && (
            <svg
              className="w-2.5 h-2.5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-sm font-medium ${item.checked ? "line-through text-slate-500" : "text-white"}`}
          >
            {item.concept_name}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-xs border capitalize ${priorityColors[item.priority]}`}
          >
            {item.priority}
          </span>
          <span className="text-xs text-slate-500">
            ~{item.estimated_time_min} min
          </span>
        </div>
        {item.rationale && (
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            {item.rationale}
          </p>
        )}
      </div>
    </label>
  );
}

// ── Panel wrapper ────────────────────────────────────────────────────────────

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

// ── Topic picker (shown when no topicId in URL) ───────────────────────────

function TopicPicker() {
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
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <span className="w-4 h-4 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin" />
          Loading topics…
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm bg-slate-800/80 backdrop-blur-md border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-xl font-bold text-white mb-1">Progress Dashboard</h1>
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
