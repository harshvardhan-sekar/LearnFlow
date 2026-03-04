export interface User {
  id: string;
  email: string;
  display_name: string;
  firebase_uid: string;
  created_at: string;
}

export interface LearningTopic {
  id: string;
  title: string;
  description: string;
  user_id: string;
  created_at: string;
}

export interface Subgoal {
  id: string;
  topic_id: string;
  title: string;
  description: string;
  order_index: number;
  is_completed: boolean;
  source: "ai_generated" | "user_created";
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  topic_id: string;
  status: "active" | "paused" | "completed";
  started_at: string;
  paused_at: string | null;
  ended_at: string | null;
  total_duration_ms: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

export interface BehavioralEvent {
  event_type: string;
  session_id: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface AssessmentQuestion {
  id: string;
  question: string;
  type: "mcq" | "short_answer";
  options?: string[];
  correct_answer: string;
}

export interface Assessment {
  id: string;
  session_id: string;
  assessment_type: "pre" | "post";
  questions: AssessmentQuestion[];
  answers: Record<string, string>;
  score: number | null;
  total: number;
  submitted_at: string | null;
}

export interface Reflection {
  id: string;
  session_id: string;
  content: string;
  confidence: number;
  difficulty: number;
  submitted_at: string;
}

export type SessionPhase =
  | "idle"
  | "pre_assessment"
  | "learning"
  | "post_assessment"
  | "reflection"
  | "summary";
