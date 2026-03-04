import client from "./client";
import type { SearchResult } from "../types";

interface BackendSearchResponse {
  results: Array<{
    title: string;
    link: string;
    snippet: string;
    position: number;
  }>;
  search_event_id: number;
  results_count: number;
  response_time_ms: number;
}

interface SearchResponse {
  search_event_id: string;
  results: SearchResult[];
}

export async function search(
  query: string,
  sessionId: string
): Promise<SearchResponse> {
  const { data } = await client.post<BackendSearchResponse>("/search", {
    query,
    session_id: Number(sessionId),
  });
  return {
    search_event_id: String(data.search_event_id),
    results: data.results.map((r) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet,
      position: r.position,
    })),
  };
}

export async function logSearchClick(
  searchEventId: string,
  url: string,
  title: string,
  position: number
): Promise<void> {
  await client.post("/search/click", {
    search_event_id: Number(searchEventId),
    url,
    title,
    position,
  });
}
