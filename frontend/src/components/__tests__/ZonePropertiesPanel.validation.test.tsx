import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode, TemplateStatus, AdaptationStrategy } from '@/types/database';
import type { Template, TemplateZone } from '@/types/database';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    }),
  },
  fromTable: () => ({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }), order: () => Promise.resolve({ data: [], error: null }) }) }),
    insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    upsert: () => Promise.resolve({ error: null }),
  }),
}));

import { ZonePropertiesPanel } from '@/components/ZonePropertiesPanel';

const mockTemplate: Template = {
  template_id: 'tmpl-1',
  name: 'Test Template',
  description: null,
  wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2400 },
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
};

function makeZone(overrides: Partial<TemplateZone> & { zone_id: string }): TemplateZone {
  return {
    template_id: 'tmpl-1',
    x_mm: 0,
    y_mm: 0,
    width_mm: 400,
    height_mm: 400,
    width_strategy: 'FIXED' as never,
    height_strategy: 'FIXED' as never,
    position_strategy: 'FIXED' as never,
    segment: null,
    created_at: '',
    ...overrides,
  };
}

describe('ZonePropertiesPanel - validation errors', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      viewport: { zoom: 1.0, panX: 0, panY: 0 },
      selection: { selectedZoneId: null, selectedZoneIds: [], resizeHandle: null, marqueeRect: null },
    });
    useProjectStore.setState({
      currentTemplate: mockTemplate,
      zones: [],
      zoneSku: new Map(),
    });
  });

  it('does not show validation errors for valid zones', () => {
    const zone = makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0, width_mm: 400, height_mm: 400 });
    useProjectStore.setState({ zones: [zone] });
    useCanvasStore.setState({ selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1'], resizeHandle: null, marqueeRect: null } });

    render(<ZonePropertiesPanel />);
    expect(screen.queryByTestId('zone-validation-errors')).not.toBeInTheDocument();
  });

  it('shows error messages when selected zone has overlap', () => {
    const zones = [
      makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0, width_mm: 400, height_mm: 400 }),
      makeZone({ zone_id: 'z2', x_mm: 200, y_mm: 200, width_mm: 400, height_mm: 400 }),
    ];
    useProjectStore.setState({ zones });
    useCanvasStore.setState({ selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1'], resizeHandle: null, marqueeRect: null } });

    render(<ZonePropertiesPanel />);
    const errorsContainer = screen.getByTestId('zone-validation-errors');
    expect(errorsContainer).toBeInTheDocument();
    expect(errorsContainer).toHaveTextContent('Zone overlaps with another zone');
  });

  it('shows error messages when selected zone is out of bounds', () => {
    const zone = makeZone({ zone_id: 'z1', x_mm: 2800, y_mm: 0, width_mm: 400, height_mm: 400 });
    useProjectStore.setState({ zones: [zone] });
    useCanvasStore.setState({ selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1'], resizeHandle: null, marqueeRect: null } });

    render(<ZonePropertiesPanel />);
    const errorsContainer = screen.getByTestId('zone-validation-errors');
    expect(errorsContainer).toBeInTheDocument();
    expect(errorsContainer).toHaveTextContent('Zone extends beyond wall boundary');
  });

  it('shows error messages when selected zone is undersized', () => {
    const zone = makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0, width_mm: 100, height_mm: 100 });
    useProjectStore.setState({ zones: [zone] });
    useCanvasStore.setState({ selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1'], resizeHandle: null, marqueeRect: null } });

    render(<ZonePropertiesPanel />);
    const errorsContainer = screen.getByTestId('zone-validation-errors');
    expect(errorsContainer).toBeInTheDocument();
    expect(errorsContainer).toHaveTextContent('Zone dimensions are below the minimum (200x200mm)');
  });

  it('shows multiple error messages when zone has multiple issues', () => {
    // Zone is both undersized and out of bounds
    const zone = makeZone({ zone_id: 'z1', x_mm: 2900, y_mm: 2300, width_mm: 150, height_mm: 150 });
    useProjectStore.setState({ zones: [zone] });
    useCanvasStore.setState({ selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1'], resizeHandle: null, marqueeRect: null } });

    render(<ZonePropertiesPanel />);
    const errorsContainer = screen.getByTestId('zone-validation-errors');
    expect(errorsContainer).toBeInTheDocument();
    expect(errorsContainer).toHaveTextContent('Zone extends beyond wall boundary');
    expect(errorsContainer).toHaveTextContent('Zone dimensions are below the minimum (200x200mm)');
  });

  it('renders nothing when no zone is selected', () => {
    useProjectStore.setState({ zones: [makeZone({ zone_id: 'z1' })] });
    useCanvasStore.setState({ selection: { selectedZoneId: null, selectedZoneIds: [], resizeHandle: null, marqueeRect: null } });

    const { container } = render(<ZonePropertiesPanel />);
    expect(container.innerHTML).toBe('');
  });
});
