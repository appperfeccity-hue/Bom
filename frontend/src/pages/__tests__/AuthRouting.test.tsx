import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { AuthLayout } from '@/components/AuthLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginPage } from '../LoginPage';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(),
    },
  },
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
  isSupabaseConfigured: false,
}));

function renderWithRouter(initialRoute: string) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<div data-testid="main-app">Main App</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Auth Routing', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('unauthenticated user accessing / is redirected to /login', () => {
    renderWithRouter('/');
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('main-app')).not.toBeInTheDocument();
  });

  it('authenticated user can access /', () => {
    useAuthStore.setState({
      user: { id: 'user-1', app_metadata: { role: 'DESIGNER' } } as never,
      role: 'DESIGNER',
      isAuthenticated: true,
      isLoading: false,
    });

    renderWithRouter('/');
    expect(screen.getByTestId('main-app')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('authenticated user accessing /login is redirected to /', () => {
    useAuthStore.setState({
      user: { id: 'user-1', app_metadata: { role: 'DESIGNER' } } as never,
      role: 'DESIGNER',
      isAuthenticated: true,
      isLoading: false,
    });

    renderWithRouter('/login');
    expect(screen.getByTestId('main-app')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('shows loading state when isLoading is true on protected route', () => {
    useAuthStore.setState({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: true,
    });

    renderWithRouter('/');
    expect(screen.getByTestId('protected-route-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('main-app')).not.toBeInTheDocument();
  });

  it('shows loading state when isLoading is true on auth layout', () => {
    useAuthStore.setState({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: true,
    });

    renderWithRouter('/login');
    expect(screen.getByTestId('auth-layout-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('role is available after authentication', () => {
    useAuthStore.setState({
      user: { id: 'user-1', app_metadata: { role: 'CONSULTANT' } } as never,
      role: 'CONSULTANT',
      isAuthenticated: true,
      isLoading: false,
    });

    renderWithRouter('/');
    expect(useAuthStore.getState().role).toBe('CONSULTANT');
    expect(screen.getByTestId('main-app')).toBeInTheDocument();
  });
});
