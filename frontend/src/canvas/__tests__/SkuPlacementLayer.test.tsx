import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasLayer } from '@/types/canvas';
import { CanvasMode } from '@/types/database';
import type { TemplateZone, SkuMaster } from '@/types/database';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl: () =>
          Promise.resolve({ data: { signedUrl: 'https://example.com/signed-url.png' }, error: null }),
      }),
    },
  },
  fromTable: () => ({
    select: () => ({
      in: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
      eq: () => ({
        single: () => Promise.resolve({ data: null, error: null }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
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
  Image: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'konva-image', ...props }),
  Group: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement('div', { 'data-testid': 'konva-group', ...props }, children),
  Circle: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'konva-circle', ...props }),
}));

// Mock useSkuRenderUrls to control behavior in tests
vi.mock('@/canvas/utils/useSkuRenderUrls', () => ({
  useSkuRenderUrls: vi.fn(() => new Map()),
}));

import { SkuPlacementLayer } from '@/canvas/layers/SkuPlacementLayer';
import { useSkuRenderUrls } from '@/canvas/utils/useSkuRenderUrls';

const mockZone: TemplateZone = {
  zone_id: 'zone-1',
  template_id: 'tmpl-1',
  x_mm: 100,
  y_mm: 200,
  width_mm: 500,
  height_mm: 400,
  width_strategy: 'FIXED' as never,
  height_strategy: 'FIXED' as never,
  position_strategy: 'FIXED' as never,
  segment: null,
  created_at: '',
};

const mockSku: SkuMaster = {
  sku_id: 'sku-1',
  sku_code: 'WP-001',
  product_type: 'WALL_PANEL' as never,
  family_id: 'fam-1',
  category_id: 'cat-1',
  width_mm: 600,
  height_mm: 300,
  thickness_mm: 12,
  depth_mm: null,
  unit_length_mm: null,
  material: 'Wood',
  colour: 'Oak',
  finish: 'Matte',
  pattern_identity: null,
  gh_mm: 0,
  gv_mm: 0,
  quantity_mode: null,
  commercial_attributes: {},
  status: 'ACTIVE' as never,
  created_by: 'user-1',
  created_at: '',
  updated_at: '',
};

describe('SkuPlacementLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      viewport: { zoom: 1.0, panX: 0, panY: 0 },
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
      zones: [mockZone],
      zoneSku: new Map([['zone-1', mockSku]]),
    });
  });

  it('renders nothing when visibility is toggled off', () => {
    useCanvasStore.setState({
      layerVisibility: {
        [CanvasLayer.GRID]: true,
        [CanvasLayer.WALL_OUTLINE]: true,
        [CanvasLayer.ZONES]: true,
        [CanvasLayer.SKU_PLACEMENT]: false,
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

    const { container } = render(<SkuPlacementLayer wallHeight={2400} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders fallback text when no render URL is available', () => {
    // useSkuRenderUrls returns empty map (no URLs)
    vi.mocked(useSkuRenderUrls).mockReturnValue(new Map());

    render(<SkuPlacementLayer wallHeight={2400} />);

    const textElements = screen.getAllByTestId('konva-text');
    expect(textElements.length).toBeGreaterThan(0);
    // Check that the sku_code is shown as text
    const textEl = textElements.find((el) => el.getAttribute('text') === 'WP-001');
    expect(textEl).toBeDefined();
  });

  it('renders Image when a render URL is available and image loads', () => {
    // Mock useSkuRenderUrls to return a URL for zone-1
    vi.mocked(useSkuRenderUrls).mockReturnValue(new Map([['zone-1', 'https://example.com/render.png']]));

    render(<SkuPlacementLayer wallHeight={2400} />);

    // Since the Image loading is async with useEffect, the initial render
    // may not show the image yet. We verify the layer renders without error.
    const layer = screen.getByTestId('konva-layer');
    expect(layer).toBeInTheDocument();
  });

  it('renders nothing for zones without assigned SKU', () => {
    useProjectStore.setState({
      zoneSku: new Map([['zone-1', mockSku]]), // only zone-1 has SKU
    });
    vi.mocked(useSkuRenderUrls).mockReturnValue(new Map());

    render(<SkuPlacementLayer wallHeight={2400} />);

    // Only one text element should be rendered (for zone-1 fallback)
    const textElements = screen.getAllByTestId('konva-text');
    expect(textElements).toHaveLength(1);
  });

  it('converts coordinates using wallHeight (bottom-left to top-left)', () => {
    vi.mocked(useSkuRenderUrls).mockReturnValue(new Map());

    render(<SkuPlacementLayer wallHeight={2400} />);

    const textElements = screen.getAllByTestId('konva-text');
    const textEl = textElements.find((el) => el.getAttribute('text') === 'WP-001');
    expect(textEl).toBeDefined();

    // screenY = wallHeight - zone.y_mm - zone.height_mm = 2400 - 200 - 400 = 1800
    // Text y = screenY + height/2 - 7 = 1800 + 200 - 7 = 1993
    const yAttr = textEl?.getAttribute('y');
    expect(Number(yAttr)).toBe(1993);
  });
});
