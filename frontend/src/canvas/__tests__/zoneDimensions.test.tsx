import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasLayer } from '@/types/canvas';
import { CanvasMode, ZoneWidthStrategy, ZoneHeightStrategy, ZonePositionStrategy } from '@/types/database';
import type { TemplateZone } from '@/types/database';

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
}));

import { ZoneDimensionsLayer } from '@/canvas/layers/ZoneDimensionsLayer';

const makeZone = (overrides: Partial<TemplateZone> = {}): TemplateZone => ({
  zone_id: 'zone-1',
  template_id: 'tmpl-1',
  x_mm: 100,
  y_mm: 200,
  width_mm: 800,
  height_mm: 400,
  width_strategy: ZoneWidthStrategy.FIXED,
  height_strategy: ZoneHeightStrategy.FIXED,
  position_strategy: ZonePositionStrategy.FIXED,
  segment: null,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('ZoneDimensionsLayer', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      viewport: { zoom: 1.0, panX: 0, panY: 0 },
      layerVisibility: {
        ...useCanvasStore.getState().layerVisibility,
        [CanvasLayer.ZONE_DIMENSIONS]: true,
      },
    });
    useProjectStore.setState({
      zones: [makeZone()],
    });
  });

  it('renders dimension text for zone width and height', () => {
    render(<ZoneDimensionsLayer wallHeight={2400} />);

    const textElements = screen.getAllByTestId('konva-text');
    const texts = textElements.map((el) => el.getAttribute('text'));
    expect(texts).toContain('800');
    expect(texts).toContain('400');
  });

  it('renders dimension lines for each zone', () => {
    render(<ZoneDimensionsLayer wallHeight={2400} />);

    // Each zone gets: 2 dimension lines + 4 tick lines = 6 lines per zone
    const lineElements = screen.getAllByTestId('konva-line');
    expect(lineElements.length).toBe(6);
  });

  it('renders nothing when layer is hidden', () => {
    useCanvasStore.setState({
      layerVisibility: {
        ...useCanvasStore.getState().layerVisibility,
        [CanvasLayer.ZONE_DIMENSIONS]: false,
      },
    });

    const { container } = render(<ZoneDimensionsLayer wallHeight={2400} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing in CONSULTANT mode', () => {
    useCanvasStore.setState({
      mode: CanvasMode.CONSULTANT,
    });

    const { container } = render(<ZoneDimensionsLayer wallHeight={2400} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when there are no zones', () => {
    useProjectStore.setState({
      zones: [],
    });

    const { container } = render(<ZoneDimensionsLayer wallHeight={2400} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders dimension texts for multiple zones', () => {
    useProjectStore.setState({
      zones: [
        makeZone({ zone_id: 'zone-1', width_mm: 600, height_mm: 300 }),
        makeZone({ zone_id: 'zone-2', x_mm: 1000, width_mm: 900, height_mm: 500 }),
      ],
    });

    render(<ZoneDimensionsLayer wallHeight={2400} />);

    const textElements = screen.getAllByTestId('konva-text');
    const texts = textElements.map((el) => el.getAttribute('text'));
    expect(texts).toContain('600');
    expect(texts).toContain('300');
    expect(texts).toContain('900');
    expect(texts).toContain('500');
  });
});
