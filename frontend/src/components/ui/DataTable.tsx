import { useState } from "react";

interface DataTableProps {
  headers: string[];
  rows: (string | number | null)[][];
  highlight_rows?: number[];
  highlight_color?: "blue" | "green" | "yellow" | "red" | "purple";
}

const highlightClasses: Record<NonNullable<DataTableProps["highlight_color"]>, string> = {
  blue: "bg-blue-900/40 text-blue-200",
  green: "bg-green-900/40 text-green-200",
  yellow: "bg-yellow-900/30 text-yellow-200",
  red: "bg-red-900/40 text-red-200",
  purple: "bg-purple-900/40 text-purple-200",
};

export default function DataTable({
  headers,
  rows,
  highlight_rows = [],
  highlight_color = "blue",
}: DataTableProps) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (colIndex: number) => {
    if (sortCol === colIndex) {
      setSortAsc((prev) => !prev);
    } else {
      setSortCol(colIndex);
      setSortAsc(true);
    }
  };

  const sortedRows = sortCol === null
    ? rows
    : [...rows].sort((a, b) => {
        const av = a[sortCol];
        const bv = b[sortCol];
        if (av === null && bv === null) return 0;
        if (av === null) return sortAsc ? -1 : 1;
        if (bv === null) return sortAsc ? 1 : -1;
        return sortAsc
          ? String(av).localeCompare(String(bv), undefined, { numeric: true })
          : String(bv).localeCompare(String(av), undefined, { numeric: true });
      });

  const highlightSet = new Set(highlight_rows);
  const hlClass = highlightClasses[highlight_color];

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700/60">
      <table className="w-full text-sm font-mono">
        <thead>
          <tr className="bg-slate-800/80">
            {headers.map((h, i) => (
              <th
                key={i}
                onClick={() => handleSort(i)}
                className="px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 select-none"
              >
                {h}
                {sortCol === i && (
                  <span className="ml-1">{sortAsc ? "↑" : "↓"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, ri) => {
            // When sorted, we lose original index tracking — only highlight when not sorted
            const isHighlighted = sortCol === null && highlightSet.has(ri);
            return (
              <tr
                key={ri}
                className={
                  isHighlighted
                    ? hlClass
                    : "bg-slate-900/40 hover:bg-slate-800/40"
                }
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="px-3 py-2 text-slate-300 border-t border-slate-700/40"
                  >
                    {cell === null ? (
                      <span className="text-slate-500 italic">NULL</span>
                    ) : (
                      String(cell)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
