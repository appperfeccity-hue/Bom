import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasLayer } from '@/types/canvas';
import type { TemplateFurniture } from '@/types/database';

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
  Group: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement('div', { 'data-testid': 'konva-group', ...props }, children),
}));

import { FurnitureLayer } from '@/canvas/layers/FurnitureLayer';

const makeFurniture = (overrides: Partial<TemplateFurniture> = {}): TemplateFurniture => ({
  id: 'furn-1',
  template_id: 'tmpl-1',
  name: 'Display Table',
  type: 'TABLE',
  x_mm: 500,
  y_mm: 100,
  width_mm: 600,
  height_mm: 400,
  rotation_deg: 0,
  configuration: {},
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('FurnitureLayer', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      viewport: { zoom: 1.0, panX: 0, panY: 0 },
      layerVisibility: {
        ...useCanvasStore.getState().layerVisibility,
        [CanvasLayer.FURNITURE]: true,
      },
    });
    useProjectStore.setState({
      furniture: [],
    });
  });

  it('returns null when layer visibility is off', () => {
    useCanvasStore.setState({
      layerVisibility: {
        ...useCanvasStore.getState().layerVisibility,
        [CanvasLayer.FURNITURE]: false,
      },
    });
    useProjectStore.setState({ furniture: [makeFurniture()] });

    const { container } = render(<FurnitureLayer wallHeight={2400} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a Group with Rect and Text for each furniture item', () => {
    useProjectStore.setState({
      furniture: [makeFurniture()],
    });

    render(<FurnitureLayer wallHeight={2400} />);
    expect(screen.getAllByTestId('konva-group')).toHaveLength(1);
    expect(screen.getAllByTestId('konva-rect')).toHaveLength(1);
    expect(screen.getAllByTestId('konva-text')).toHaveLength(1);
  });

  it('renders multiple furniture items', () => {
    useProjectStore.setState({
      furniture: [
        makeFurniture({ id: 'furn-1' }),
        makeFurniture({ id: 'furn-2', name: 'Shelf Unit', x_mm: 1200 }),
      ],
    });

    render(<FurnitureLayer wallHeight={2400} />);
    expect(screen.getAllByTestId('konva-group')).toHaveLength(2);
    expect(screen.getAllByTestId('konva-rect')).toHaveLength(2);
    expect(screen.getAllByTestId('konva-text')).toHaveLength(2);
  });

  it('applies rotation_deg to the Group', () => {
    useProjectStore.setState({
      furniture: [makeFurniture({ rotation_deg: 45 })],
    });

    render(<FurnitureLayer wallHeight={2400} />);
    const group = screen.getByTestId('konva-group');
    expect(group).toHaveAttribute('rotation', '45');
  });

  it('renders furniture name as Text label', () => {
    useProjectStore.setState({
      furniture: [makeFurniture({ name: 'Counter Unit' })],
    });

    render(<FurnitureLayer wallHeight={2400} />);
    const text = screen.getByTestId('konva-text');
    expect(text).toHaveAttribute('text', 'Counter Unit');
  });

  it('fills rect with light gray', () => {
    useProjectStore.setState({
      furniture: [makeFurniture()],
    });

    render(<FurnitureLayer wallHeight={2400} />);
    const rect = screen.getByTestId('konva-rect');
    expect(rect).toHaveAttribute('fill', '#f0f0f0');
  });

  it('converts y-coordinate using wallHeight (bottom-left to top-left)', () => {
    // wallHeight=2400, y_mm=100, height_mm=400
    // screenY = 2400 - 100 - 400 = 1900
    // Group positioned at center: x = 500 + 600/2 = 800, y = 1900 + 400/2 = 2100
    useProjectStore.setState({
      furniture: [makeFurniture({ x_mm: 500, y_mm: 100, width_mm: 600, height_mm: 400 })],
    });

    render(<FurnitureLayer wallHeight={2400} />);
    const group = screen.getByTestId('konva-group');
    expect(group).toHaveAttribute('x', '800');
    expect(group).toHaveAttribute('y', '2100');
  });
});
