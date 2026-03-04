import Markdown from "react-markdown";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

function detectTemplateBlocks(text: string): boolean {
  return /```template[\s\S]*?```/.test(text);
}

export default function ChatMessage({
  role,
  content,
  isStreaming,
}: ChatMessageProps) {
  const isUser = role === "user";
  const hasTemplate = !isUser && detectTemplateBlocks(content);

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3 px-4`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-br-md"
            : "bg-slate-700 text-slate-100 rounded-bl-md"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-600/50 prose-code:text-blue-300 prose-a:text-blue-400">
            <Markdown>{content}</Markdown>
          </div>
        )}

        {hasTemplate && (
          <span className="inline-block mt-2 px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
            Visual template
          </span>
        )}

        {isStreaming && (
          <span className="inline-block w-1.5 h-4 ml-0.5 bg-slate-300 animate-pulse rounded-sm align-text-bottom" />
        )}
      </div>
    </div>
  );
}
