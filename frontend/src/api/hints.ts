import { getIdToken } from "../utils/firebase";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export interface HintRequest {
  question_id: number;
  concept_key: string;
  level: number;
}

/**
 * Opens an SSE stream to POST /api/hints.
 * Returns the raw Response so the caller can consume the ReadableStream.
 */
export async function requestHint(params: HintRequest): Promise<Response> {
  const token = await getIdToken();
  const response = await fetch(`${API_BASE}/hints`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Hint request failed: ${response.status}`);
  }

  return response;
}
