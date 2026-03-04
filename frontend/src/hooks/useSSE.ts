import { useState, useCallback, useRef } from "react";

interface UseSSEReturn {
  content: string;
  isStreaming: boolean;
  error: string | null;
  start: (response: Response) => Promise<void>;
  reset: () => void;
}

/**
 * Custom hook for consuming SSE streams from a fetch Response.
 * Handles connection, content accumulation, done signal, and errors.
 */
export function useSSE(): UseSSEReturn {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setContent("");
    setIsStreaming(false);
    setError(null);
  }, []);

  const start = useCallback(async (response: Response) => {
    setIsStreaming(true);
    setContent("");
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body = response.body;
      if (!body) {
        throw new Error("Response body is null");
      }

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        if (controller.signal.aborted) break;

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last (possibly incomplete) line in the buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            setIsStreaming(false);
            return;
          }

          try {
            const parsed = JSON.parse(data) as {
              content?: string;
              done?: boolean;
              error?: string;
            };

            if (parsed.error) {
              setError(parsed.error);
              setIsStreaming(false);
              return;
            }

            if (parsed.done) {
              setIsStreaming(false);
              return;
            }

            if (parsed.content) {
              setContent((prev) => prev + parsed.content);
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Stream failed");
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, []);

  return { content, isStreaming, error, start, reset };
}
