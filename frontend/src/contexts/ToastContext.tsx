import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface Toast {
  id: number;
  message: string;
  type: "error" | "success" | "info";
}

interface ToastContextValue {
  showToast: (message: string, type?: Toast["type"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, type: Toast["type"] = "error") => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
          {toasts.map((toast) => {
            const bgClass =
              toast.type === "error"
                ? "bg-red-900/90 border-red-500/50 text-red-200"
                : toast.type === "success"
                  ? "bg-green-900/90 border-green-500/50 text-green-200"
                  : "bg-blue-900/90 border-blue-500/50 text-blue-200";
            return (
              <div
                key={toast.id}
                className={`px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg text-sm animate-slide-in ${bgClass}`}
              >
                <div className="flex items-start gap-2">
                  <span className="flex-1">{toast.message}</span>
                  <button
                    onClick={() => dismiss(toast.id)}
                    className="text-current opacity-60 hover:opacity-100 transition-opacity"
                  >
                    &times;
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
