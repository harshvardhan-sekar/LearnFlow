import { useState } from "react";

interface ReflectionModalProps {
  onSubmit: (data: { content: string; confidence: number; difficulty: number }) => void;
  loading?: boolean;
}

const CONFIDENCE_LABELS = ["Very Low", "Low", "Moderate", "High", "Very High"];
const DIFFICULTY_LABELS = ["Very Easy", "Easy", "Moderate", "Hard", "Very Hard"];

function SliderField({
  label,
  value,
  labels,
  onChange,
}: {
  label: string;
  value: number;
  labels: string[];
  onChange: (val: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        <span className="text-sm text-blue-400 font-medium">
          {value} &mdash; {labels[value - 1]}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-700 accent-blue-500"
      />
      <div className="flex justify-between text-xs text-slate-500 px-0.5">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

export default function ReflectionModal({ onSubmit, loading = false }: ReflectionModalProps) {
  const [content, setContent] = useState("");
  const [confidence, setConfidence] = useState(3);
  const [difficulty, setDifficulty] = useState(3);

  function handleSubmit() {
    if (!content.trim()) return;
    onSubmit({ content: content.trim(), confidence, difficulty });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-xl font-bold text-white">Session Reflection</h2>
          <p className="text-sm text-slate-400 mt-1">
            Take a moment to reflect on what you learned today.
          </p>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="reflection-content"
              className="block text-sm font-medium text-slate-300"
            >
              What did you learn today?
            </label>
            <textarea
              id="reflection-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Describe what you learned, what was surprising, or what you want to explore further..."
              className="w-full px-3 py-2.5 rounded-lg bg-slate-700/50 border border-slate-600/50 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
            />
          </div>

          <SliderField
            label="How confident are you in what you learned?"
            value={confidence}
            labels={CONFIDENCE_LABELS}
            onChange={setConfidence}
          />

          <SliderField
            label="How difficult was today's session?"
            value={difficulty}
            labels={DIFFICULTY_LABELS}
            onChange={setDifficulty}
          />
        </div>

        <div className="px-6 py-4 border-t border-slate-700/50 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || loading}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </span>
            ) : "Submit Reflection"}
          </button>
        </div>
      </div>
    </div>
  );
}
