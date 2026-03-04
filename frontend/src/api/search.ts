import client from "./client";
import type { SearchResult } from "../types";

interface SearchResponse {
  search_event_id: string;
  results: SearchResult[];
  query: string;
}

export async function search(
  query: string,
  sessionId: string
): Promise<SearchResponse> {
  const { data } = await client.post<SearchResponse>("/search", {
    query,
    session_id: sessionId,
  });
  return data;
}

export async function logSearchClick(
  searchEventId: string,
  url: string,
  title: string,
  position: number
): Promise<void> {
  await client.post("/search/click", {
    search_event_id: searchEventId,
    url,
    title,
    position,
  });
}
