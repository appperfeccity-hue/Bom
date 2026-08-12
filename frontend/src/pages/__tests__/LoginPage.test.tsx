import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

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

import { LoginPage } from '../LoginPage';

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('renders the login form', () => {
    renderLoginPage();
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
    expect(screen.getByTestId('login-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-submit-btn')).toBeInTheDocument();
  });

  it('renders navigation links to signup and forgot-password', () => {
    renderLoginPage();
    expect(screen.getByTestId('login-signup-link')).toBeInTheDocument();
    expect(screen.getByTestId('login-forgot-password-link')).toBeInTheDocument();
  });

  it('calls signIn with email and password on form submission', async () => {
    const mockSignIn = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ signIn: mockSignIn });

    renderLoginPage();

    fireEvent.change(screen.getByTestId('login-email-input'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByTestId('login-password-input'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByTestId('login-submit-btn'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('displays error message on failed login', async () => {
    const mockSignIn = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
    useAuthStore.setState({ signIn: mockSignIn });

    renderLoginPage();

    fireEvent.change(screen.getByTestId('login-email-input'), {
      target: { value: 'bad@example.com' },
    });
    fireEvent.change(screen.getByTestId('login-password-input'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByTestId('login-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('login-error')).toBeInTheDocument();
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('shows loading state during submission', async () => {
    const mockSignIn = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );
    useAuthStore.setState({ signIn: mockSignIn });

    renderLoginPage();

    fireEvent.change(screen.getByTestId('login-email-input'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByTestId('login-password-input'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByTestId('login-submit-btn'));

    expect(screen.getByText('Signing in...')).toBeInTheDocument();
    expect(screen.getByTestId('login-submit-btn')).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText('Sign In')).toBeInTheDocument();
    });
  });
});
