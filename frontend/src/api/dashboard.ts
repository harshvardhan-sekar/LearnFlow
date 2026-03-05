import client from "./client";
import type { DashboardData, LearnerGoal } from "../types";

export interface CreateGoalBody {
  concept_node_id?: number;
  target_mastery?: number;
  deadline?: string;
  priority?: number;
}

export interface UpdateGoalBody {
  concept_node_id?: number;
  target_mastery?: number;
  deadline?: string | null;
  priority?: number;
  is_completed?: boolean;
}

export async function getDashboard(topicId: number): Promise<DashboardData> {
  const { data } = await client.get<DashboardData>(`/dashboard/${topicId}`);
  return data;
}

export async function saveDashboard(
  topicId: number,
  study_plan: Record<string, unknown> | null
): Promise<DashboardData> {
  const { data } = await client.put<DashboardData>(`/dashboard/${topicId}`, {
    study_plan,
  });
  return data;
}

export async function listGoals(topicId: number): Promise<LearnerGoal[]> {
  const { data } = await client.get<LearnerGoal[]>(
    `/dashboard/${topicId}/goals`
  );
  return data;
}

export async function createGoal(
  topicId: number,
  body: CreateGoalBody
): Promise<LearnerGoal> {
  const { data } = await client.post<LearnerGoal>(
    `/dashboard/${topicId}/goals`,
    body
  );
  return data;
}

export async function updateGoal(
  goalId: number,
  body: UpdateGoalBody
): Promise<LearnerGoal> {
  const { data } = await client.put<LearnerGoal>(
    `/dashboard/goals/${goalId}`,
    body
  );
  return data;
}

export async function deleteGoal(goalId: number): Promise<void> {
  await client.delete(`/dashboard/goals/${goalId}`);
}

export async function overrideMastery(
  conceptNodeId: number,
  newMastery: number
): Promise<void> {
  await client.put("/mastery/override", {
    concept_node_id: conceptNodeId,
    new_mastery: newMastery,
  });
}
