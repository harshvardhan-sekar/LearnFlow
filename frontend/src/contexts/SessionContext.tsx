import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import client from "../api/client";
import { useAuth } from "./AuthContext";
import type { Session, LearningTopic, Subgoal } from "../types";

interface SessionContextValue {
  activeSession: Session | null;
  currentTopic: LearningTopic | null;
  subgoals: Subgoal[];
  loading: boolean;
  showResumeModal: boolean;
  startSession: (topicId: string) => Promise<void>;
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
  endSession: () => Promise<void>;
  dismissResumeModal: () => void;
  setSubgoals: (subgoals: Subgoal[]) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [currentTopic, setCurrentTopic] = useState<LearningTopic | null>(null);
  const [subgoals, setSubgoals] = useState<Subgoal[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchActiveSession = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await client.get<{
        session: Session;
        topic: LearningTopic;
        subgoals: Subgoal[];
      }>("/sessions/active");
      if (data.session) {
        setActiveSession(data.session);
        setCurrentTopic(data.topic);
        setSubgoals(data.subgoals);
        if (
          data.session.status === "paused" ||
          data.session.status === "active"
        ) {
          setShowResumeModal(true);
        }
      }
    } catch {
      // No active session — that's fine
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchActiveSession();
  }, [fetchActiveSession]);

  // Auto-save session state every 60s
  useEffect(() => {
    if (activeSession?.status === "active") {
      autoSaveRef.current = setInterval(async () => {
        try {
          await client.put(`/sessions/${activeSession.id}/state`, {
            subgoal_ids_completed: subgoals
              .filter((s) => s.is_completed)
              .map((s) => s.id),
          });
        } catch {
          // Silent fail for auto-save
        }
      }, 60_000);
    }
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [activeSession, subgoals]);

  async function startSession(topicId: string) {
    const { data } = await client.post<{
      session: Session;
      topic: LearningTopic;
      subgoals: Subgoal[];
    }>("/sessions", { topic_id: topicId });
    setActiveSession(data.session);
    setCurrentTopic(data.topic);
    setSubgoals(data.subgoals);
  }

  async function pauseSession() {
    if (!activeSession) return;
    const { data } = await client.put<Session>(
      `/sessions/${activeSession.id}/pause`
    );
    setActiveSession(data);
  }

  async function resumeSession() {
    if (!activeSession) return;
    const { data } = await client.put<Session>(
      `/sessions/${activeSession.id}/resume`
    );
    setActiveSession(data);
    setShowResumeModal(false);
  }

  async function endSession() {
    if (!activeSession) return;
    await client.put(`/sessions/${activeSession.id}/end`);
    setActiveSession(null);
    setCurrentTopic(null);
    setSubgoals([]);
  }

  function dismissResumeModal() {
    setShowResumeModal(false);
  }

  return (
    <SessionContext.Provider
      value={{
        activeSession,
        currentTopic,
        subgoals,
        loading,
        showResumeModal,
        startSession,
        pauseSession,
        resumeSession,
        endSession,
        dismissResumeModal,
        setSubgoals,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
