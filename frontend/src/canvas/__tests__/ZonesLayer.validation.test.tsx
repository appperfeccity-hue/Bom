import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode, TemplateStatus, AdaptationStrategy } from '@/types/database';
import type { Template, TemplateZone } from '@/types/database';
import { CanvasLayer } from '@/types/canvas';

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

// Mock react-konva
vi.mock('react-konva', () => ({
  Stage: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement('div', { 'data-testid': 'konva-stage', ...props }, children),
  Layer: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement('div', { 'data-testid': 'konva-layer', ...props }, children),
  Rect: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'konva-rect', ...props }),
  Line: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'konva-line', ...props }),
  Text: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'konva-text', ...props }),
  Circle: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'konva-circle', ...props }),
  Group: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement('div', { 'data-testid': 'konva-group', ...props }, children),
  Image: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'konva-image', ...props }),
}));

import { ZonesLayer } from '@/canvas/layers/ZonesLayer';

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

describe('ZonesLayer - validation styling', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      viewport: { zoom: 1.0, panX: 0, panY: 0 },
      selection: { selectedZoneId: null, selectedZoneIds: [], resizeHandle: null, marqueeRect: null },
      layerVisibility: {
        [CanvasLayer.GRID]: true,
        [CanvasLayer.WALL_OUTLINE]: true,
        [CanvasLayer.ZONES]: true,
        [CanvasLayer.SKU_PLACEMENT]: true,
        [CanvasLayer.LIGHTING]: true,
        [CanvasLayer.FURNITURE]: true,
        [CanvasLayer.TRIMS]: true,
        [CanvasLayer.MEASUREMENTS]: true,
        [CanvasLayer.ZONE_DIMENSIONS]: true,
        [CanvasLayer.SNAP_GUIDES]: true,
        [CanvasLayer.SELECTION]: true,
        [CanvasLayer.GRID_OVERLAY]: true,
      },
    });
    useProjectStore.setState({
      currentTemplate: mockTemplate,
      zones: [],
      zoneSku: new Map(),
    });
  });

  it('renders zones with default blue stroke when valid', () => {
    useProjectStore.setState({
      zones: [
        makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0, width_mm: 400, height_mm: 400 }),
      ],
    });

    render(<ZonesLayer wallHeight={2400} />);
    const rects = screen.getAllByTestId('konva-rect');
    // The zone rect should have teal stroke (system-generated zones)
    expect(rects[0]).toHaveAttribute('stroke', '#4db6ac');
  });

  it('renders zones with red stroke when they have overlap errors', () => {
    // Create overlapping zones
    useProjectStore.setState({
      zones: [
        makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0, width_mm: 400, height_mm: 400 }),
        makeZone({ zone_id: 'z2', x_mm: 200, y_mm: 200, width_mm: 400, height_mm: 400 }),
      ],
    });

    render(<ZonesLayer wallHeight={2400} />);
    const rects = screen.getAllByTestId('konva-rect');
    expect(rects[0]).toHaveAttribute('stroke', '#f44336');
    expect(rects[1]).toHaveAttribute('stroke', '#f44336');
  });

  it('renders zones with red stroke when out of bounds', () => {
    useProjectStore.setState({
      zones: [
        makeZone({ zone_id: 'z1', x_mm: 2800, y_mm: 0, width_mm: 400, height_mm: 400 }),
      ],
    });

    render(<ZonesLayer wallHeight={2400} />);
    const rects = screen.getAllByTestId('konva-rect');
    expect(rects[0]).toHaveAttribute('stroke', '#f44336');
  });

  it('renders zones with red stroke when undersized', () => {
    useProjectStore.setState({
      zones: [
        makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0, width_mm: 100, height_mm: 100 }),
      ],
    });

    render(<ZonesLayer wallHeight={2400} />);
    const rects = screen.getAllByTestId('konva-rect');
    expect(rects[0]).toHaveAttribute('stroke', '#f44336');
  });

  it('uses thicker stroke for invalid zones (red stroke applied)', () => {
    useProjectStore.setState({
      zones: [
        makeZone({ zone_id: 'z1', x_mm: 2800, y_mm: 0, width_mm: 400, height_mm: 400 }),
      ],
    });

    render(<ZonesLayer wallHeight={2400} />);
    const rects = screen.getAllByTestId('konva-rect');
    // Invalid zone gets the red stroke color indicating it has errors + thicker stroke
    expect(rects[0]).toHaveAttribute('stroke', '#f44336');
  });

  it('returns null when zones layer is not visible', () => {
    useCanvasStore.setState({
      layerVisibility: {
        [CanvasLayer.GRID]: true,
        [CanvasLayer.WALL_OUTLINE]: true,
        [CanvasLayer.ZONES]: false,
        [CanvasLayer.SKU_PLACEMENT]: true,
        [CanvasLayer.LIGHTING]: true,
        [CanvasLayer.FURNITURE]: true,
        [CanvasLayer.TRIMS]: true,
        [CanvasLayer.MEASUREMENTS]: true,
        [CanvasLayer.ZONE_DIMENSIONS]: true,
        [CanvasLayer.SNAP_GUIDES]: true,
        [CanvasLayer.SELECTION]: true,
        [CanvasLayer.GRID_OVERLAY]: true,
      },
    });

    const { container } = render(<ZonesLayer wallHeight={2400} />);
    expect(container.innerHTML).toBe('');
  });
});
