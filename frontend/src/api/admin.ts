import client from "./client";
import type {
  AdminParticipant,
  AdminSession,
  AdminEvent,
  AdminMetrics,
} from "../types";

export interface SessionFilters {
  user_id?: number;
  topic_id?: number;
  status?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

export interface EventFilters {
  event_type?: string;
  user_id?: number;
  session_id?: number;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

export async function getParticipants(): Promise<AdminParticipant[]> {
  const { data } = await client.get<AdminParticipant[]>(
    "/admin/participants"
  );
  return data;
}

export async function getSessions(
  filters: SessionFilters = {}
): Promise<AdminSession[]> {
  const { data } = await client.get<AdminSession[]>("/admin/sessions", {
    params: filters,
  });
  return data;
}

export async function getEvents(
  filters: EventFilters = {}
): Promise<AdminEvent[]> {
  const { data } = await client.get<AdminEvent[]>("/admin/events", {
    params: filters,
  });
  return data;
}

export async function getMetrics(): Promise<AdminMetrics> {
  const { data } = await client.get<AdminMetrics>("/admin/metrics");
  return data;
}

export async function downloadCsvExport(filters: {
  user_id?: number;
  from_date?: string;
  to_date?: string;
} = {}): Promise<void> {
  const { data } = await client.get("/admin/export/csv", {
    params: filters,
    responseType: "blob",
  });
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "learnflow_export.zip";
  a.click();
  URL.revokeObjectURL(url);
}
