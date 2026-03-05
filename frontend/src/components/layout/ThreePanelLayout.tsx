import { useEffect, useRef, useState, useCallback } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { motion } from "framer-motion";
import { useSession } from "../../contexts/SessionContext";
import { useEventLogger } from "../../hooks/useEventLogger";
import { useToast } from "../../contexts/ToastContext";
import SearchPanel from "../search/SearchPanel";
import ChatPanel from "../chat/ChatPanel";
import SubgoalPanel from "../subgoals/SubgoalPanel";

type PanelName = "search" | "chat" | "subgoals";

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

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

  return (
    <span className="font-mono text-sm text-slate-300">
      {formatTime(elapsed)}
    </span>
  );
}

export default function ThreePanelLayout() {
  const { activeSession, currentTopic, pauseSession, resumeSession, endSession } =
    useSession();
  const { logEvent } = useEventLogger();
  const { showToast } = useToast();
  const [sessionActionLoading, setSessionActionLoading] = useState(false);

  const handlePause = useCallback(async () => {
    setSessionActionLoading(true);
    try { await pauseSession(); }
    catch { showToast("Failed to pause session."); }
    finally { setSessionActionLoading(false); }
  }, [pauseSession, showToast]);

  const handleResume = useCallback(async () => {
    setSessionActionLoading(true);
    try { await resumeSession(); }
    catch { showToast("Failed to resume session."); }
    finally { setSessionActionLoading(false); }
  }, [resumeSession, showToast]);

  const handleEnd = useCallback(async () => {
    setSessionActionLoading(true);
    try { await endSession(); }
    catch { showToast("Failed to end session."); }
    finally { setSessionActionLoading(false); }
  }, [endSession, showToast]);

  // Panel focus tracking
  const activePanelRef = useRef<PanelName | null>(null);
  const focusStartRef = useRef<number>(Date.now());

  const handlePanelFocus = useCallback(
    (panel: PanelName) => {
      if (panel === activePanelRef.current) return;
      const now = Date.now();
      if (activePanelRef.current) {
        logEvent("panel_focus", {
          panel: activePanelRef.current,
          duration_ms: now - focusStartRef.current,
        });
      }
      activePanelRef.current = panel;
      focusStartRef.current = now;
    },
    [logEvent]
  );

  // Flush final panel_focus on unmount
  useEffect(() => {
    return () => {
      if (activePanelRef.current) {
        logEvent("panel_focus", {
          panel: activePanelRef.current,
          duration_ms: Date.now() - focusStartRef.current,
        });
      }
    };
  }, [logEvent]);

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "learnflow-panels",
  });

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header Bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-slate-800/80 backdrop-blur-md border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          {currentTopic ? (
            <span className="text-sm font-medium text-slate-200">
              {currentTopic.title}
            </span>
          ) : (
            <span className="text-sm text-slate-400">Select a topic to begin</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {activeSession && <SessionTimer />}

          {activeSession?.status === "active" && (
            <>
              <button
                onClick={handlePause}
                disabled={sessionActionLoading}
                className="px-3 py-1.5 text-sm rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
              >
                {sessionActionLoading ? "..." : "Pause"}
              </button>
              <button
                onClick={handleEnd}
                disabled={sessionActionLoading}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
              >
                {sessionActionLoading ? "..." : "Finish Studying"}
              </button>
            </>
          )}

          {activeSession?.status === "paused" && (
            <button
              onClick={handleResume}
              disabled={sessionActionLoading}
              className="px-3 py-1.5 text-sm rounded-lg bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 disabled:opacity-50 transition-colors"
            >
              {sessionActionLoading ? "..." : "Resume"}
            </button>
          )}

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-700/50 text-xs text-slate-400">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            Ready
          </div>
        </div>
      </header>

      {/* Three-Panel Layout */}
      <div className="flex-1 overflow-hidden">
        <Group
          orientation="horizontal"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
        >
          <Panel
            id="search"
            defaultSize="30%"
            minSize="15%"
            collapsible
          >
            <motion.div
              layout
              className="h-full bg-slate-800/60 backdrop-blur-sm rounded-xl m-1.5 mr-0 border border-slate-700/40 overflow-hidden"
              onMouseEnter={() => handlePanelFocus("search")}
            >
              <SearchPanel />
            </motion.div>
          </Panel>

          <Separator className="w-1.5 bg-slate-700/50 hover:bg-blue-500/50 transition-colors duration-150 rounded-full mx-0.5" />

          <Panel
            id="chat"
            defaultSize="40%"
            minSize="15%"
          >
            <motion.div
              layout
              className="h-full bg-slate-800/60 backdrop-blur-sm rounded-xl m-1.5 mx-0 border border-slate-700/40 overflow-hidden"
              onMouseEnter={() => handlePanelFocus("chat")}
            >
              <ChatPanel />
            </motion.div>
          </Panel>

          <Separator className="w-1.5 bg-slate-700/50 hover:bg-blue-500/50 transition-colors duration-150 rounded-full mx-0.5" />

          <Panel
            id="subgoals"
            defaultSize="30%"
            minSize="15%"
            collapsible
          >
            <motion.div
              layout
              className="h-full bg-slate-800/60 backdrop-blur-sm rounded-xl m-1.5 ml-0 border border-slate-700/40 overflow-hidden"
              onMouseEnter={() => handlePanelFocus("subgoals")}
            >
              <SubgoalPanel />
            </motion.div>
          </Panel>
        </Group>
      </div>
    </div>
  );
}
