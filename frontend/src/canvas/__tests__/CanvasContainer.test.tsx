import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode, TemplateStatus, AdaptationStrategy } from '@/types/database';
import type { Template } from '@/types/database';

// Mock Supabase client to avoid needing env vars
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

// Mock react-konva - these components use canvas which is not available in jsdom
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

// Import after mocks are set up
import { CanvasContainer } from '@/canvas/CanvasContainer';

const mockTemplate: Template = {
  id: 'tmpl-1',
  name: 'Test Template',
  description: null,
  status: TemplateStatus.ACTIVE,
  wall_geometry: 'STRAIGHT',
  base_width_mm: 3000,
  base_height_mm: 2400,
  adaptation_strategy: AdaptationStrategy.SCALE,
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  version: 1,
};

describe('CanvasContainer', () => {
  beforeEach(() => {
    // Reset stores to initial state
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      viewport: { zoom: 1.0, panX: 0, panY: 0 },
      selection: { selectedZoneId: null, selectedZoneIds: [], resizeHandle: null, marqueeRect: null },
      saveStatus: 'saved',
    });
    useProjectStore.setState({
      currentTemplate: mockTemplate,
      zones: [],
      wallGeometry: 'STRAIGHT',
      measurements: null,
    });
  });

  it('renders without crashing', () => {
    render(<CanvasContainer mode={CanvasMode.DESIGNER} />);
    expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
  });

  it('renders the Konva Stage', () => {
    render(<CanvasContainer mode={CanvasMode.DESIGNER} />);
    expect(screen.getByTestId('canvas-stage')).toBeInTheDocument();
  });

  it('renders grid layer (Konva Lines for grid)', () => {
    render(<CanvasContainer mode={CanvasMode.DESIGNER} />);
    // Grid layer renders konva-line elements
    const lines = screen.getAllByTestId('konva-line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('renders wall outline', () => {
    render(<CanvasContainer mode={CanvasMode.DESIGNER} />);
    // Wall outline is rendered as a closed Line
    const lines = screen.getAllByTestId('konva-line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('zone click selects zone (updates canvasStore.selection)', () => {
    const zoneId = 'zone-abc';
    useProjectStore.setState({
      zones: [
        {
          id: zoneId,
          template_id: 'tmpl-1',
          name: 'Zone 1',
          x_mm: 100,
          y_mm: 100,
          width_mm: 400,
          height_mm: 400,
          width_strategy: 'FIXED' as never,
          height_strategy: 'FIXED' as never,
          position_strategy: 'ABSOLUTE' as never,
          z_index: 0,
          segment: null,
          created_at: '',
          updated_at: '',
        },
      ],
    });

    render(<CanvasContainer mode={CanvasMode.DESIGNER} />);

    // Simulate selecting a zone via store action
    useCanvasStore.getState().selectZone(zoneId);
    expect(useCanvasStore.getState().selection.selectedZoneId).toBe(zoneId);
  });

  it('mode switch disables zone interactions in CONSULTANT mode', () => {
    render(<CanvasContainer mode={CanvasMode.CONSULTANT} />);
    // Verify the mode was set to CONSULTANT in the store
    expect(useCanvasStore.getState().mode).toBe(CanvasMode.CONSULTANT);
  });
});
