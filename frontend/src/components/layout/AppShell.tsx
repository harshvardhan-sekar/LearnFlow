import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useSession } from "../../contexts/SessionContext";
import client from "../../api/client";
import type { ReactNode } from "react";

interface MasterySummary {
  overall_pct: number;
  mastered_count: number;
  total_concepts: number;
}

function NavItem({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1.5 px-1 py-3 rounded-xl transition-all duration-150 w-full ${
          isActive
            ? "bg-blue-500/20 text-blue-300"
            : "text-slate-500 hover:text-slate-200 hover:bg-slate-700/50"
        }`
      }
    >
      {icon}
      <span className="text-[9px] font-semibold uppercase tracking-widest leading-none">
        {label}
      </span>
    </NavLink>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { currentTopic } = useSession();
  const [mastery, setMastery] = useState<MasterySummary | null>(null);

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

  const masteryColor =
    mastery == null
      ? "text-slate-400"
      : mastery.overall_pct >= 70
        ? "text-emerald-400"
        : mastery.overall_pct >= 40
          ? "text-amber-400"
          : "text-red-400";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900">
      {/* Sidebar */}
      <nav className="flex-shrink-0 w-[68px] border-r border-slate-700/50 bg-slate-800/40 flex flex-col items-center pt-3 pb-4 px-2 gap-1">
        {/* Logo */}
        <div className="mb-3 p-1.5 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
            />
          </svg>
        </div>

        {/* Nav items */}
        <NavItem
          to="/learn"
          label="Learn"
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
              />
            </svg>
          }
        />

        <NavItem
          to="/test"
          label="Test"
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
              />
            </svg>
          }
        />

        <NavItem
          to="/dashboard"
          label="Progress"
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
              />
            </svg>
          }
        />

        <div className="flex-1" />

        {/* Mastery summary badge */}
        {currentTopic && (
          <div className="w-full rounded-lg bg-slate-800/70 border border-slate-700/40 p-2 text-center">
            {mastery ? (
              <>
                <div className={`text-base font-bold leading-none ${masteryColor}`}>
                  {Math.round(mastery.overall_pct)}%
                </div>
                <div className="text-[8px] text-slate-500 mt-1 leading-tight truncate" title={currentTopic.title}>
                  {currentTopic.title.length > 7
                    ? currentTopic.title.slice(0, 6) + "…"
                    : currentTopic.title}
                </div>
              </>
            ) : (
              <div className="text-[8px] text-slate-600 leading-tight truncate" title={currentTopic.title}>
                {currentTopic.title.length > 7
                  ? currentTopic.title.slice(0, 6) + "…"
                  : currentTopic.title}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Main content area */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
