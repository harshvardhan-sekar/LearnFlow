import { useState } from "react";
import type { LearnerGoal, ConceptMasteryItem } from "../../types";
import {
  createGoal,
  updateGoal,
  deleteGoal,
} from "../../api/dashboard";
import { useMastery } from "../../contexts/MasteryContext";

interface Props {
  concepts: ConceptMasteryItem[];
}

const PRIORITY_LABELS: Record<number, string> = {
  1: "Low",
  2: "Normal",
  3: "High",
  4: "Urgent",
  5: "Critical",
};

interface GoalFormState {
  concept_node_id: string;
  target_mastery: number;
  deadline: string;
  priority: number;
}

const EMPTY_FORM: GoalFormState = {
  concept_node_id: "",
  target_mastery: 0.8,
  deadline: "",
  priority: 2,
};

export default function GoalEditor({ concepts }: Props) {
  const { goals, setGoals, topicId } = useMastery();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<GoalFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(goal: LearnerGoal) {
    setEditingId(goal.id);
    setForm({
      concept_node_id: goal.concept_node_id ? String(goal.concept_node_id) : "",
      target_mastery: goal.target_mastery,
      deadline: goal.deadline ? goal.deadline.slice(0, 10) : "",
      priority: goal.priority,
    });
    setError(null);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleSave() {
    if (!topicId) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        concept_node_id: form.concept_node_id
          ? Number(form.concept_node_id)
          : undefined,
        target_mastery: form.target_mastery,
        deadline: form.deadline || undefined,
        priority: form.priority,
      };

      if (editingId !== null) {
        const updated = await updateGoal(editingId, body);
        setGoals(goals.map((g) => (g.id === editingId ? updated : g)));
      } else {
        const created = await createGoal(topicId, body);
        setGoals([...goals, created]);
      }
      cancelForm();
    } catch {
      setError("Failed to save goal. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleComplete(goal: LearnerGoal) {
    try {
      const updated = await updateGoal(goal.id, {
        is_completed: !goal.is_completed,
      });
      setGoals(goals.map((g) => (g.id === goal.id ? updated : g)));
    } catch {
      // silent fail — goal state wasn't changed
    }
  }

  async function handleDelete(goalId: number) {
    try {
      await deleteGoal(goalId);
      setGoals(goals.filter((g) => g.id !== goalId));
    } catch {
      // silent fail
    }
  }

  const active = goals.filter((g) => !g.is_completed);
  const completed = goals.filter((g) => g.is_completed);

  return (
    <div>
      {/* Goal list */}
      <div className="space-y-2 mb-4">
        {active.length === 0 && completed.length === 0 && (
          <div className="text-slate-500 text-sm py-4 text-center">
            No goals yet. Add your first learning goal below.
          </div>
        )}

        {active.map((goal) => (
          <GoalRow
            key={goal.id}
            goal={goal}
            onEdit={() => openEdit(goal)}
            onToggle={() => handleToggleComplete(goal)}
            onDelete={() => handleDelete(goal.id)}
          />
        ))}

        {completed.length > 0 && (
          <>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider pt-2 pb-1">
              Completed
            </div>
            {completed.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                onEdit={() => openEdit(goal)}
                onToggle={() => handleToggleComplete(goal)}
                onDelete={() => handleDelete(goal.id)}
              />
            ))}
          </>
        )}
      </div>

      {/* Add button */}
      {!showForm && (
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          <span className="text-lg leading-none">+</span> Add goal
        </button>
      )}

      {/* Inline form */}
      {showForm && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-slate-300">
            {editingId !== null ? "Edit goal" : "New goal"}
          </div>

          {/* Concept selector */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Concept (optional)
            </label>
            <select
              value={form.concept_node_id}
              onChange={(e) =>
                setForm({ ...form, concept_node_id: e.target.value })
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="">— No specific concept —</option>
              {concepts.map((c) => (
                <option key={c.concept_node_id} value={c.concept_node_id}>
                  {c.concept_name}
                </option>
              ))}
            </select>
          </div>

          {/* Target mastery */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Target mastery:{" "}
              <span className="text-white">
                {Math.round(form.target_mastery * 100)}%
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={form.target_mastery}
              onChange={(e) =>
                setForm({
                  ...form,
                  target_mastery: parseFloat(e.target.value),
                })
              }
              className="w-full accent-blue-500"
            />
          </div>

          {/* Deadline + Priority row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">
                Deadline
              </label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) =>
                  setForm({ ...form, deadline: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">
                Priority
              </label>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: Number(e.target.value) })
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                {[1, 2, 3, 4, 5].map((p) => (
                  <option key={p} value={p}>
                    {p} – {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={cancelForm}
              className="flex-1 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white text-sm font-medium transition-colors"
            >
              {saving ? "Saving…" : editingId !== null ? "Update" : "Add"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface GoalRowProps {
  goal: LearnerGoal;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

function GoalRow({ goal, onEdit, onToggle, onDelete }: GoalRowProps) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
        goal.is_completed
          ? "bg-slate-800/30 border-slate-700/30 opacity-60"
          : "bg-slate-800/60 border-slate-700/50"
      }`}
    >
      {/* Completion checkbox */}
      <button
        onClick={onToggle}
        className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
          goal.is_completed
            ? "bg-green-500 border-green-500"
            : "border-slate-500 hover:border-slate-400"
        }`}
      >
        {goal.is_completed && (
          <svg
            className="w-2.5 h-2.5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {goal.is_ai_suggested && (
            <span className="text-yellow-400 text-xs" title="AI-suggested">
              ✦
            </span>
          )}
          <span
            className={`text-sm font-medium ${
              goal.is_completed ? "line-through text-slate-500" : "text-white"
            }`}
          >
            {goal.concept_name ?? "General goal"}
          </span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityBadge(goal.priority)}`}
          >
            P{goal.priority}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
          <span>Target: {Math.round(goal.target_mastery * 100)}%</span>
          {goal.deadline && (
            <span>By {new Date(goal.deadline).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"
          title="Edit goal"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
          title="Delete goal"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function priorityBadge(priority: number): string {
  if (priority >= 4) return "bg-red-900/50 text-red-300";
  if (priority === 3) return "bg-orange-900/50 text-orange-300";
  return "bg-slate-700/50 text-slate-400";
}
