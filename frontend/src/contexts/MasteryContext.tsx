import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { getDashboard, overrideMastery as apiOverride } from "../api/dashboard";
import type { MasterySnapshot, LearnerGoal, DashboardData } from "../types";

interface MasteryContextValue {
  snapshot: MasterySnapshot | null;
  goals: LearnerGoal[];
  topicId: number | null;
  topicTitle: string;
  loading: boolean;
  loadDashboard: (topicId: number) => Promise<void>;
  overrideMastery: (conceptNodeId: number, newMastery: number) => Promise<void>;
  setGoals: (goals: LearnerGoal[]) => void;
  refresh: () => Promise<void>;
}

const MasteryContext = createContext<MasteryContextValue | null>(null);

export function MasteryProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<MasterySnapshot | null>(null);
  const [goals, setGoals] = useState<LearnerGoal[]>([]);
  const [topicId, setTopicId] = useState<number | null>(null);
  const [topicTitle, setTopicTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const loadDashboard = useCallback(async (tid: number) => {
    setLoading(true);
    try {
      const data: DashboardData = await getDashboard(tid);
      setSnapshot(data.mastery_snapshot);
      setGoals(data.goals);
      setTopicId(tid);
      setTopicTitle(data.topic_title);
    } catch {
      // silent — dashboard may not exist yet
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (topicId !== null) await loadDashboard(topicId);
  }, [topicId, loadDashboard]);

  const overrideMastery = useCallback(
    async (conceptNodeId: number, newMastery: number) => {
      await apiOverride(conceptNodeId, newMastery);
      await refresh();
    },
    [refresh]
  );

  return (
    <MasteryContext.Provider
      value={{
        snapshot,
        goals,
        topicId,
        topicTitle,
        loading,
        loadDashboard,
        overrideMastery,
        setGoals,
        refresh,
      }}
    >
      {children}
    </MasteryContext.Provider>
  );
}

export function useMastery(): MasteryContextValue {
  const ctx = useContext(MasteryContext);
  if (!ctx) throw new Error("useMastery must be used within MasteryProvider");
  return ctx;
}
