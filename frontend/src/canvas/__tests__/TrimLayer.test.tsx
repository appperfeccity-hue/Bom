// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasLayer } from '@/types/canvas';
import type { TemplateTrim } from '@/types/database';

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

import { TrimLayer } from '@/canvas/layers/TrimLayer';

const makeTrim = (overrides: Partial<TemplateTrim> = {}): TemplateTrim => ({
  trim_id: 'trim-1',
  template_id: 'tmpl-1',
  sku_id: 'sku-trim-1',
  trim_type: 'PHYSICAL',
  quantity_rule: 'TRIM_BY_ZONE_PERIMETER',
  fixed_quantity: null,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('TrimLayer', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      viewport: { zoom: 1.0, panX: 0, panY: 0 },
      layerVisibility: {
        ...useCanvasStore.getState().layerVisibility,
        [CanvasLayer.TRIMS]: true,
      },
    });
    useProjectStore.setState({
      trims: [],
    });
  });

  it('returns null when layer visibility is off', () => {
    useCanvasStore.setState({
      layerVisibility: {
        ...useCanvasStore.getState().layerVisibility,
        [CanvasLayer.TRIMS]: false,
      },
    });
    useProjectStore.setState({ trims: [makeTrim()] });

    const { container } = render(<TrimLayer wallHeight={2400} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a Rect for each trim item', () => {
    useProjectStore.setState({
      trims: [
        makeTrim({ trim_id: 'trim-1' }),
        makeTrim({ trim_id: 'trim-2' }),
      ],
    });

    render(<TrimLayer wallHeight={2400} />);
    const rects = screen.getAllByTestId('konva-rect');
    expect(rects).toHaveLength(2);
  });

  it('uses brown fill for PHYSICAL type', () => {
    useProjectStore.setState({
      trims: [makeTrim({ trim_type: 'PHYSICAL' })],
    });

    render(<TrimLayer wallHeight={2400} />);
    const rect = screen.getByTestId('konva-rect');
    expect(rect).toHaveAttribute('fill', '#795548');
  });

  it('uses grey fill for GEOMETRY type', () => {
    useProjectStore.setState({
      trims: [makeTrim({ trim_type: 'GEOMETRY' })],
    });

    render(<TrimLayer wallHeight={2400} />);
    const rect = screen.getByTestId('konva-rect');
    expect(rect).toHaveAttribute('fill', '#9e9e9e');
  });

  it('defaults to grey fill for unknown type', () => {
    useProjectStore.setState({
      trims: [makeTrim({ trim_type: 'CUSTOM_UNKNOWN' as any })],
    });

    render(<TrimLayer wallHeight={2400} />);
    const rect = screen.getByTestId('konva-rect');
    expect(rect).toHaveAttribute('fill', '#9e9e9e');
  });

  it('renders trims at sequential y positions from bottom', () => {
    useProjectStore.setState({
      trims: [makeTrim({ trim_id: 'trim-1' })],
    });

    render(<TrimLayer wallHeight={2400} />);
    const rect = screen.getByTestId('konva-rect');
    // First trim: yPos = wallHeight - (0 + 1) * (10 + 5) = 2400 - 15 = 2385
    expect(rect).toHaveAttribute('y', '2385');
  });

  it('adjusts rendering based on zoom', () => {
    useCanvasStore.setState({
      viewport: { zoom: 2.0, panX: 0, panY: 0 },
    });
    useProjectStore.setState({
      trims: [makeTrim({ trim_type: 'PHYSICAL' })],
    });

    render(<TrimLayer wallHeight={2400} />);
    const rect = screen.getByTestId('konva-rect');
    // Verify it still renders at different zoom levels
    expect(rect).toHaveAttribute('fill', '#795548');
  });
});
