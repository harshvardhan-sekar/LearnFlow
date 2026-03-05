import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSession } from "../../contexts/SessionContext";
import { useLogging } from "../../contexts/LoggingContext";
import { useToast } from "../../contexts/ToastContext";
import SubgoalItem from "./SubgoalItem";
import SubgoalGenerator from "./SubgoalGenerator";
import * as subgoalsApi from "../../api/subgoals";
import { getTopicMastery } from "../../api/mastery";
import type { MasteryStateItem } from "../../api/mastery";

export default function SubgoalPanel() {
  const { activeSession, currentTopic, subgoals, setSubgoals } = useSession();
  const { logEvent } = useLogging();
  const { showToast } = useToast();

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [masteryMap, setMasteryMap] = useState<Map<string, number>>(new Map());

  const sessionId = activeSession?.id;
  const topicId = currentTopic?.id;

  // Fetch mastery states for the current topic to show per-subgoal badges
  useEffect(() => {
    if (!topicId) {
      setMasteryMap(new Map());
      return;
    }
    let cancelled = false;
    getTopicMastery(Number(topicId))
      .then((states: MasteryStateItem[]) => {
        if (cancelled) return;
        const map = new Map<string, number>();
        for (const s of states) {
          map.set(s.concept_key, s.mastery_score);
        }
        setMasteryMap(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const completedCount = subgoals.filter((s) => s.is_completed).length;

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!topicId) return;
    try {
      const generated = await subgoalsApi.generateSubgoals(topicId, sessionId);
      setSubgoals([...subgoals, ...generated]);
      logEvent("subgoal_create", {
        action: "ai_generate",
        count: generated.length,
        topic_id: topicId,
      });
    } catch {
      showToast("Failed to generate subgoals. Please try again.");
    }
  }, [topicId, sessionId, subgoals, setSubgoals, logEvent, showToast]);

  const handleToggle = useCallback(
    async (id: string) => {
      try {
        const updated = await subgoalsApi.toggleSubgoal(id, sessionId);
        setSubgoals(
          subgoals.map((s) => (s.id === id ? updated : s))
        );
        logEvent(updated.is_completed ? "subgoal_check" : "subgoal_uncheck", {
          subgoal_id: id,
        });
      } catch {
        showToast("Failed to update subgoal.");
      }
    },
    [sessionId, subgoals, setSubgoals, logEvent, showToast]
  );

  const handleEdit = useCallback(
    async (id: string, title: string) => {
      try {
        const updated = await subgoalsApi.updateSubgoal(
          id,
          { title },
          sessionId
        );
        setSubgoals(subgoals.map((s) => (s.id === id ? updated : s)));
        logEvent("subgoal_edit", { subgoal_id: id, title });
      } catch {
        showToast("Failed to save subgoal edit.");
      }
    },
    [sessionId, subgoals, setSubgoals, logEvent, showToast]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await subgoalsApi.deleteSubgoal(id, sessionId);
        setSubgoals(subgoals.filter((s) => s.id !== id));
        logEvent("subgoal_edit", { action: "delete", subgoal_id: id });
      } catch {
        showToast("Failed to delete subgoal.");
      }
    },
    [sessionId, subgoals, setSubgoals, logEvent, showToast]
  );

  const handleAdd = useCallback(async () => {
    const trimmed = newTitle.trim();
    if (!trimmed || !topicId) return;
    try {
      const created = await subgoalsApi.createSubgoal(
        topicId,
        trimmed,
        sessionId
      );
      setSubgoals([...subgoals, created]);
      setNewTitle("");
      setAdding(false);
      logEvent("subgoal_create", { subgoal_id: created.id, title: trimmed });
    } catch {
      showToast("Failed to add subgoal.");
    }
  }, [newTitle, topicId, sessionId, subgoals, setSubgoals, logEvent, showToast]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = subgoals.findIndex((s) => s.id === active.id);
      const newIndex = subgoals.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      // Optimistic reorder
      const reordered = [...subgoals];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      setSubgoals(reordered);

      const orderedIds = reordered.map((s) => s.id);
      try {
        const updated = await subgoalsApi.reorderSubgoals(orderedIds, sessionId);
        setSubgoals(updated);
        logEvent("subgoal_reorder", {
          subgoal_id: active.id,
          from: oldIndex,
          to: newIndex,
        });
      } catch {
        setSubgoals(subgoals);
        showToast("Failed to reorder subgoals.");
      }
    },
    [subgoals, sessionId, setSubgoals, logEvent]
  );

  // ── Render ───────────────────────────────────────────────────────────

  if (!activeSession) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-slate-700/40">
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">
            Subgoal Manager
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-slate-500 text-sm text-center">
            Start a session to manage subgoals
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/40 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">
            Subgoals
          </h2>
          {subgoals.length > 0 && (
            <span className="text-xs text-slate-400">
              {completedCount}/{subgoals.length} completed
            </span>
          )}
        </div>

        {/* Progress bar */}
        {subgoals.length > 0 && (
          <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500/70 rounded-full transition-all duration-300"
              style={{
                width: `${(completedCount / subgoals.length) * 100}%`,
              }}
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <SubgoalGenerator
            hasExisting={subgoals.length > 0}
            onGenerate={handleGenerate}
          />
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slate-700/50 text-slate-300 border border-slate-600/40 hover:bg-slate-700/70 transition-colors"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 1v10M1 6h10" />
            </svg>
            Add Subgoal
          </button>
        </div>
      </div>

      {/* Sortable list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {/* Inline add form */}
        {adding && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/30 border border-blue-500/40">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewTitle("");
                }
              }}
              placeholder="New subgoal title…"
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
            />
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim()}
              className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-40"
            >
              Add
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setNewTitle("");
              }}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {subgoals.length === 0 && !adding ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-slate-500 text-sm">No subgoals yet</p>
            <p className="text-slate-600 text-xs mt-1">
              Generate AI subgoals or add your own
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={subgoals.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {subgoals.map((subgoal) => {
                const masteryPct =
                  subgoal.concept_node_key != null
                    ? masteryMap.get(subgoal.concept_node_key) ?? null
                    : null;
                return (
                  <SubgoalItem
                    key={subgoal.id}
                    subgoal={subgoal}
                    masteryPct={masteryPct}
                    onToggle={handleToggle}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
