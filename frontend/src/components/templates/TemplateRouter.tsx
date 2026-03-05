import SolutionWalkthrough, {
  type SolutionWalkthroughData,
} from "./SolutionWalkthrough";
import ConceptComparison, {
  type ConceptComparisonData,
} from "./ConceptComparison";
import KnowledgeMap, { type KnowledgeMapData } from "./KnowledgeMap";

type TemplateData =
  | SolutionWalkthroughData
  | ConceptComparisonData
  | KnowledgeMapData;

interface TemplateRouterProps {
  data: TemplateData | Record<string, unknown>;
}

export default function TemplateRouter({ data }: TemplateRouterProps) {
  const template = (data as { template?: string }).template;

  if (template === "solution_walkthrough") {
    return <SolutionWalkthrough data={data as SolutionWalkthroughData} />;
  }

  if (template === "concept_comparison") {
    return <ConceptComparison data={data as ConceptComparisonData} />;
  }

  if (template === "knowledge_map") {
    return <KnowledgeMap data={data as KnowledgeMapData} />;
  }

  // Unknown template — render raw JSON as fallback
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3 text-xs font-mono text-slate-400">
      <p className="text-slate-500 mb-1">Unknown template: {String(template)}</p>
      <pre className="whitespace-pre-wrap break-all">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
