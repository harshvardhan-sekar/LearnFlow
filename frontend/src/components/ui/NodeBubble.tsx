import { useState } from "react";

interface NodeBubbleProps {
  name: string;
  mastery: number; // 0.0 – 1.0
  x: number;
  y: number;
  selected?: boolean;
  onClick?: () => void;
}

function masteryFill(mastery: number): string {
  if (mastery <= 0.33) return "#EF4444";
  if (mastery <= 0.66) return "#F59E0B";
  return "#10B981";
}

function masteryStroke(mastery: number): string {
  if (mastery <= 0.33) return "#B91C1C";
  if (mastery <= 0.66) return "#B45309";
  return "#047857";
}

export default function NodeBubble({
  name,
  mastery,
  x,
  y,
  selected = false,
  onClick,
}: NodeBubbleProps) {
  const [hovered, setHovered] = useState(false);
  const fill = masteryFill(mastery);
  const stroke = masteryStroke(mastery);
  const radius = 28;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <circle
        r={radius}
        fill={fill}
        stroke={selected ? "#fff" : stroke}
        strokeWidth={selected ? 3 : 1.5}
        opacity={0.9}
      />
      {/* Mastery % text inside bubble */}
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize="10"
        fontWeight="600"
        pointerEvents="none"
      >
        {Math.round(mastery * 100)}%
      </text>

      {/* Tooltip on hover */}
      {hovered && (
        <g>
          <rect
            x={-60}
            y={radius + 6}
            width={120}
            height={28}
            rx={6}
            fill="#1e293b"
            stroke="#334155"
            strokeWidth={1}
          />
          <text
            x={0}
            y={radius + 24}
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize="11"
            pointerEvents="none"
          >
            {name.length > 16 ? name.slice(0, 14) + "…" : name}
          </text>
        </g>
      )}
    </g>
  );
}
