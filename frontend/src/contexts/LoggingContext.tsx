import {
  createContext,
  useContext,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import client from "../api/client";
import { useSession } from "./SessionContext";

interface LoggingContextValue {
  logEvent: (eventType: string, data?: Record<string, unknown>) => void;
}

const LoggingContext = createContext<LoggingContextValue | null>(null);

const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_THRESHOLD = 20;

interface QueuedEvent {
  event_type: string;
  event_data: Record<string, unknown> | null;
  session_id: number;
  created_at: string;
}

export function LoggingProvider({ children }: { children: ReactNode }) {
  const { activeSession } = useSession();
  const queueRef = useRef<QueuedEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flush = useCallback(async () => {
    if (queueRef.current.length === 0) return;
    const batch = queueRef.current.splice(0);
    try {
      await client.post("/logs/events", { events: batch });
    } catch {
      // Re-queue on failure so events aren't lost
      queueRef.current.unshift(...batch);
    }
  }, []);

  // Flush on interval
  useEffect(() => {
    timerRef.current = setInterval(flush, FLUSH_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      // Flush remaining on unmount
      flush();
    };
  }, [flush]);

  const logEvent = useCallback(
    (eventType: string, data?: Record<string, unknown>) => {
      if (!activeSession) return;
      queueRef.current.push({
        event_type: eventType,
        event_data: data ?? null,
        session_id: Number(activeSession.id),
        created_at: new Date().toISOString(),
      });
      if (queueRef.current.length >= FLUSH_THRESHOLD) {
        flush();
      }
    },
    [activeSession, flush]
  );

  return (
    <LoggingContext.Provider value={{ logEvent }}>
      {children}
    </LoggingContext.Provider>
  );
}

export function useLogging(): LoggingContextValue {
  const ctx = useContext(LoggingContext);
  if (!ctx)
    throw new Error("useLogging must be used within LoggingProvider");
  return ctx;
}
