import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasMode } from '@/types/database';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(),
    },
  },
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
  isSupabaseConfigured: false,
}));

import { Navigation } from '../Navigation';

describe('Navigation', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      role: null,
      isAuthenticated: true,
      isLoading: false,
    });
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
    });
  });

  it('renders the navigation header', () => {
    render(<MemoryRouter><Navigation /></MemoryRouter>);
    expect(screen.getByTestId('navigation')).toBeInTheDocument();
    expect(screen.getByText('Perfeccity Canvas')).toBeInTheDocument();
  });

  it('renders mode toggle buttons (Designer and Consultant)', () => {
    render(<MemoryRouter><Navigation /></MemoryRouter>);
    expect(screen.getByTestId('mode-designer-btn')).toBeInTheDocument();
    expect(screen.getByTestId('mode-consultant-btn')).toBeInTheDocument();
  });

  it('renders BOM button', () => {
    render(<MemoryRouter><Navigation /></MemoryRouter>);
    expect(screen.getByTestId('bom-open-btn')).toBeInTheDocument();
  });

  it('renders logout button', () => {
    render(<MemoryRouter><Navigation /></MemoryRouter>);
    expect(screen.getByTestId('logout-btn')).toBeInTheDocument();
  });

  it('calls signOut when logout button is clicked', async () => {
    const mockSignOut = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ signOut: mockSignOut });

    render(<MemoryRouter><Navigation /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('logout-btn'));

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('shows "My Templates" button only for DESIGNER role', () => {
    useAuthStore.setState({ role: 'DESIGNER' });

    render(<MemoryRouter><Navigation /></MemoryRouter>);
    expect(screen.getByTestId('my-templates-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('new-project-btn')).not.toBeInTheDocument();
  });

  it('shows "New Project" button only for CONSULTANT role', () => {
    useAuthStore.setState({ role: 'CONSULTANT' });

    render(<MemoryRouter><Navigation /></MemoryRouter>);
    expect(screen.getByTestId('new-project-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('my-templates-btn')).not.toBeInTheDocument();
  });

  it('does not show role-gated buttons when role is null', () => {
    useAuthStore.setState({ role: null });

    render(<MemoryRouter><Navigation /></MemoryRouter>);
    expect(screen.queryByTestId('my-templates-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('new-project-btn')).not.toBeInTheDocument();
  });

  it('does not show role-gated buttons for ADMIN role', () => {
    useAuthStore.setState({ role: 'ADMIN' });

    render(<MemoryRouter><Navigation /></MemoryRouter>);
    expect(screen.queryByTestId('my-templates-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('new-project-btn')).not.toBeInTheDocument();
  });

  it('switches to Consultant mode when Consultant button is clicked', () => {
    render(<MemoryRouter><Navigation /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('mode-consultant-btn'));

    expect(useCanvasStore.getState().mode).toBe(CanvasMode.CONSULTANT);
  });

  it('switches to Designer mode when Designer button is clicked', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });

    render(<MemoryRouter><Navigation /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('mode-designer-btn'));

    expect(useCanvasStore.getState().mode).toBe(CanvasMode.DESIGNER);
  });
});
