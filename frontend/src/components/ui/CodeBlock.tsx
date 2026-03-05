interface CodeBlockProps {
  code: string;
  language?: string;
  highlight_lines?: number[]; // 1-indexed
}

// Simple tokenizer for SQL and common programming keywords
const SQL_KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "IS", "NULL",
  "CASE", "WHEN", "THEN", "ELSE", "END", "AS", "ON", "JOIN", "LEFT",
  "RIGHT", "INNER", "OUTER", "GROUP", "BY", "ORDER", "HAVING", "LIMIT",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CREATE",
  "TABLE", "INDEX", "DROP", "ALTER", "ADD", "COLUMN", "PRIMARY", "KEY",
  "WITH", "UNION", "ALL", "DISTINCT", "COUNT", "SUM", "AVG", "MAX", "MIN",
  "COALESCE", "NULLIF", "CAST", "CONVERT", "BETWEEN", "LIKE", "EXISTS",
]);

const JS_KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for",
  "while", "do", "switch", "case", "break", "continue", "class", "new",
  "this", "super", "import", "export", "default", "from", "typeof",
  "instanceof", "null", "undefined", "true", "false", "async", "await",
  "try", "catch", "finally", "throw", "of", "in", "type", "interface",
]);

const PY_KEYWORDS = new Set([
  "def", "class", "return", "if", "elif", "else", "for", "while",
  "import", "from", "as", "with", "try", "except", "finally", "raise",
  "pass", "break", "continue", "and", "or", "not", "in", "is",
  "True", "False", "None", "lambda", "yield", "global", "nonlocal",
]);

function getKeywords(language: string): Set<string> {
  const lang = language.toLowerCase();
  if (lang === "sql") return SQL_KEYWORDS;
  if (lang === "python" || lang === "py") return PY_KEYWORDS;
  return JS_KEYWORDS; // default for js/ts/jsx/tsx and unknown
}

interface Token {
  type: "keyword" | "string" | "comment" | "number" | "plain";
  value: string;
}

function tokenize(line: string, keywords: Set<string>): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // Single-line comment -- or //
    if (
      (line[i] === "-" && line[i + 1] === "-") ||
      (line[i] === "/" && line[i + 1] === "/") ||
      line[i] === "#"
    ) {
      tokens.push({ type: "comment", value: line.slice(i) });
      break;
    }

    // String literal ' or "
    if (line[i] === "'" || line[i] === '"') {
      const q = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== q) {
        if (line[j] === "\\") j++;
        j++;
      }
      tokens.push({ type: "string", value: line.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // Number
    if (/[0-9]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[0-9.]/.test(line[j])) j++;
      tokens.push({ type: "number", value: line.slice(i, j) });
      i = j;
      continue;
    }

    // Word (keyword or identifier)
    if (/[a-zA-Z_$]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j])) j++;
      const word = line.slice(i, j);
      tokens.push({
        type: keywords.has(word) || keywords.has(word.toUpperCase()) ? "keyword" : "plain",
        value: word,
      });
      i = j;
      continue;
    }

    // Plain character
    tokens.push({ type: "plain", value: line[i] });
    i++;
  }

  return tokens;
}

const tokenColors: Record<Token["type"], string> = {
  keyword: "text-violet-400 font-semibold",
  string: "text-amber-300",
  comment: "text-slate-500 italic",
  number: "text-cyan-400",
  plain: "text-slate-200",
};

export default function CodeBlock({
  code,
  language = "sql",
  highlight_lines = [],
}: CodeBlockProps) {
  const keywords = getKeywords(language);
  const lines = code.split("\n");
  const hlSet = new Set(highlight_lines);

  return (
    <div className="rounded-lg overflow-hidden border border-slate-700/60 text-xs font-mono">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700/60">
        <span className="text-slate-500 text-[10px] uppercase tracking-widest">
          {language}
        </span>
      </div>

      {/* Code body */}
      <div className="bg-slate-900/80 overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => {
              const lineNum = i + 1;
              const isHighlighted = hlSet.has(lineNum);
              const tokens = tokenize(line, keywords);

              return (
                <tr
                  key={i}
                  className={
                    isHighlighted
                      ? "bg-yellow-900/30 border-l-2 border-yellow-500"
                      : "hover:bg-slate-800/40"
                  }
                >
                  <td className="select-none pl-3 pr-4 py-0.5 text-right text-slate-600 w-8 border-r border-slate-700/40">
                    {lineNum}
                  </td>
                  <td className="pl-4 pr-3 py-0.5 whitespace-pre">
                    {tokens.map((tok, ti) => (
                      <span key={ti} className={tokenColors[tok.type]}>
                        {tok.value}
                      </span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
