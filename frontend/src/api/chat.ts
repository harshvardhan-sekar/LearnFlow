import client from "./client";
import { getIdToken } from "../utils/firebase";
import type { ChatMessage } from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export interface SendMessageParams {
  message: string;
  session_id: string;
  topic_id: string;
}

/**
 * Opens an SSE stream to POST /api/chat.
 * Returns the raw Response so the caller (useSSE) can consume the ReadableStream.
 */
export async function sendMessage(
  params: SendMessageParams
): Promise<Response> {
  const token = await getIdToken();
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status}`);
  }

  return response;
}

export async function getChatHistory(
  sessionId: string
): Promise<ChatMessage[]> {
  const { data } = await client.get<ChatMessage[]>(
    `/chat/history/${sessionId}`
  );
  return data;
}
