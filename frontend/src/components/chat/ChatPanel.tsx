import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "../../contexts/SessionContext";
import { useEventLogger } from "../../hooks/useEventLogger";
import { sendMessage, getChatHistory } from "../../api/chat";
import { useSSE } from "../../hooks/useSSE";
import type { ChatMessage as ChatMessageType } from "../../types";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";

export default function ChatPanel() {
  const { activeSession, currentTopic } = useSession();
  const { logEvent } = useEventLogger();
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sse = useSSE();

  // Load chat history when session changes
  useEffect(() => {
    if (!activeSession) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoadingHistory(true);

    getChatHistory(activeSession.id)
      .then((history) => {
        if (!cancelled) setMessages(history);
      })
      .catch(() => {
        // History load failed — start fresh
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSession?.id]);

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sse.content]);

  // When streaming finishes, commit the streamed message to the message list
  const prevStreamingRef = useRef(false);
  useEffect(() => {
    if (prevStreamingRef.current && !sse.isStreaming && sse.content) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          session_id: activeSession?.id ?? "",
          role: "assistant",
          content: sse.content,
          created_at: new Date().toISOString(),
        },
      ]);
      logEvent("chat_message", {
        role: "assistant",
        content_length: sse.content.length,
      });
      sse.reset();
    }
    prevStreamingRef.current = sse.isStreaming;
  }, [sse.isStreaming, sse.content, activeSession?.id, sse.reset, logEvent]);

  const handleSend = useCallback(
    async (message: string) => {
      if (!activeSession || !currentTopic) return;

      // Add user message immediately
      const userMsg: ChatMessageType = {
        id: `user-${Date.now()}`,
        session_id: activeSession.id,
        role: "user",
        content: message,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      logEvent("chat_message", { role: "user", content_length: message.length });

      try {
        const response = await sendMessage({
          message,
          session_id: activeSession.id,
          topic_id: currentTopic.id,
        });
        await sse.start(response);
      } catch {
        // Add error message to chat
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            session_id: activeSession.id,
            role: "assistant",
            content: "Sorry, something went wrong. Please try again.",
            created_at: new Date().toISOString(),
          },
        ]);
      }
    },
    [activeSession, currentTopic, sse, logEvent]
  );

  const noSession = !activeSession;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-slate-700/50 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-300">Chat</span>
        <span className="text-xs text-slate-500">GPT-4o</span>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-4">
        {noSession && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-500">
              Start a session to chat
            </p>
          </div>
        )}

        {loadingHistory && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!noSession && !loadingHistory && messages.length === 0 && !sse.isStreaming && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-6">
              <p className="text-slate-400 text-sm">
                Ask a question about{" "}
                <span className="text-blue-400 font-medium">
                  {currentTopic?.title ?? "your topic"}
                </span>
              </p>
              <p className="text-slate-500 text-xs mt-1">
                The AI will guide your learning with questions and hints
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            citations={msg.citations}
          />
        ))}

        {/* Streaming assistant message */}
        {sse.isStreaming && sse.content && (
          <ChatMessage role="assistant" content={sse.content} isStreaming />
        )}

        {/* Streaming indicator when waiting for first token */}
        {sse.isStreaming && !sse.content && (
          <div className="flex justify-start mb-3 px-4">
            <div className="bg-slate-700 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {sse.error && (
          <div className="px-4 mb-3">
            <p className="text-sm text-red-400 text-center">{sse.error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={noSession || sse.isStreaming}
      />
    </div>
  );
}
