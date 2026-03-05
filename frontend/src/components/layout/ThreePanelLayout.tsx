import { useEffect, useRef, useCallback } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { motion } from "framer-motion";
import { useEventLogger } from "../../hooks/useEventLogger";
import SearchPanel from "../search/SearchPanel";
import ChatPanel from "../chat/ChatPanel";
import SubgoalPanel from "../subgoals/SubgoalPanel";

type PanelName = "search" | "chat" | "subgoals";

export default function ThreePanelLayout() {
  const { logEvent } = useEventLogger();

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
