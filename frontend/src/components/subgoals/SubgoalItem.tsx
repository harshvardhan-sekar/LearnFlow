import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Subgoal } from "../../types";

interface SubgoalItemProps {
  subgoal: Subgoal;
  masteryPct: number | null;
  onToggle: (id: string) => void;
  onEdit: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

function masteryBadgeStyle(pct: number): string {
  if (pct >= 70) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (pct >= 40) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

export default function SubgoalItem({
  subgoal,
  masteryPct,
  onToggle,
  onEdit,
  onDelete,
}: SubgoalItemProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(subgoal.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subgoal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commitEdit() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== subgoal.title) {
      onEdit(subgoal.id, trimmed);
    } else {
      setEditValue(subgoal.title);
    }
    setEditing(false);
  }

  const masteryDisplayPct = masteryPct != null ? Math.round(masteryPct * 100) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
        isDragging
          ? "bg-slate-600/50 border-blue-500/50 shadow-lg z-10"
          : "bg-slate-700/30 border-slate-700/40 hover:bg-slate-700/50"
      } ${subgoal.is_completed ? "opacity-60" : ""}`}
    >
      {/* Drag handle */}
      <button
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 transition-colors"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </button>

      {/* Checkbox */}
      <button
        onClick={() => onToggle(subgoal.id)}
        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          subgoal.is_completed
            ? "bg-green-500/30 border-green-500 text-green-400"
            : "border-slate-500 hover:border-blue-400"
        }`}
        aria-label={
          subgoal.is_completed ? "Mark incomplete" : "Mark complete"
        }
      >
        {subgoal.is_completed && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Title */}
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") {
              setEditValue(subgoal.title);
              setEditing(false);
            }
          }}
          className="flex-1 min-w-0 bg-slate-600/50 text-slate-100 text-sm px-2 py-0.5 rounded border border-blue-500/50 outline-none"
        />
      ) : (
        <span
          onDoubleClick={() => {
            setEditValue(subgoal.title);
            setEditing(true);
          }}
          className={`flex-1 min-w-0 text-sm truncate cursor-default ${
            subgoal.is_completed
              ? "line-through text-slate-500"
              : "text-slate-200"
          }`}
          title={subgoal.title}
        >
          {subgoal.title}
        </span>
      )}

      {/* Mastery badge */}
      {masteryDisplayPct != null ? (
        <span
          className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded border font-medium ${masteryBadgeStyle(masteryDisplayPct)}`}
          title={`Mastery: ${masteryDisplayPct}%`}
        >
          {masteryDisplayPct}%
        </span>
      ) : (
        <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-600 border border-slate-700/40">
          —
        </span>
      )}

      {/* Delete button (visible on hover) */}
      <button
        onClick={() => onDelete(subgoal.id)}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
        aria-label="Delete subgoal"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M11 4v7.5a1 1 0 01-1 1H4a1 1 0 01-1-1V4M6 6.5v3.5M8 6.5v3.5" />
        </svg>
      </button>
    </div>
  );
}
