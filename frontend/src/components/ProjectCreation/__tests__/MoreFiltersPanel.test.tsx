import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignLibraryStore } from '@/stores/designLibraryStore';
import type { TemplateWithAvailability } from '@/stores/designLibraryStore';
import { useProjectCreationStore } from '@/stores/projectCreationStore';
import { TemplateStatus, AdaptationStrategy } from '@/types/database';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  })),
  supabase: { rpc: vi.fn() },
  isSupabaseConfigured: false,
}));

import { DesignLibrary } from '../DesignLibrary';

const makeTemplateWithAvailability = (overrides: Partial<TemplateWithAvailability> = {}): TemplateWithAvailability => ({
  template_id: 'tpl-1',
  name: 'Test Template',
  description: 'A test template',
  wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2700 },
  status: TemplateStatus.ACTIVE,
  adaptation_strategy: AdaptationStrategy.PROPORTIONAL,
  design_family_id: null,
  design_subfamily_id: null,
  wall_application: null,
  priority_zone_id: null,
  waste_factor: null,
  metadata: null,
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  availability: 'AVAILABLE',
  blockedReasons: [],
  designFamilyName: null,
  ...overrides,
});

describe('DesignLibrary - More Filters Panel', () => {
  beforeEach(() => {
    useProjectCreationStore.getState().reset();
    useDesignLibraryStore.getState().reset();
    // Override fetch functions to prevent real network calls
    useProjectCreationStore.setState({
      fetchAvailableTemplates: vi.fn() as unknown as () => Promise<void>,
    });
    // Provide at least one template so the full UI renders (not empty state)
    useDesignLibraryStore.setState({
      fetchTemplatesWithAvailability: vi.fn() as unknown as () => Promise<void>,
      templates: [makeTemplateWithAvailability()],
      filteredTemplates: [makeTemplateWithAvailability()],
      isLoading: false,
      error: null,
    });
  });

  it('renders More Filters toggle button', () => {
    render(<DesignLibrary />);
    expect(screen.getByTestId('more-filters-toggle')).toBeInTheDocument();
  });

  it('More Filters panel is hidden by default', () => {
    render(<DesignLibrary />);
    expect(screen.queryByTestId('more-filters-panel')).not.toBeInTheDocument();
  });

  it('clicking More Filters toggle reveals the panel', () => {
    render(<DesignLibrary />);
    fireEvent.click(screen.getByTestId('more-filters-toggle'));
    expect(screen.getByTestId('more-filters-panel')).toBeInTheDocument();
  });

  it('clicking More Filters toggle again hides the panel', () => {
    render(<DesignLibrary />);
    fireEvent.click(screen.getByTestId('more-filters-toggle'));
    expect(screen.getByTestId('more-filters-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('more-filters-toggle'));
    expect(screen.queryByTestId('more-filters-panel')).not.toBeInTheDocument();
  });

  it('toggle button has aria-expanded=false initially', () => {
    render(<DesignLibrary />);
    expect(screen.getByTestId('more-filters-toggle')).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggle button has aria-expanded=true when panel is open', () => {
    render(<DesignLibrary />);
    fireEvent.click(screen.getByTestId('more-filters-toggle'));
    expect(screen.getByTestId('more-filters-toggle')).toHaveAttribute('aria-expanded', 'true');
  });

  it('changing geometry select to STRAIGHT updates the store', () => {
    render(<DesignLibrary />);
    fireEvent.click(screen.getByTestId('more-filters-toggle'));

    const geometrySelect = screen.getByTestId('geometry-filter-select');
    fireEvent.change(geometrySelect, { target: { value: 'STRAIGHT' } });

    const state = useDesignLibraryStore.getState();
    expect(state.filters.wallGeometry).toBe('STRAIGHT');
  });

  it('changing geometry select to L_CORNER updates the store', () => {
    render(<DesignLibrary />);
    fireEvent.click(screen.getByTestId('more-filters-toggle'));

    const geometrySelect = screen.getByTestId('geometry-filter-select');
    fireEvent.change(geometrySelect, { target: { value: 'L_CORNER' } });

    const state = useDesignLibraryStore.getState();
    expect(state.filters.wallGeometry).toBe('L_CORNER');
  });

  it('changing geometry select to empty string sets store to null', () => {
    // First set a geometry filter
    useDesignLibraryStore.getState().setWallGeometryFilter('STRAIGHT');

    render(<DesignLibrary />);
    fireEvent.click(screen.getByTestId('more-filters-toggle'));

    const geometrySelect = screen.getByTestId('geometry-filter-select');
    fireEvent.change(geometrySelect, { target: { value: '' } });

    const state = useDesignLibraryStore.getState();
    expect(state.filters.wallGeometry).toBeNull();
  });

  it('changing availability select to AVAILABLE updates the store', () => {
    render(<DesignLibrary />);
    fireEvent.click(screen.getByTestId('more-filters-toggle'));

    const availabilitySelect = screen.getByTestId('availability-filter-select');
    fireEvent.change(availabilitySelect, { target: { value: 'AVAILABLE' } });

    const state = useDesignLibraryStore.getState();
    expect(state.filters.availability).toBe('AVAILABLE');
  });

  it('changing availability select to BLOCKED updates the store', () => {
    render(<DesignLibrary />);
    fireEvent.click(screen.getByTestId('more-filters-toggle'));

    const availabilitySelect = screen.getByTestId('availability-filter-select');
    fireEvent.change(availabilitySelect, { target: { value: 'BLOCKED' } });

    const state = useDesignLibraryStore.getState();
    expect(state.filters.availability).toBe('BLOCKED');
  });

  it('changing availability select to ALL updates the store', () => {
    // First set to AVAILABLE
    useDesignLibraryStore.getState().setAvailabilityFilter('AVAILABLE');

    render(<DesignLibrary />);
    fireEvent.click(screen.getByTestId('more-filters-toggle'));

    const availabilitySelect = screen.getByTestId('availability-filter-select');
    fireEvent.change(availabilitySelect, { target: { value: 'ALL' } });

    const state = useDesignLibraryStore.getState();
    expect(state.filters.availability).toBe('ALL');
  });

  it('geometry select reflects current store value', () => {
    useDesignLibraryStore.getState().setWallGeometryFilter('L_CORNER');

    render(<DesignLibrary />);
    fireEvent.click(screen.getByTestId('more-filters-toggle'));

    const geometrySelect = screen.getByTestId('geometry-filter-select') as HTMLSelectElement;
    expect(geometrySelect.value).toBe('L_CORNER');
  });

  it('availability select reflects current store value', () => {
    useDesignLibraryStore.getState().setAvailabilityFilter('BLOCKED');

    render(<DesignLibrary />);
    fireEvent.click(screen.getByTestId('more-filters-toggle'));

    const availabilitySelect = screen.getByTestId('availability-filter-select') as HTMLSelectElement;
    expect(availabilitySelect.value).toBe('BLOCKED');
  });
});
