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
import type {
  Session,
  LearningTopic,
  Subgoal,
  SessionPhase,
  AssessmentQuestion,
  Assessment,
  Reflection,
} from "../types";

interface SessionContextValue {
  activeSession: Session | null;
  currentTopic: LearningTopic | null;
  subgoals: Subgoal[];
  loading: boolean;
  showResumeModal: boolean;
  phase: SessionPhase;
  assessmentQuestions: AssessmentQuestion[];
  assessmentType: "pre" | "post";
  lastAssessment: Assessment | null;
  lastReflection: Reflection | null;
  startSession: (topicId: string) => Promise<void>;
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
  endSession: () => Promise<void>;
  submitAssessment: (answers: Record<string, string>) => Promise<void>;
  submitReflection: (data: {
    content: string;
    confidence: number;
    difficulty: number;
  }) => Promise<void>;
  resetSession: () => void;
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
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [assessmentQuestions, setAssessmentQuestions] = useState<
    AssessmentQuestion[]
  >([]);
  const [assessmentType, setAssessmentType] = useState<"pre" | "post">("pre");
  const [lastAssessment, setLastAssessment] = useState<Assessment | null>(null);
  const [lastReflection, setLastReflection] = useState<Reflection | null>(null);
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
          setPhase("learning");
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

  async function fetchAssessment(
    sessionId: string,
    type: "pre" | "post",
  ): Promise<AssessmentQuestion[]> {
    const { data } = await client.get<{ questions: AssessmentQuestion[] }>(
      `/sessions/${sessionId}/assessment`,
      { params: { type } },
    );
    return data.questions;
  }

  async function startSession(topicId: string) {
    setLoading(true);
    try {
      const { data } = await client.post<{
        session: Session;
        topic: LearningTopic;
        subgoals: Subgoal[];
      }>("/sessions", { topic_id: topicId });
      setActiveSession(data.session);
      setCurrentTopic(data.topic);
      setSubgoals(data.subgoals);

      // Fetch pre-assessment questions
      try {
        const questions = await fetchAssessment(data.session.id, "pre");
        if (questions.length > 0) {
          setAssessmentQuestions(questions);
          setAssessmentType("pre");
          setPhase("pre_assessment");
        } else {
          // No pre-assessment configured, go straight to learning
          setPhase("learning");
        }
      } catch {
        // Assessment endpoint not available, skip to learning
        setPhase("learning");
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitAssessment(answers: Record<string, string>) {
    if (!activeSession) return;
    setLoading(true);
    try {
      const { data } = await client.post<Assessment>(
        `/sessions/${activeSession.id}/assessment`,
        { type: assessmentType, answers },
      );
      setLastAssessment(data);

      if (assessmentType === "pre") {
        // Pre-assessment done → go to learning
        setAssessmentQuestions([]);
        setPhase("learning");
      } else {
        // Post-assessment done → go to reflection
        setAssessmentQuestions([]);
        setPhase("reflection");
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitReflection(data: {
    content: string;
    confidence: number;
    difficulty: number;
  }) {
    if (!activeSession) return;
    setLoading(true);
    try {
      const { data: reflection } = await client.post<Reflection>(
        `/sessions/${activeSession.id}/reflection`,
        data,
      );
      setLastReflection(reflection);

      // End the session on the backend
      await client.put(`/sessions/${activeSession.id}/end`);

      setPhase("summary");
    } finally {
      setLoading(false);
    }
  }

  async function pauseSession() {
    if (!activeSession) return;
    const { data } = await client.put<Session>(
      `/sessions/${activeSession.id}/pause`,
    );
    setActiveSession(data);
  }

  async function resumeSession() {
    if (!activeSession) return;
    const { data } = await client.put<Session>(
      `/sessions/${activeSession.id}/resume`,
    );
    setActiveSession(data);
    setShowResumeModal(false);
  }

  async function endSession() {
    if (!activeSession) return;

    // Fetch post-assessment questions
    try {
      const questions = await fetchAssessment(activeSession.id, "post");
      if (questions.length > 0) {
        setAssessmentQuestions(questions);
        setAssessmentType("post");
        setPhase("post_assessment");
        return;
      }
    } catch {
      // Assessment endpoint not available, skip to reflection
    }

    // No post-assessment, go straight to reflection
    setPhase("reflection");
  }

  function resetSession() {
    setActiveSession(null);
    setCurrentTopic(null);
    setSubgoals([]);
    setAssessmentQuestions([]);
    setLastAssessment(null);
    setLastReflection(null);
    setPhase("idle");
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
        phase,
        assessmentQuestions,
        assessmentType,
        lastAssessment,
        lastReflection,
        startSession,
        pauseSession,
        resumeSession,
        endSession,
        submitAssessment,
        submitReflection,
        resetSession,
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
