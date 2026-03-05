import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getTestHistory } from "../../api/tests";
import type { TestHistoryItem } from "../../api/tests";

type Range = "7d" | "30d" | "all";

interface ChartPoint {
  date: string;
  score: number;
}

function filterByRange(
  items: TestHistoryItem[],
  range: Range
): TestHistoryItem[] {
  if (range === "all") return items;
  const cutoff =
    Date.now() - (range === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000;
  return items.filter(
    (item) => new Date(item.created_at).getTime() >= cutoff
  );
}

interface ProgressChartProps {
  topicId: number;
  overallPct: number;
  masteredCount: number;
  totalCount: number;
}

export default function ProgressChart({
  topicId,
  overallPct,
  masteredCount,
  totalCount,
}: ProgressChartProps) {
  const [history, setHistory] = useState<TestHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("30d");

  useEffect(() => {
    setLoading(true);
    getTestHistory(topicId)
      .then((data) => setHistory([...data].reverse())) // oldest-first for chart
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [topicId]);

  const filtered = filterByRange(history, range);

  const chartData: ChartPoint[] = filtered
    .filter((h) => h.completed_at && h.max_score && h.max_score > 0)
    .map((h) => ({
      date: new Date(h.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      score: Math.round(((h.total_score ?? 0) / (h.max_score ?? 1)) * 100),
    }));

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold text-white">
          {Math.round(overallPct)}%
        </span>
        <span className="text-slate-400 text-sm pb-1">
          overall &mdash; {masteredCount}/{totalCount} mastered
        </span>
      </div>

      {/* Time range selector */}
      <div className="flex gap-1">
        {(["7d", "30d", "all"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              range === r
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-700"
            }`}
          >
            {r === "all" ? "All time" : r}
          </button>
        ))}
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-36 flex items-center justify-center text-slate-500 text-sm">
          Loading…
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-36 flex items-center justify-center text-slate-500 text-sm">
          No completed tests in this period.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={144}>
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#94a3b8" }}
              itemStyle={{ color: "#818cf8" }}
              formatter={(value: number) => [`${value}%`, "Test score"]}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#818cf8"
              strokeWidth={2}
              dot={{ fill: "#818cf8", r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              name="Score"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
