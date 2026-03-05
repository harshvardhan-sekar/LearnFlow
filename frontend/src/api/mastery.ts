import client from "./client";

export interface Recommendation {
  concept_key: string;
  concept_name: string;
  mastery: number;
  focus_weight: number;
}

export async function getRecommendations(
  topicId: number
): Promise<Recommendation[]> {
  const { data } = await client.get<Recommendation[]>(
    `/mastery/${topicId}/recommendations`
  );
  return data;
}
