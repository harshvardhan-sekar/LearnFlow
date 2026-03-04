import { useEffect, useRef, useState } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { motion } from "framer-motion";
import { useSession } from "../../contexts/SessionContext";
import SearchPanel from "../search/SearchPanel";
import ChatPanel from "../chat/ChatPanel";

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
    if (activeSession?.status === "active") {
      const startTime =
        Date.now() - (activeSession.total_duration_ms || 0);
      intervalRef.current = setInterval(() => {
        setElapsed(Date.now() - startTime);
      }, 1000);
    } else {
      setElapsed(activeSession?.total_duration_ms || 0);
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

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "learnflow-panels",
  });

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Header Bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-slate-800/80 backdrop-blur-md border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-white tracking-tight">
            LearnFlow
          </h1>
          {currentTopic && (
            <span className="px-2.5 py-0.5 text-sm rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {currentTopic.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {activeSession && <SessionTimer />}

          {activeSession?.status === "active" && (
            <>
              <button
                onClick={pauseSession}
                className="px-3 py-1.5 text-sm rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
              >
                Pause
              </button>
              <button
                onClick={endSession}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-colors"
              >
                Finish Studying
              </button>
            </>
          )}

          {activeSession?.status === "paused" && (
            <button
              onClick={resumeSession}
              className="px-3 py-1.5 text-sm rounded-lg bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 transition-colors"
            >
              Resume
            </button>
          )}

          {/* Context usage indicator placeholder */}
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
            >
              <div className="p-4 border-b border-slate-700/40">
                <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">
                  Subgoal Manager
                </h2>
              </div>
              <div className="p-4 text-slate-500 text-sm">
                Subgoal panel — coming soon
              </div>
            </motion.div>
          </Panel>
        </Group>
      </div>
    </div>
  );
}
