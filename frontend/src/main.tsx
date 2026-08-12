import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { AuthLayout } from '@/components/AuthLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginPage, SignupPage, ForgotPasswordPage, DashboardPage } from '@/pages';
import { useAuthStore } from '@/stores/authStore';

/**
 * Subscribes to Supabase auth state changes on mount.
 * Placed above route guards so the subscription fires regardless
 * of whether the user is on a protected or public route.
 */
function AuthSubscription({ children }: { children: React.ReactNode }) {
  const subscribeToAuthChanges = useAuthStore((s) => s.subscribeToAuthChanges);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges();
    return unsubscribe;
  }, [subscribeToAuthChanges]);

  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthSubscription>
        <Routes>
          {/* Auth routes - redirect to / if already authenticated */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          {/* Protected routes - redirect to /login if not authenticated */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/canvas" element={<App />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthSubscription>
    </BrowserRouter>
  </React.StrictMode>,
);
