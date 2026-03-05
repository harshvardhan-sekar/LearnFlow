import { useEffect, useState } from "react";
import {
  getParticipants,
  getSessions,
  getEvents,
  getMetrics,
  getV2Metrics,
  downloadCsvExport,
} from "../../api/admin";
import type {
  ParticipantMasteryItem,
  TestScoreDataPoint,
  V2Metrics,
} from "../../api/admin";
import type {
  AdminParticipant,
  AdminSession,
  AdminEvent,
  AdminMetrics,
} from "../../types";

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Metric Card ─────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

// ── Status Badge ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-500/20 text-green-300 border-green-500/30",
    paused: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    completed: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs border ${colors[status] ?? "bg-slate-600/20 text-slate-300 border-slate-500/30"}`}
    >
      {status}
    </span>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [v2Metrics, setV2Metrics] = useState<V2Metrics | null>(null);
  const [participants, setParticipants] = useState<AdminParticipant[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const [m, v2, p] = await Promise.all([getMetrics(), getV2Metrics(), getParticipants()]);
        setMetrics(m);
        setV2Metrics(v2);
        setParticipants(p);
        const s = await getSessions();
        setSessions(s);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load admin data";
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Reload sessions when filters change
  useEffect(() => {
    (async () => {
      try {
        const s = await getSessions({
          user_id: selectedUserId ?? undefined,
          status: statusFilter || undefined,
        });
        setSessions(s);
        setSelectedSessionId(null);
        setEvents([]);
      } catch {
        /* keep stale data */
      }
    })();
  }, [selectedUserId, statusFilter]);

  // Load events when session selected
  useEffect(() => {
    if (selectedSessionId == null) {
      setEvents([]);
      return;
    }
    (async () => {
      try {
        const e = await getEvents({ session_id: selectedSessionId, limit: 200 });
        setEvents(e);
      } catch {
        /* keep stale */
      }
    })();
  }, [selectedSessionId]);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadCsvExport({
        user_id: selectedUserId ?? undefined,
      });
    } catch {
      /* ignore */
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-pulse text-slate-400">Loading dashboard…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Research Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            LearnFlow — participant data & metrics
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href="/learn"
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
          >
            Back to App
          </a>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            label="Total Sessions"
            value={`${metrics.total_sessions} (${metrics.total_completed_sessions} completed)`}
          />
          <MetricCard
            label="Avg Session Duration"
            value={formatDuration(metrics.avg_session_duration_ms)}
          />
          <MetricCard
            label="Search / Chat Ratio"
            value={
              metrics.search_to_chat_ratio != null
                ? `${metrics.search_to_chat_ratio} : 1`
                : "—"
            }
          />
          <MetricCard
            label="Subgoal Completion"
            value={
              metrics.subgoal_completion_rate != null
                ? `${Math.round(metrics.subgoal_completion_rate * 100)}%`
                : "—"
            }
          />
        </div>
      )}

      {/* V2 Metrics */}
      {v2Metrics && (
        <div className="mb-8 space-y-6">
          {/* Summary row */}
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Avg Hints per Question"
              value={
                v2Metrics.avg_hints_per_question != null
                  ? v2Metrics.avg_hints_per_question.toFixed(1)
                  : "—"
              }
            />
            <MetricCard
              label="Goal Completion Rate"
              value={
                v2Metrics.goal_completion_rate != null
                  ? `${Math.round(v2Metrics.goal_completion_rate * 100)}%`
                  : "—"
              }
            />
          </div>

          {/* Test scores over time */}
          {v2Metrics.test_scores_over_time.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">Test Scores Over Time</h2>
              <div className="overflow-x-auto rounded-xl border border-slate-700/40">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/80">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Date</th>
                      <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Avg Score</th>
                      <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Tests</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {v2Metrics.test_scores_over_time.map((row: TestScoreDataPoint) => (
                      <tr key={row.date} className="hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 text-slate-300">{row.date}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={
                              row.avg_score_pct >= 70
                                ? "text-emerald-400"
                                : row.avg_score_pct >= 40
                                  ? "text-amber-400"
                                  : "text-red-400"
                            }
                          >
                            {Math.round(row.avg_score_pct)}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-300">{row.test_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Participant mastery table */}
          {v2Metrics.participant_mastery.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">Mastery by Participant</h2>
              <div className="overflow-x-auto rounded-xl border border-slate-700/40">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/80">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Participant</th>
                      <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Avg Mastery</th>
                      <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Concepts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {v2Metrics.participant_mastery.map((row: ParticipantMasteryItem) => (
                      <tr key={row.user_id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-2.5">
                          <div>{row.email}</div>
                          {row.display_name && (
                            <div className="text-xs text-slate-500">{row.display_name}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={
                              row.avg_mastery >= 0.7
                                ? "text-emerald-400"
                                : row.avg_mastery >= 0.4
                                  ? "text-amber-400"
                                  : "text-red-400"
                            }
                          >
                            {Math.round(row.avg_mastery * 100)}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-300">{row.concept_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Participants */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Participants</h2>
          {selectedUserId != null && (
            <button
              onClick={() => setSelectedUserId(null)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Clear filter
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-700/40">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/80">
              <tr>
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Email</th>
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Display Name</th>
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Role</th>
                <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Sessions</th>
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {participants.map((p) => (
                <tr
                  key={p.id}
                  onClick={() =>
                    setSelectedUserId(selectedUserId === p.id ? null : p.id)
                  }
                  className={`cursor-pointer transition-colors ${
                    selectedUserId === p.id
                      ? "bg-blue-600/10"
                      : "hover:bg-slate-800/40"
                  }`}
                >
                  <td className="px-4 py-2.5">{p.email}</td>
                  <td className="px-4 py-2.5 text-slate-300">
                    {p.display_name || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-300">{p.role}</td>
                  <td className="px-4 py-2.5 text-right">{p.session_count}</td>
                  <td className="px-4 py-2.5 text-slate-300">
                    {formatDate(p.last_active)}
                  </td>
                </tr>
              ))}
              {participants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No participants yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sessions */}
      <section className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <h2 className="text-lg font-semibold">Sessions</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-1 text-sm focus:ring-blue-500/50 focus:outline-none"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
          {selectedUserId != null && (
            <span className="text-xs text-slate-400">
              Filtered to user #{selectedUserId}
            </span>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-700/40">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/80">
              <tr>
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">ID</th>
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">User</th>
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Topic</th>
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Started</th>
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {sessions.map((s) => {
                const dur =
                  s.ended_at && s.started_at
                    ? new Date(s.ended_at).getTime() -
                      new Date(s.started_at).getTime()
                    : null;
                return (
                  <tr
                    key={s.id}
                    onClick={() =>
                      setSelectedSessionId(
                        selectedSessionId === s.id ? null : s.id
                      )
                    }
                    className={`cursor-pointer transition-colors ${
                      selectedSessionId === s.id
                        ? "bg-blue-600/10"
                        : "hover:bg-slate-800/40"
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-slate-300">
                      {s.id}
                    </td>
                    <td className="px-4 py-2.5">{s.user_email || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-300">
                      {s.topic_title || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-2.5 text-slate-300">
                      {formatDate(s.started_at)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300">
                      {formatDuration(dur)}
                    </td>
                  </tr>
                );
              })}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No sessions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Event Timeline */}
      {selectedSessionId != null && (
        <section>
          <h2 className="text-lg font-semibold mb-3">
            Events — Session #{selectedSessionId}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-700/40 max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/80 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Time</th>
                  <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Event Type</th>
                  <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-2 text-slate-300 whitespace-nowrap">
                      {formatDate(ev.created_at)}
                    </td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded bg-slate-700/60 text-xs font-mono">
                        {ev.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-400 text-xs font-mono max-w-md truncate">
                      {ev.event_data
                        ? JSON.stringify(ev.event_data)
                        : "—"}
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                      No events for this session
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
