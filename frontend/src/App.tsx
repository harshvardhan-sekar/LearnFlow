import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SessionProvider } from "./contexts/SessionContext";
import { LoggingProvider } from "./contexts/LoggingContext";
import LoginPage from "./components/auth/LoginPage";
import RegisterPage from "./components/auth/RegisterPage";
import SessionShell from "./components/session/SessionShell";
import type { ReactNode } from "react";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/learn" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/learn" replace /> : <RegisterPage />}
      />
      <Route
        path="/learn"
        element={
          <ProtectedRoute>
            <SessionProvider>
              <LoggingProvider>
                <SessionShell />
              </LoggingProvider>
            </SessionProvider>
          </ProtectedRoute>
        }
      />
      {/* V2 placeholders */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400">
              Dashboard — coming in V2
            </div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/test"
        element={
          <ProtectedRoute>
            <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400">
              Test page — coming in V2
            </div>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/learn" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
