import client from "./client";

export interface Recommendation {
  concept_key: string;
  concept_name: string;
  mastery: number;
  focus_weight: number;
}

export interface MasteryStateItem {
  id: number;
  concept_node_id: number;
  concept_key: string;
  concept_name: string;
  mastery_score: number;
  attempts_count: number;
  correct_count: number;
  last_tested_at: string | null;
  updated_at: string;
}

export async function getRecommendations(
  topicId: number
): Promise<Recommendation[]> {
  const { data } = await client.get<Recommendation[]>(
    `/mastery/${topicId}/recommendations`
  );
  return data;
}

export async function getTopicMastery(
  topicId: number
): Promise<MasteryStateItem[]> {
  const { data } = await client.get<MasteryStateItem[]>(`/mastery/${topicId}`);
  return data;
}
