import { useState } from "react";
import { search, logSearchClick } from "../../api/search";
import { useSession } from "../../contexts/SessionContext";
import type { SearchResult } from "../../types";
import SearchInput from "./SearchInput";
import SearchResultItem from "./SearchResult";

export default function SearchPanel() {
  const { activeSession } = useSession();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchEventId, setSearchEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSearch(query: string) {
    if (!activeSession) return;

    setLoading(true);
    setError(null);
    try {
      const data = await search(query, activeSession.id);
      setResults(data.results);
      setSearchEventId(data.search_event_id);
      setHasSearched(true);
    } catch {
      setError("Search failed. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleClickResult(url: string, title: string, position: number) {
    if (searchEventId) {
      logSearchClick(searchEventId, url, title, position);
    }
  }

  const noSession = !activeSession;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/40">
        <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-3">
          Web Search
        </h2>
        <SearchInput onSearch={handleSearch} disabled={loading || noSession} />
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-y-auto">
        {noSession && (
          <div className="p-4 text-sm text-slate-500 text-center mt-8">
            Start a session to search
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-4 text-sm text-red-400 text-center">{error}</div>
        )}

        {!loading && !error && hasSearched && results.length === 0 && (
          <div className="p-4 text-sm text-slate-500 text-center mt-8">
            No results found
          </div>
        )}

        {!loading &&
          results.map((result, i) => (
            <SearchResultItem
              key={`${result.link}-${i}`}
              result={result}
              position={i}
              onClickResult={handleClickResult}
            />
          ))}
      </div>
    </div>
  );
}
