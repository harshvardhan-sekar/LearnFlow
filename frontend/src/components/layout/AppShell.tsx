import { useEffect, useState, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSession } from "../../contexts/SessionContext";
import { useAuth } from "../../contexts/AuthContext";
import client from "../../api/client";
import type { ReactNode } from "react";

interface MasterySummary {
  overall_pct: number;
  mastered_count: number;
  total_concepts: number;
}

/* ── Mastery Badge (inline) ─────────────────────────────────────────── */
function MasteryBadge({ value }: { value: number }) {
  const color =
    value >= 67
      ? "text-emerald-400 bg-emerald-400/10"
      : value >= 34
        ? "text-amber-400 bg-amber-400/10"
        : "text-rose-400 bg-rose-400/10";
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-md font-mono ${color}`}>
      {Math.round(value)}%
    </span>
  );
}

/* ── Session Timer ──────────────────────────────────────────────────── */
function SessionTimer() {
  const { activeSession } = useSession();
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (activeSession?.status === "active" && activeSession.started_at) {
      const startTime = new Date(activeSession.started_at).getTime();
      intervalRef.current = setInterval(() => {
        setElapsed(Date.now() - startTime);
      }, 1000);
    } else if (activeSession?.ended_at && activeSession?.started_at) {
      setElapsed(
        new Date(activeSession.ended_at).getTime() -
          new Date(activeSession.started_at).getTime()
      );
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeSession]);

  const totalSeconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <span className="font-mono text-sm text-slate-300">
      {minutes}:{String(seconds).padStart(2, "0")}
    </span>
  );
}

/* ── Main AppShell ──────────────────────────────────────────────────── */
export default function AppShell({ children }: { children: ReactNode }) {
  const { currentTopic, activeSession, pauseSession, resumeSession, endSession } =
    useSession();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mastery, setMastery] = useState<MasterySummary | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!currentTopic?.id) {
      setMastery(null);
      return;
    }
    let cancelled = false;
    client
      .get<{ mastery_snapshot: MasterySummary }>(`/dashboard/${currentTopic.id}`)
      .then(({ data }) => {
        if (!cancelled) setMastery(data.mastery_snapshot);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentTopic?.id]);

  const handlePause = async () => {
    setActionLoading(true);
    try { await pauseSession(); } catch { /* handled by context */ }
    finally { setActionLoading(false); }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try { await resumeSession(); } catch { /* handled by context */ }
    finally { setActionLoading(false); }
  };

  const handleEnd = async () => {
    setActionLoading(true);
    try { await endSession(); } catch { /* handled by context */ }
    finally { setActionLoading(false); }
  };

  const activeView =
    location.pathname === "/test"
      ? "Test"
      : location.pathname === "/dashboard"
        ? "Dashboard"
        : "Learn";

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-900 text-white">
      {/* ── Top Navigation Bar ───────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-4 py-2 bg-slate-900/90 backdrop-blur border-b border-slate-800">
        {/* Left: Branding + View Tabs */}
        <div className="flex items-center gap-4">
          <h1 className="text-base font-semibold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent select-none">
            LearnFlow
          </h1>

          <div className="flex gap-1 bg-slate-800/80 rounded-xl p-1">
            {(["Learn", "Test", "Dashboard"] as const).map((v) => {
              const to = v === "Learn" ? "/learn" : v === "Test" ? "/test" : "/dashboard";
              return (
                <NavLink
                  key={v}
                  to={to}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    activeView === v
                      ? "bg-slate-700 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-300"
                  }`}
                >
                  {v}
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Right: Session controls */}
        <div className="flex items-center gap-3">
          {/* Session timer */}
          {activeSession && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Session:</span>
              <SessionTimer />
            </div>
          )}

          {/* Pause / Resume / Finish */}
          {activeSession?.status === "active" && (
            <div className="flex gap-1">
              <button
                onClick={handlePause}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-xs hover:bg-amber-500/20 transition-colors disabled:opacity-50"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                Pause
              </button>
              <button
                onClick={handleEnd}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-xs hover:bg-rose-500/20 transition-colors disabled:opacity-50"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                Finish
              </button>
            </div>
          )}

          {activeSession?.status === "paused" && (
            <button
              onClick={handleResume}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Resume
            </button>
          )}

          {/* Mastery badge */}
          {currentTopic && mastery && (
            <MasteryBadge value={mastery.overall_pct} />
          )}

          {/* Status indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-700/50 text-xs text-slate-400">
            <div
              className={`w-2 h-2 rounded-full ${
                activeSession?.status === "active"
                  ? "bg-green-400"
                  : activeSession?.status === "paused"
                    ? "bg-amber-400"
                    : "bg-slate-500"
              }`}
            />
            {activeSession?.status === "active"
              ? "Studying"
              : activeSession?.status === "paused"
                ? "Paused"
                : "Ready"}
          </div>

          {/* Divider */}
          <div className="h-4 w-px bg-slate-700" />

          {/* User menu / Sign out */}
          <button
            onClick={logout}
            title={user?.email ?? "Sign out"}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
              />
            </svg>
            Sign out
          </button>
        </div>
      </nav>

      {/* ── Topic Tabs (shown when there's an active topic) ──────────── */}
      {currentTopic && (
        <div className="flex items-center gap-1 px-4 py-1.5 bg-slate-900/60 border-b border-slate-800/50">
          <span className="text-xs text-slate-500 mr-2">Topic:</span>
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs bg-slate-700/80 text-white">
            {currentTopic.title}
            {mastery && <MasteryBadge value={mastery.overall_pct} />}
          </div>
        </div>
      )}

      {/* ── Main Content Area ───────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {children}
      </div>

      {/* ── Paused Overlay ──────────────────────────────────────────── */}
      {activeSession?.status === "paused" && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 text-center space-y-4">
            <div className="text-3xl">⏸️</div>
            <h2 className="text-lg font-semibold text-white">Session Paused</h2>
            <p className="text-sm text-slate-400">
              Your session timer is paused. Click Resume when you're ready.
            </p>
            <button
              onClick={handleResume}
              disabled={actionLoading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Resume Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
