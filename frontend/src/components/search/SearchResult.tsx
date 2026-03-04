import type { SearchResult as SearchResultType } from "../../types";

interface SearchResultProps {
  result: SearchResultType;
  position: number;
  onClickResult: (url: string, title: string, position: number) => void;
}

export default function SearchResultItem({
  result,
  position,
  onClickResult,
}: SearchResultProps) {
  function handleClick() {
    onClickResult(result.link, result.title, position);
    window.open(result.link, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="px-4 py-3 hover:bg-slate-700/30 transition-colors">
      <button
        onClick={handleClick}
        className="text-left w-full group"
      >
        <p className="text-xs text-slate-400 truncate mb-0.5">
          {(() => {
            try {
              return new URL(result.link).hostname;
            } catch {
              return result.link;
            }
          })()}
        </p>
        <h3 className="text-sm font-medium text-blue-400 group-hover:text-blue-300 group-hover:underline leading-snug">
          {result.title}
        </h3>
      </button>
      <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
        {result.snippet}
      </p>
    </div>
  );
}
