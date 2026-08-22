import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

import { FilterChipBar } from '../FilterChipBar';

describe('FilterChipBar', () => {
  const defaultProps = {
    activeCategory: null as string | null,
    activeDesignFamilyName: null as string | null,
    activeGeometry: null as string | null,
    activeAvailability: 'ALL' as 'ALL' | 'AVAILABLE' | 'BLOCKED',
    searchTerm: '',
    onClearCategory: vi.fn(),
    onClearDesignFamily: vi.fn(),
    onClearGeometry: vi.fn(),
    onClearAvailability: vi.fn(),
    onClearSearch: vi.fn(),
    onClearAll: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no filters are active', () => {
    const { container } = render(<FilterChipBar {...defaultProps} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a chip for active category', () => {
    render(<FilterChipBar {...defaultProps} activeCategory="Living Room" />);
    expect(screen.getByTestId('filter-chip-category')).toBeDefined();
    expect(screen.getByText('Living Room')).toBeDefined();
  });

  it('renders a chip for active design family', () => {
    render(<FilterChipBar {...defaultProps} activeDesignFamilyName="Modern" />);
    expect(screen.getByTestId('filter-chip-family')).toBeDefined();
    expect(screen.getByText('Modern')).toBeDefined();
  });

  it('renders a chip for active geometry', () => {
    render(<FilterChipBar {...defaultProps} activeGeometry="L_CORNER" />);
    expect(screen.getByTestId('filter-chip-geometry')).toBeDefined();
    expect(screen.getByText('L_CORNER')).toBeDefined();
  });

  it('renders a chip for active availability (not ALL)', () => {
    render(<FilterChipBar {...defaultProps} activeAvailability="AVAILABLE" />);
    expect(screen.getByTestId('filter-chip-availability')).toBeDefined();
    expect(screen.getByText('AVAILABLE')).toBeDefined();
  });

  it('does not render availability chip when set to ALL', () => {
    render(<FilterChipBar {...defaultProps} activeAvailability="ALL" />);
    expect(screen.queryByTestId('filter-chip-availability')).toBeNull();
  });

  it('renders a chip for search term', () => {
    render(<FilterChipBar {...defaultProps} searchTerm="marble" />);
    expect(screen.getByTestId('filter-chip-search')).toBeDefined();
  });

  it('does not render search chip when search term is whitespace', () => {
    render(<FilterChipBar {...defaultProps} searchTerm="   " />);
    expect(screen.queryByTestId('filter-chip-search')).toBeNull();
  });

  it('calls onClearCategory when category chip remove is clicked', () => {
    const onClearCategory = vi.fn();
    render(<FilterChipBar {...defaultProps} activeCategory="TV Wall" onClearCategory={onClearCategory} />);
    const removeBtn = screen.getByLabelText('Clear category filter');
    fireEvent.click(removeBtn);
    expect(onClearCategory).toHaveBeenCalledTimes(1);
  });

  it('calls onClearDesignFamily when family chip remove is clicked', () => {
    const onClearDesignFamily = vi.fn();
    render(<FilterChipBar {...defaultProps} activeDesignFamilyName="Marble" onClearDesignFamily={onClearDesignFamily} />);
    const removeBtn = screen.getByLabelText('Clear design family filter');
    fireEvent.click(removeBtn);
    expect(onClearDesignFamily).toHaveBeenCalledTimes(1);
  });

  it('calls onClearGeometry when geometry chip remove is clicked', () => {
    const onClearGeometry = vi.fn();
    render(<FilterChipBar {...defaultProps} activeGeometry="STRAIGHT" onClearGeometry={onClearGeometry} />);
    const removeBtn = screen.getByLabelText('Clear geometry filter');
    fireEvent.click(removeBtn);
    expect(onClearGeometry).toHaveBeenCalledTimes(1);
  });

  it('calls onClearAvailability when availability chip remove is clicked', () => {
    const onClearAvailability = vi.fn();
    render(<FilterChipBar {...defaultProps} activeAvailability="BLOCKED" onClearAvailability={onClearAvailability} />);
    const removeBtn = screen.getByLabelText('Clear availability filter');
    fireEvent.click(removeBtn);
    expect(onClearAvailability).toHaveBeenCalledTimes(1);
  });

  it('calls onClearSearch when search chip remove is clicked', () => {
    const onClearSearch = vi.fn();
    render(<FilterChipBar {...defaultProps} searchTerm="test" onClearSearch={onClearSearch} />);
    const removeBtn = screen.getByLabelText('Clear search filter');
    fireEvent.click(removeBtn);
    expect(onClearSearch).toHaveBeenCalledTimes(1);
  });

  it('shows "Clear all" button when more than one filter is active', () => {
    render(
      <FilterChipBar
        {...defaultProps}
        activeCategory="Living Room"
        activeDesignFamilyName="Modern"
      />
    );
    expect(screen.getByTestId('filter-clear-all')).toBeDefined();
    expect(screen.getByText('Clear all')).toBeDefined();
  });

  it('does not show "Clear all" when only one filter is active', () => {
    render(<FilterChipBar {...defaultProps} activeCategory="Living Room" />);
    expect(screen.queryByTestId('filter-clear-all')).toBeNull();
  });

  it('calls onClearAll when "Clear all" is clicked', () => {
    const onClearAll = vi.fn();
    render(
      <FilterChipBar
        {...defaultProps}
        activeCategory="Living Room"
        activeGeometry="STRAIGHT"
        onClearAll={onClearAll}
      />
    );
    fireEvent.click(screen.getByTestId('filter-clear-all'));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('has data-testid="filter-chip-bar" on root', () => {
    render(<FilterChipBar {...defaultProps} activeCategory="Test" />);
    expect(screen.getByTestId('filter-chip-bar')).toBeDefined();
  });
});
