import { useState, type FormEvent } from "react";

interface SearchInputProps {
  onSearch: (query: string) => void;
  disabled?: boolean;
}

export default function SearchInput({ onSearch, disabled }: SearchInputProps) {
  const [query, setQuery] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      onSearch(trimmed);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        {/* Magnifying glass icon */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the web..."
          disabled={disabled}
          className="w-full pl-10 pr-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 disabled:opacity-50 transition-colors"
        />
      </div>
      <button
        type="submit"
        disabled={disabled || !query.trim()}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 transition-colors"
      >
        Search
      </button>
    </form>
  );
}
