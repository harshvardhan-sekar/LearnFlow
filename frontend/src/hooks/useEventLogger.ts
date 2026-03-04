import { useLogging } from "../contexts/LoggingContext";

/**
 * Convenience hook that wraps LoggingContext.
 * Usage: const { logEvent } = useEventLogger();
 */
export function useEventLogger() {
  return useLogging();
}
