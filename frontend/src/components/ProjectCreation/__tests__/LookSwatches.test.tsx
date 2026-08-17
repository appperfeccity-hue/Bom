import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { DesignFamilyMaster } from '@/types/database';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  })),
  supabase: { rpc: vi.fn() },
  isSupabaseConfigured: false,
}));

import { LookSwatches } from '../LookSwatches';

const makeDesignFamily = (overrides: Partial<DesignFamilyMaster> = {}): DesignFamilyMaster => ({
  design_family_id: 'df-1',
  name: 'Modern',
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('LookSwatches', () => {
  let onDesignFamilySelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onDesignFamilySelect = vi.fn();
  });

  it('renders nothing when designFamilies is empty', () => {
    const { container } = render(
      <LookSwatches designFamilies={[]} activeDesignFamilyId={null} onDesignFamilySelect={onDesignFamilySelect} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the section title', () => {
    const families = [makeDesignFamily()];
    render(
      <LookSwatches designFamilies={families} activeDesignFamilyId={null} onDesignFamilySelect={onDesignFamilySelect} />
    );
    expect(screen.getByText('Explore all looks')).toBeDefined();
  });

  it('renders swatch for each design family', () => {
    const families = [
      makeDesignFamily({ design_family_id: 'df-1', name: 'Modern' }),
      makeDesignFamily({ design_family_id: 'df-2', name: 'Marble' }),
      makeDesignFamily({ design_family_id: 'df-3', name: 'Wooden' }),
    ];
    render(
      <LookSwatches designFamilies={families} activeDesignFamilyId={null} onDesignFamilySelect={onDesignFamilySelect} />
    );
    expect(screen.getByText('Modern')).toBeDefined();
    expect(screen.getByText('Marble')).toBeDefined();
    expect(screen.getByText('Wooden')).toBeDefined();
  });

  it('calls onDesignFamilySelect with family id on click', () => {
    const families = [makeDesignFamily({ design_family_id: 'df-1', name: 'Modern' })];
    render(
      <LookSwatches designFamilies={families} activeDesignFamilyId={null} onDesignFamilySelect={onDesignFamilySelect} />
    );
    fireEvent.click(screen.getByText('Modern'));
    expect(onDesignFamilySelect).toHaveBeenCalledWith('df-1');
  });

  it('calls onDesignFamilySelect with null when clicking active family (toggle off)', () => {
    const families = [makeDesignFamily({ design_family_id: 'df-1', name: 'Modern' })];
    render(
      <LookSwatches designFamilies={families} activeDesignFamilyId="df-1" onDesignFamilySelect={onDesignFamilySelect} />
    );
    fireEvent.click(screen.getByText('Modern'));
    expect(onDesignFamilySelect).toHaveBeenCalledWith(null);
  });

  it('marks active family with aria-pressed=true', () => {
    const families = [
      makeDesignFamily({ design_family_id: 'df-1', name: 'Modern' }),
      makeDesignFamily({ design_family_id: 'df-2', name: 'Marble' }),
    ];
    render(
      <LookSwatches designFamilies={families} activeDesignFamilyId="df-1" onDesignFamilySelect={onDesignFamilySelect} />
    );
    const modern = screen.getByLabelText('Filter by Modern');
    const marble = screen.getByLabelText('Filter by Marble');
    expect(modern.getAttribute('aria-pressed')).toBe('true');
    expect(marble.getAttribute('aria-pressed')).toBe('false');
  });

  it('supports keyboard activation with Enter key', () => {
    const families = [makeDesignFamily({ design_family_id: 'df-1', name: 'Classic' })];
    render(
      <LookSwatches designFamilies={families} activeDesignFamilyId={null} onDesignFamilySelect={onDesignFamilySelect} />
    );
    const swatch = screen.getByLabelText('Filter by Classic');
    fireEvent.keyDown(swatch, { key: 'Enter' });
    expect(onDesignFamilySelect).toHaveBeenCalledWith('df-1');
  });

  it('supports keyboard activation with Space key', () => {
    const families = [makeDesignFamily({ design_family_id: 'df-1', name: 'Classic' })];
    render(
      <LookSwatches designFamilies={families} activeDesignFamilyId={null} onDesignFamilySelect={onDesignFamilySelect} />
    );
    const swatch = screen.getByLabelText('Filter by Classic');
    fireEvent.keyDown(swatch, { key: ' ' });
    expect(onDesignFamilySelect).toHaveBeenCalledWith('df-1');
  });

  it('has data-testid="look-swatches" on root', () => {
    const families = [makeDesignFamily()];
    render(
      <LookSwatches designFamilies={families} activeDesignFamilyId={null} onDesignFamilySelect={onDesignFamilySelect} />
    );
    expect(screen.getByTestId('look-swatches')).toBeDefined();
  });
});
