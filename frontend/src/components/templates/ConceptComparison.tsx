interface Property {
  label: string;
  value: string;
  highlight?: boolean;
}

interface Concept {
  name: string;
  key?: string;
  definition: string;
  properties: Property[];
  key_insight?: string;
}

export interface ConceptComparisonData {
  template: "concept_comparison";
  title: string;
  concepts: Concept[];
}

// Assign a distinct accent per card position
const ACCENTS = [
  { border: "border-blue-500/50", heading: "text-blue-300", insight: "bg-blue-900/30 border-blue-700/40 text-blue-200", hl: "text-blue-300 font-semibold" },
  { border: "border-violet-500/50", heading: "text-violet-300", insight: "bg-violet-900/30 border-violet-700/40 text-violet-200", hl: "text-violet-300 font-semibold" },
  { border: "border-emerald-500/50", heading: "text-emerald-300", insight: "bg-emerald-900/30 border-emerald-700/40 text-emerald-200", hl: "text-emerald-300 font-semibold" },
  { border: "border-amber-500/50", heading: "text-amber-300", insight: "bg-amber-900/30 border-amber-700/40 text-amber-200", hl: "text-amber-300 font-semibold" },
];

function ConceptCard({
  concept,
  accent,
}: {
  concept: Concept;
  accent: (typeof ACCENTS)[number];
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border ${accent.border} bg-slate-800/60 p-4 gap-3 min-w-0`}
    >
      {/* Name + definition */}
      <div>
        <h4 className={`font-semibold text-sm ${accent.heading}`}>
          {concept.name}
        </h4>
        <p className="mt-1 text-xs text-slate-400 leading-relaxed">
          {concept.definition}
        </p>
      </div>

      {/* Properties table */}
      {concept.properties.length > 0 && (
        <div className="rounded-lg overflow-hidden border border-slate-700/50">
          <table className="w-full text-xs">
            <tbody>
              {concept.properties.map((prop, i) => (
                <tr
                  key={i}
                  className={i % 2 === 0 ? "bg-slate-900/40" : "bg-slate-800/40"}
                >
                  <td className="px-2.5 py-1.5 text-slate-500 font-medium whitespace-nowrap border-r border-slate-700/40 w-2/5">
                    {prop.label}
                  </td>
                  <td
                    className={`px-2.5 py-1.5 ${prop.highlight ? accent.hl : "text-slate-300"}`}
                  >
                    {prop.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Key insight callout */}
      {concept.key_insight && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${accent.insight}`}
        >
          <span className="font-semibold">Key insight: </span>
          {concept.key_insight}
        </div>
      )}
    </div>
  );
}

export default function ConceptComparison({
  data,
}: {
  data: ConceptComparisonData;
}) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">⚖️</span>
          <h3 className="text-slate-100 font-semibold text-sm">{data.title}</h3>
        </div>
      </div>

      {/* Cards */}
      <div
        className="p-4 grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${Math.min(data.concepts.length, 2)}, minmax(0, 1fr))`,
        }}
      >
        {data.concepts.map((concept, i) => (
          <ConceptCard
            key={concept.key ?? i}
            concept={concept}
            accent={ACCENTS[i % ACCENTS.length]}
          />
        ))}
      </div>
    </div>
  );
}
