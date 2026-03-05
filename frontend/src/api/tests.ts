import client from "./client";

export interface RubricCriterion {
  criterion: string;
  points: number;
  max: number;
  comment: string;
}

export interface QuestionRubric {
  criteria: RubricCriterion[];
  confidence: number;
  low_confidence: boolean;
  sources: string[];
  citations: string[];
}

export interface QuestionResult {
  id: number;
  test_record_id: number;
  concept_node_id: number | null;
  question_type: "objective" | "subjective";
  question_text: string;
  options: string[] | null;
  correct_answer: string | null;
  ideal_answer: string | null;
  user_answer: string | null;
  score: number | null;
  max_score: number | null;
  rubric: QuestionRubric | null;
  feedback: string | null;
  hints_used: number;
  created_at: string;
}

export interface TestRecord {
  id: number;
  user_id: number | null;
  topic_id: number | null;
  session_id: number | null;
  grading_mode: "informal" | "formal";
  total_score: number | null;
  max_score: number | null;
  questions_count: number | null;
  created_at: string;
  completed_at: string | null;
  questions: QuestionResult[];
}

export interface TestHistoryItem {
  id: number;
  grading_mode: "informal" | "formal";
  total_score: number | null;
  max_score: number | null;
  questions_count: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface AnswerItem {
  question_id: number;
  answer: string;
}

export async function generateTest(
  topicId: number,
  numQuestions: number,
  gradingMode: "informal" | "formal",
  sessionId?: number
): Promise<TestRecord> {
  const { data } = await client.post<TestRecord>("/tests/generate", {
    topic_id: topicId,
    num_questions: numQuestions,
    grading_mode: gradingMode,
    session_id: sessionId ?? null,
  });
  return data;
}

export async function gradeTest(
  testId: number,
  answers: AnswerItem[]
): Promise<TestRecord> {
  const { data } = await client.post<TestRecord>(`/tests/${testId}/grade`, {
    answers,
  });
  return data;
}

export async function getTest(testId: number): Promise<TestRecord> {
  const { data } = await client.get<TestRecord>(`/tests/${testId}`);
  return data;
}

export async function getTestHistory(topicId: number): Promise<TestHistoryItem[]> {
  const { data } = await client.get<TestHistoryItem[]>(`/tests/history/${topicId}`);
  return data;
}
