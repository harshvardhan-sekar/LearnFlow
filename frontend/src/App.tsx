import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SessionProvider } from "./contexts/SessionContext";
import { LoggingProvider } from "./contexts/LoggingContext";
import { ToastProvider } from "./contexts/ToastContext";
import LoginPage from "./components/auth/LoginPage";
import RegisterPage from "./components/auth/RegisterPage";
import SessionShell from "./components/session/SessionShell";
import AdminDashboard from "./components/admin/AdminDashboard";
import TestPage from "./components/testing/TestPage";
import DashboardPage from "./components/dashboard/DashboardPage";
import AppShell from "./components/layout/AppShell";
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

function AdminRoute({ children }: { children: ReactNode }) {
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

  if (user.role !== "researcher" && user.role !== "admin") {
    return <Navigate to="/learn" replace />;
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

      {/* All user routes share SessionProvider + AppShell sidebar */}
      <Route
        path="/learn"
        element={
          <ProtectedRoute>
            <SessionProvider>
              <AppShell>
                <LoggingProvider>
                  <SessionShell />
                </LoggingProvider>
              </AppShell>
            </SessionProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/test"
        element={
          <ProtectedRoute>
            <SessionProvider>
              <AppShell>
                <TestPage />
              </AppShell>
            </SessionProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <SessionProvider>
              <AppShell>
                <DashboardPage />
              </AppShell>
            </SessionProvider>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
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
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
