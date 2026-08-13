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
  furniture_id: 'furn-1',
  template_id: 'tmpl-1',
  sku_id: 'sku-furn-1',
  position_x_mm: 500,
  position_y_mm: 100,
  orientation: 'HORIZONTAL',
  created_at: '2024-01-01T00:00:00Z',
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

  it('renders a Group with Rect for each furniture item', () => {
    useProjectStore.setState({
      furniture: [makeFurniture()],
    });

    render(<FurnitureLayer wallHeight={2400} />);
    expect(screen.getAllByTestId('konva-group')).toHaveLength(1);
    expect(screen.getAllByTestId('konva-rect')).toHaveLength(1);
  });

  it('renders multiple furniture items', () => {
    useProjectStore.setState({
      furniture: [
        makeFurniture({ furniture_id: 'furn-1' }),
        makeFurniture({ furniture_id: 'furn-2', position_x_mm: 1200 }),
      ],
    });

    render(<FurnitureLayer wallHeight={2400} />);
    expect(screen.getAllByTestId('konva-group')).toHaveLength(2);
    expect(screen.getAllByTestId('konva-rect')).toHaveLength(2);
  });

  it('uses HORIZONTAL orientation to set width > height', () => {
    useProjectStore.setState({
      furniture: [makeFurniture({ orientation: 'HORIZONTAL' })],
    });

    render(<FurnitureLayer wallHeight={2400} />);
    const rect = screen.getByTestId('konva-rect');
    expect(rect).toHaveAttribute('width', '200');
    expect(rect).toHaveAttribute('height', '100');
  });

  it('uses VERTICAL orientation to set height > width', () => {
    useProjectStore.setState({
      furniture: [makeFurniture({ orientation: 'VERTICAL' })],
    });

    render(<FurnitureLayer wallHeight={2400} />);
    const rect = screen.getByTestId('konva-rect');
    expect(rect).toHaveAttribute('width', '100');
    expect(rect).toHaveAttribute('height', '200');
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
    // wallHeight=2400, position_y_mm=100, HORIZONTAL orientation: height=100
    // screenY = 2400 - 100 - 100 = 2200
    useProjectStore.setState({
      furniture: [makeFurniture({ position_x_mm: 500, position_y_mm: 100, orientation: 'HORIZONTAL' })],
    });

    render(<FurnitureLayer wallHeight={2400} />);
    const group = screen.getByTestId('konva-group');
    expect(group).toHaveAttribute('x', '500');
    expect(group).toHaveAttribute('y', '2200');
  });
});
