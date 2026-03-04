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
import { fetchSubgoals } from "../api/subgoals";
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

/** Backend session shape (matches SessionResponse pydantic model). */
interface BackendSession {
  id: number;
  user_id: number | null;
  topic_id: number | null;
  status: string;
  session_state: Record<string, unknown> | null;
  started_at: string;
  ended_at: string | null;
}

/** Backend assessment shape. */
interface BackendAssessment {
  id: number;
  session_id: number;
  user_id: number | null;
  assessment_type: string;
  questions: { questions: BackendQuestion[] };
  answers: Record<string, string> | null;
  score: number | null;
  max_score: number | null;
  created_at: string;
  completed_at: string | null;
}

interface BackendQuestion {
  question: string;
  options: string[];
  correct_index: number;
}

function toSession(raw: BackendSession): Session {
  return {
    id: String(raw.id),
    user_id: String(raw.user_id ?? ""),
    topic_id: String(raw.topic_id ?? ""),
    status: raw.status as Session["status"],
    started_at: raw.started_at,
    paused_at: null,
    ended_at: raw.ended_at,
  };
}

function toAssessmentQuestions(
  raw: BackendQuestion[]
): AssessmentQuestion[] {
  return raw.map((q, idx) => ({
    id: String(idx),
    question: q.question,
    type: "mcq" as const,
    options: q.options,
    correct_answer: String(q.correct_index),
  }));
}

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
  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [lastAssessment, setLastAssessment] = useState<Assessment | null>(null);
  const [lastReflection, setLastReflection] = useState<Reflection | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchActiveSession = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: rawSession } = await client.get<BackendSession | null>(
        "/sessions/active"
      );
      if (rawSession) {
        const session = toSession(rawSession);
        setActiveSession(session);

        // Fetch topic
        if (rawSession.topic_id) {
          try {
            const { data: topic } = await client.get<LearningTopic>(
              `/topics/${rawSession.topic_id}`
            );
            setCurrentTopic(topic);
          } catch {
            // Topic fetch failed
          }

          // Fetch subgoals
          try {
            const sgs = await fetchSubgoals(String(rawSession.topic_id));
            setSubgoals(sgs);
          } catch {
            // Subgoal fetch failed
          }
        }

        if (
          rawSession.status === "paused" ||
          rawSession.status === "active"
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
            session_state: {
              subgoal_ids_completed: subgoals
                .filter((s) => s.is_completed)
                .map((s) => s.id),
            },
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

  async function createAssessment(
    sessionId: string,
    type: "pre" | "post"
  ): Promise<{ questions: AssessmentQuestion[]; assessmentId: number }> {
    const { data } = await client.post<BackendAssessment>("/assessments", {
      session_id: Number(sessionId),
      assessment_type: type,
    });
    const questions = toAssessmentQuestions(data.questions.questions);
    return { questions, assessmentId: data.id };
  }

  async function startSession(topicId: string) {
    setLoading(true);
    try {
      // Create session
      const { data: rawSession } = await client.post<BackendSession>(
        "/sessions",
        { topic_id: Number(topicId) }
      );
      const session = toSession(rawSession);
      setActiveSession(session);

      // Fetch topic
      try {
        const { data: topic } = await client.get<LearningTopic>(
          `/topics/${topicId}`
        );
        setCurrentTopic(topic);
      } catch {
        // Topic fetch failed
      }

      // Fetch existing subgoals for this topic
      try {
        const sgs = await fetchSubgoals(topicId);
        setSubgoals(sgs);
      } catch {
        setSubgoals([]);
      }

      // Create pre-assessment
      try {
        const { questions, assessmentId: aId } = await createAssessment(
          session.id,
          "pre"
        );
        if (questions.length > 0) {
          setAssessmentQuestions(questions);
          setAssessmentId(aId);
          setAssessmentType("pre");
          setPhase("pre_assessment");
        } else {
          setPhase("learning");
        }
      } catch {
        // Assessment generation failed, skip to learning
        setPhase("learning");
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitAssessment(answers: Record<string, string>) {
    if (!activeSession || assessmentId == null) return;
    setLoading(true);
    try {
      const { data } = await client.put<BackendAssessment>(
        `/assessments/${assessmentId}`,
        { answers }
      );
      setLastAssessment({
        id: String(data.id),
        session_id: String(data.session_id),
        assessment_type: data.assessment_type as "pre" | "post",
        questions: toAssessmentQuestions(data.questions.questions),
        answers: data.answers ?? {},
        score: data.score,
        total: data.max_score ?? 0,
        submitted_at: data.completed_at,
      });

      if (assessmentType === "pre") {
        setAssessmentQuestions([]);
        setAssessmentId(null);
        setPhase("learning");
      } else {
        setAssessmentQuestions([]);
        setAssessmentId(null);
        setPhase("reflection");
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitReflection(reflectionData: {
    content: string;
    confidence: number;
    difficulty: number;
  }) {
    if (!activeSession) return;
    setLoading(true);
    try {
      const { data: reflection } = await client.post<{
        id: number;
        session_id: number;
        reflection_text: string | null;
        confidence_rating: number | null;
        difficulty_rating: number | null;
        created_at: string;
      }>("/reflections", {
        session_id: Number(activeSession.id),
        reflection_text: reflectionData.content,
        confidence_rating: reflectionData.confidence,
        difficulty_rating: reflectionData.difficulty,
      });
      setLastReflection({
        id: String(reflection.id),
        session_id: String(reflection.session_id),
        content: reflection.reflection_text ?? "",
        confidence: reflection.confidence_rating ?? 3,
        difficulty: reflection.difficulty_rating ?? 3,
        submitted_at: reflection.created_at,
      });

      // End the session on the backend
      await client.put(`/sessions/${activeSession.id}/end`);

      setPhase("summary");
    } finally {
      setLoading(false);
    }
  }

  async function pauseSession() {
    if (!activeSession) return;
    const { data } = await client.put<BackendSession>(
      `/sessions/${activeSession.id}/pause`
    );
    setActiveSession(toSession(data));
  }

  async function resumeSession() {
    if (!activeSession) return;
    const { data } = await client.put<BackendSession>(
      `/sessions/${activeSession.id}/resume`
    );
    setActiveSession(toSession(data));
    setShowResumeModal(false);
  }

  async function endSession() {
    if (!activeSession) return;

    // Create post-assessment
    try {
      const { questions, assessmentId: aId } = await createAssessment(
        activeSession.id,
        "post"
      );
      if (questions.length > 0) {
        setAssessmentQuestions(questions);
        setAssessmentId(aId);
        setAssessmentType("post");
        setPhase("post_assessment");
        return;
      }
    } catch {
      // Assessment generation failed, skip to reflection
    }

    // No post-assessment, go straight to reflection
    setPhase("reflection");
  }

  function resetSession() {
    setActiveSession(null);
    setCurrentTopic(null);
    setSubgoals([]);
    setAssessmentQuestions([]);
    setAssessmentId(null);
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
