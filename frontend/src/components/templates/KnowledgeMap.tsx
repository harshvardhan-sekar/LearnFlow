import { useState } from "react";
import NodeBubble from "../ui/NodeBubble";
import MasteryBar from "../ui/MasteryBar";

interface MapNode {
  key: string;
  name: string;
  mastery: number;
  x: number;
  y: number;
}

interface Edge {
  from: string;
  to: string;
}

export interface KnowledgeMapData {
  template: "knowledge_map";
  title: string;
  nodes: MapNode[];
  edges?: Edge[];
}

function masteryColor(mastery: number): string {
  if (mastery <= 0.33) return "#EF4444";
  if (mastery <= 0.66) return "#F59E0B";
  return "#10B981";
}

export default function KnowledgeMap({ data }: { data: KnowledgeMapData }) {
  const [selected, setSelected] = useState<string | null>(null);

  const nodeMap = new Map<string, MapNode>(data.nodes.map((n) => [n.key, n]));
  const selectedNode = selected ? nodeMap.get(selected) : null;

  // Compute canvas bounds with padding
  const PAD = 60;
  const minX = Math.min(...data.nodes.map((n) => n.x)) - PAD;
  const minY = Math.min(...data.nodes.map((n) => n.y)) - PAD;
  const maxX = Math.max(...data.nodes.map((n) => n.x)) + PAD;
  const maxY = Math.max(...data.nodes.map((n) => n.y)) + PAD;
  const viewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">🗺️</span>
          <h3 className="text-slate-100 font-semibold text-sm">{data.title}</h3>
        </div>
      </div>

      {/* Map */}
      <div className="p-3">
        <svg
          viewBox={viewBox}
          className="w-full"
          style={{ minHeight: 200, maxHeight: 400 }}
        >
          {/* Edges */}
          {(data.edges ?? []).map((edge, i) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return null;
            return (
              <line
                key={i}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#334155"
                strokeWidth={2}
                strokeDasharray="5 3"
              />
            );
          })}

          {/* Nodes */}
          {data.nodes.map((node) => (
            <NodeBubble
              key={node.key}
              name={node.name}
              mastery={node.mastery}
              x={node.x}
              y={node.y}
              selected={selected === node.key}
              onClick={() =>
                setSelected((prev) => (prev === node.key ? null : node.key))
              }
            />
          ))}
        </svg>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 px-1">
          {[
            { label: "Beginner", color: "#EF4444", range: "0–33%" },
            { label: "Developing", color: "#F59E0B", range: "34–66%" },
            { label: "Proficient", color: "#10B981", range: "67–100%" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: item.color }}
              />
              <span className="text-[10px] text-slate-500">
                {item.label} ({item.range})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected node details */}
      {selectedNode && (
        <div className="mx-3 mb-3 rounded-lg border border-slate-700/50 bg-slate-800/60 px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-200 truncate">
                {selectedNode.name}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono truncate">
                {selectedNode.key}
              </p>
            </div>
            <div
              className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{
                color: masteryColor(selectedNode.mastery),
                background: masteryColor(selectedNode.mastery) + "22",
              }}
            >
              {Math.round(selectedNode.mastery * 100)}%
            </div>
          </div>
          <div className="mt-2">
            <MasteryBar mastery={selectedNode.mastery} showLabel />
          </div>
        </div>
      )}
    </div>
  );
}
