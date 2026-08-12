import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockSignUp = vi.hoisted(() => vi.fn());

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: mockSignUp,
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
  isSupabaseConfigured: false,
}));

import { SignupPage } from '../SignupPage';

function renderSignupPage() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <SignupPage />
    </MemoryRouter>,
  );
}

describe('SignupPage', () => {
  beforeEach(() => {
    mockSignUp.mockReset();
  });

  it('renders the signup form', () => {
    renderSignupPage();
    expect(screen.getByTestId('signup-page')).toBeInTheDocument();
    expect(screen.getByTestId('signup-form')).toBeInTheDocument();
    expect(screen.getByTestId('signup-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('signup-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('signup-role-select')).toBeInTheDocument();
    expect(screen.getByTestId('signup-submit-btn')).toBeInTheDocument();
  });

  it('renders role selection with DESIGNER and CONSULTANT only (no ADMIN)', () => {
    renderSignupPage();
    const select = screen.getByTestId('signup-role-select');
    const options = select.querySelectorAll('option');
    const roleValues = Array.from(options).map((opt) => opt.getAttribute('value'));
    expect(roleValues).toContain('DESIGNER');
    expect(roleValues).toContain('CONSULTANT');
    expect(roleValues).not.toContain('ADMIN');
  });

  it('calls supabase.auth.signUp with correct metadata on form submission', async () => {
    mockSignUp.mockResolvedValue({ data: {}, error: null });

    renderSignupPage();

    fireEvent.change(screen.getByTestId('signup-email-input'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByTestId('signup-password-input'), {
      target: { value: 'securepass' },
    });
    fireEvent.change(screen.getByTestId('signup-role-select'), {
      target: { value: 'CONSULTANT' },
    });
    fireEvent.click(screen.getByTestId('signup-submit-btn'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'securepass',
        options: { data: { role: 'CONSULTANT' } },
      });
    });
  });

  it('displays error message on failed signup', async () => {
    mockSignUp.mockResolvedValue({ data: null, error: new Error('Email already in use') });

    renderSignupPage();

    fireEvent.change(screen.getByTestId('signup-email-input'), {
      target: { value: 'taken@example.com' },
    });
    fireEvent.change(screen.getByTestId('signup-password-input'), {
      target: { value: 'password' },
    });
    fireEvent.click(screen.getByTestId('signup-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('signup-error')).toBeInTheDocument();
      expect(screen.getByText('Email already in use')).toBeInTheDocument();
    });
  });

  it('shows success message after successful signup', async () => {
    mockSignUp.mockResolvedValue({ data: {}, error: null });

    renderSignupPage();

    fireEvent.change(screen.getByTestId('signup-email-input'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByTestId('signup-password-input'), {
      target: { value: 'securepass' },
    });
    fireEvent.click(screen.getByTestId('signup-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('signup-success')).toBeInTheDocument();
      expect(screen.getByText(/Check your email/)).toBeInTheDocument();
    });
  });

  it('has link back to login', () => {
    renderSignupPage();
    expect(screen.getByTestId('signup-login-link')).toBeInTheDocument();
  });
});
