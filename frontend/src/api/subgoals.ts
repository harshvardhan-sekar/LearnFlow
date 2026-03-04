import client from "./client";
import type { Subgoal } from "../types";

/** Shape returned by the backend SubgoalResponse model. */
interface BackendSubgoal {
  id: number;
  topic_id: number;
  user_id: number | null;
  title: string;
  description: string | null;
  sort_order: number;
  is_completed: boolean;
  is_ai_generated: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Map backend response to frontend Subgoal type. */
function toSubgoal(raw: BackendSubgoal): Subgoal {
  return {
    id: String(raw.id),
    topic_id: String(raw.topic_id),
    title: raw.title,
    description: raw.description ?? "",
    order_index: raw.sort_order,
    is_completed: raw.is_completed,
    source: raw.is_ai_generated ? "ai_generated" : "user_created",
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export async function fetchSubgoals(topicId: string): Promise<Subgoal[]> {
  const { data } = await client.get<BackendSubgoal[]>(
    `/subgoals/${topicId}`
  );
  return data.map(toSubgoal);
}

export async function createSubgoal(
  topicId: string,
  title: string,
  sessionId?: string
): Promise<Subgoal> {
  const params = sessionId ? `?session_id=${sessionId}` : "";
  const { data } = await client.post<BackendSubgoal>(
    `/subgoals${params}`,
    { topic_id: Number(topicId), title }
  );
  return toSubgoal(data);
}

export async function generateSubgoals(
  topicId: string,
  sessionId?: string
): Promise<Subgoal[]> {
  const { data } = await client.post<BackendSubgoal[]>(
    "/subgoals/generate",
    {
      topic_id: Number(topicId),
      session_id: sessionId ? Number(sessionId) : null,
    }
  );
  return data.map(toSubgoal);
}

export async function updateSubgoal(
  subgoalId: string,
  updates: { title?: string; description?: string },
  sessionId?: string
): Promise<Subgoal> {
  const params = sessionId ? `?session_id=${sessionId}` : "";
  const { data } = await client.put<BackendSubgoal>(
    `/subgoals/${subgoalId}${params}`,
    updates
  );
  return toSubgoal(data);
}

export async function toggleSubgoal(
  subgoalId: string,
  sessionId?: string
): Promise<Subgoal> {
  const params = sessionId ? `?session_id=${sessionId}` : "";
  const { data } = await client.put<BackendSubgoal>(
    `/subgoals/${subgoalId}/toggle${params}`
  );
  return toSubgoal(data);
}

export async function reorderSubgoals(
  subgoalIds: string[],
  sessionId?: string
): Promise<Subgoal[]> {
  const params = sessionId ? `?session_id=${sessionId}` : "";
  const { data } = await client.put<BackendSubgoal[]>(
    `/subgoals/reorder${params}`,
    { subgoal_ids: subgoalIds.map(Number) }
  );
  return data.map(toSubgoal);
}

export async function deleteSubgoal(
  subgoalId: string,
  sessionId?: string
): Promise<void> {
  const params = sessionId ? `?session_id=${sessionId}` : "";
  await client.delete(`/subgoals/${subgoalId}${params}`);
}
