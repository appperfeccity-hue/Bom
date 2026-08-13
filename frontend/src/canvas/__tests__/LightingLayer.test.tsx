// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasLayer } from '@/types/canvas';
import type { TemplateLighting } from '@/types/database';

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

import { LightingLayer } from '@/canvas/layers/LightingLayer';

const makeLighting = (overrides: Partial<TemplateLighting> = {}): TemplateLighting => ({
  lighting_id: 'light-1',
  template_id: 'tmpl-1',
  sku_id: 'sku-light-1',
  edge_selection: null,
  mounting_type: 'DIRECT',
  quantity_rule: null,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('LightingLayer', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      viewport: { zoom: 1.0, panX: 0, panY: 0 },
      layerVisibility: {
        ...useCanvasStore.getState().layerVisibility,
        [CanvasLayer.LIGHTING]: true,
      },
    });
    useProjectStore.setState({
      lighting: [],
    });
  });

  it('returns null when layer visibility is off', () => {
    useCanvasStore.setState({
      layerVisibility: {
        ...useCanvasStore.getState().layerVisibility,
        [CanvasLayer.LIGHTING]: false,
      },
    });
    useProjectStore.setState({ lighting: [makeLighting()] });

    const { container } = render(<LightingLayer wallHeight={2400} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a Rect for each lighting item', () => {
    useProjectStore.setState({
      lighting: [
        makeLighting({ lighting_id: 'light-1' }),
        makeLighting({ lighting_id: 'light-2' }),
      ],
    });

    render(<LightingLayer wallHeight={2400} />);
    const rects = screen.getAllByTestId('konva-rect');
    expect(rects).toHaveLength(2);
  });

  it('color-codes DIRECT mounting_type as #FFD700', () => {
    useProjectStore.setState({
      lighting: [makeLighting({ mounting_type: 'DIRECT' })],
    });

    render(<LightingLayer wallHeight={2400} />);
    const rect = screen.getByTestId('konva-rect');
    expect(rect).toHaveAttribute('fill', '#FFD700');
  });

  it('color-codes PROFILE mounting_type as #87CEEB', () => {
    useProjectStore.setState({
      lighting: [makeLighting({ mounting_type: 'PROFILE' })],
    });

    render(<LightingLayer wallHeight={2400} />);
    const rect = screen.getByTestId('konva-rect');
    expect(rect).toHaveAttribute('fill', '#87CEEB');
  });

  it('color-codes COVE mounting_type as #4FC3F7', () => {
    useProjectStore.setState({
      lighting: [makeLighting({ mounting_type: 'COVE' })],
    });

    render(<LightingLayer wallHeight={2400} />);
    const rect = screen.getByTestId('konva-rect');
    expect(rect).toHaveAttribute('fill', '#4FC3F7');
  });

  it('defaults to white for unknown mounting_type', () => {
    useProjectStore.setState({
      lighting: [makeLighting({ mounting_type: 'UNKNOWN' as any })],
    });

    render(<LightingLayer wallHeight={2400} />);
    const rect = screen.getByTestId('konva-rect');
    expect(rect).toHaveAttribute('fill', '#FFFFFF');
  });

  it('renders lighting items at sequential y positions', () => {
    useProjectStore.setState({
      lighting: [makeLighting()],
    });

    render(<LightingLayer wallHeight={2400} />);
    const rect = screen.getByTestId('konva-rect');
    expect(rect).toHaveAttribute('y', '0');
  });
});
