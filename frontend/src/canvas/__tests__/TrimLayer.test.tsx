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
  id: 'trim-1',
  template_id: 'tmpl-1',
  name: 'Top Border',
  type: 'PHYSICAL',
  path_mm: [
    { x: 0, y: 2400 },
    { x: 3000, y: 2400 },
  ],
  configuration: {},
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
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

  it('renders a Line for each trim item', () => {
    useProjectStore.setState({
      trims: [
        makeTrim({ id: 'trim-1' }),
        makeTrim({ id: 'trim-2', name: 'Bottom Border' }),
      ],
    });

    render(<TrimLayer wallHeight={2400} />);
    const lines = screen.getAllByTestId('konva-line');
    expect(lines).toHaveLength(2);
  });

  it('uses thick solid stroke for PHYSICAL type', () => {
    useProjectStore.setState({
      trims: [makeTrim({ type: 'PHYSICAL' })],
    });

    render(<TrimLayer wallHeight={2400} />);
    const line = screen.getByTestId('konva-line');
    expect(line).toHaveAttribute('stroke', '#795548');
  });

  it('uses thin dashed stroke for GEOMETRY type', () => {
    useProjectStore.setState({
      trims: [makeTrim({ type: 'GEOMETRY' })],
    });

    render(<TrimLayer wallHeight={2400} />);
    const line = screen.getByTestId('konva-line');
    expect(line).toHaveAttribute('stroke', '#9e9e9e');
    expect(line).toHaveAttribute('dash', '6,4');
  });

  it('defaults to GEOMETRY style for unknown type', () => {
    useProjectStore.setState({
      trims: [makeTrim({ type: 'CUSTOM_UNKNOWN' })],
    });

    render(<TrimLayer wallHeight={2400} />);
    const line = screen.getByTestId('konva-line');
    expect(line).toHaveAttribute('stroke', '#9e9e9e');
  });

  it('converts path_mm points y-coordinate using wallHeight', () => {
    // wallHeight=2400, point y=2400 => screenY = 2400 - 2400 = 0
    // wallHeight=2400, point y=0 => screenY = 2400 - 0 = 2400
    useProjectStore.setState({
      trims: [
        makeTrim({
          path_mm: [
            { x: 0, y: 2400 },
            { x: 3000, y: 0 },
          ],
        }),
      ],
    });

    render(<TrimLayer wallHeight={2400} />);
    const line = screen.getByTestId('konva-line');
    // Points should be: [0, 0, 3000, 2400] (flattened with y converted)
    expect(line).toHaveAttribute('points', '0,0,3000,2400');
  });

  it('adjusts rendering based on zoom', () => {
    useCanvasStore.setState({
      viewport: { zoom: 2.0, panX: 0, panY: 0 },
    });
    useProjectStore.setState({
      trims: [makeTrim({ type: 'PHYSICAL' })],
    });

    render(<TrimLayer wallHeight={2400} />);
    const line = screen.getByTestId('konva-line');
    // Verify it still renders at different zoom levels
    expect(line).toHaveAttribute('stroke', '#795548');
  });
});
