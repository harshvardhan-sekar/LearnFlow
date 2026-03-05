import Markdown from "react-markdown";
import TemplateRouter from "../templates/TemplateRouter";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

// Split content into alternating [text, templateJSON, text, templateJSON, ...] segments
interface TextSegment {
  type: "text";
  value: string;
}
interface TemplateSegment {
  type: "template";
  value: Record<string, unknown>;
  raw: string;
}
type Segment = TextSegment | TemplateSegment;

const TEMPLATE_RE = /```template\s*([\s\S]*?)```/g;

function parseSegments(content: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(TEMPLATE_RE)) {
    const matchStart = match.index!;
    const matchEnd = matchStart + match[0].length;

    // Text before this template block
    if (matchStart > lastIndex) {
      const text = content.slice(lastIndex, matchStart).trim();
      if (text) segments.push({ type: "text", value: text });
    }

    // Parse the JSON inside the template fence
    try {
      const parsed = JSON.parse(match[1].trim());
      segments.push({ type: "template", value: parsed, raw: match[0] });
    } catch {
      // Malformed JSON — fall back to showing as plain text
      segments.push({ type: "text", value: match[0] });
    }

    lastIndex = matchEnd;
  }

  // Remaining text after all template blocks
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) segments.push({ type: "text", value: text });
  }

  // No template blocks found — return original as single text segment
  if (segments.length === 0) {
    segments.push({ type: "text", value: content });
  }

  return segments;
}

export default function ChatMessage({
  role,
  content,
  isStreaming,
}: ChatMessageProps) {
  const isUser = role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-3 px-4">
        <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed bg-blue-600 text-white">
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }

  // Assistant message: parse template blocks
  const segments = parseSegments(content);
  const hasTemplates = segments.some((s) => s.type === "template");

  return (
    <div className="flex justify-start mb-3 px-4">
      <div
        className={`rounded-2xl rounded-bl-md text-sm leading-relaxed bg-slate-700 text-slate-100 ${
          hasTemplates ? "w-full max-w-[92%] px-4 py-3" : "max-w-[85%] px-4 py-2.5"
        }`}
      >
        {segments.map((segment, i) => {
          if (segment.type === "template") {
            return (
              <div key={i} className="my-3">
                <TemplateRouter data={segment.value} />
              </div>
            );
          }

          // Text segment — render as markdown
          return segment.value ? (
            <div
              key={i}
              className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-600/50 prose-code:text-blue-300 prose-a:text-blue-400"
            >
              <Markdown>{segment.value}</Markdown>
            </div>
          ) : null;
        })}

        {isStreaming && (
          <span className="inline-block w-1.5 h-4 ml-0.5 bg-slate-300 animate-pulse rounded-sm align-text-bottom" />
        )}
      </div>
    </div>
  );
}
