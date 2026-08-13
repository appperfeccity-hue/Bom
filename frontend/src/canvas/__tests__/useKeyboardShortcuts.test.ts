// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { useKeyboardShortcuts } from '@/canvas/interactions/useKeyboardShortcuts';
import { useHistory, resetHistory } from '@/canvas/history/useHistory';
import { CanvasMode } from '@/types/database';
import type { TemplateZone } from '@/types/database';

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

const makeZone = (zoneId: string, x: number = 0, y: number = 0, width: number = 400, height: number = 400): TemplateZone => ({
  zone_id: zoneId,
  template_id: 'tmpl-1',
  x_mm: x,
  y_mm: y,
  width_mm: width,
  height_mm: height,
  width_strategy: 'FIXED' as never,
  height_strategy: 'FIXED' as never,
  position_strategy: 'FIXED' as never,
  segment: null,
  created_at: '',
});

function fireKey(key: string, opts: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    resetHistory();
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      viewport: { zoom: 1.0, panX: 0, panY: 0 },
      selection: { selectedZoneId: null, selectedZoneIds: [], resizeHandle: null, marqueeRect: null },
      gridConfig: { size: 100, snapEnabled: true },
    });
    useProjectStore.setState({
      currentTemplate: {
        template_id: 'tmpl-1',
        name: 'Test Template',
        description: null,
        wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2400 },
        status: 'ACTIVE' as never,
        adaptation_strategy: 'SCALE' as never,
        created_by: 'user-1',
        created_at: '',
      } as any,
      zones: [],
      currentProject: null,
    });
  });

  it('Escape clears selection', () => {
    useCanvasStore.setState({
      selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1'], resizeHandle: null, marqueeRect: null },
    });

    const { result } = renderHook(() => {
      const history = useHistory();
      return useKeyboardShortcuts({ history });
    });

    act(() => {
      result.current.handleKeyDown(fireKey('Escape'));
    });

    expect(useCanvasStore.getState().selection.selectedZoneId).toBeNull();
  });

  it('Ctrl+Z triggers undo', () => {
    const { result } = renderHook(() => {
      const history = useHistory();
      return { shortcuts: useKeyboardShortcuts({ history }), history };
    });

    const zones1 = [makeZone('z1', 0, 0)];
    const zones2 = [makeZone('z1', 100, 0)];

    act(() => {
      result.current.history.pushState(zones1);
      result.current.history.pushState(zones2);
    });

    // Set current zones to zones2
    useProjectStore.setState({ zones: zones2 });

    act(() => {
      result.current.shortcuts.handleKeyDown(fireKey('z', { ctrlKey: true }));
    });

    const currentZones = useProjectStore.getState().zones;
    expect(currentZones[0].x_mm).toBe(0); // Reverted to zones1
  });

  it('Ctrl+Shift+Z triggers redo', () => {
    const { result } = renderHook(() => {
      const history = useHistory();
      return { shortcuts: useKeyboardShortcuts({ history }), history };
    });

    const zones1 = [makeZone('z1', 0, 0)];
    const zones2 = [makeZone('z1', 100, 0)];

    act(() => {
      result.current.history.pushState(zones1);
      result.current.history.pushState(zones2);
    });

    // Undo first
    act(() => {
      result.current.shortcuts.handleKeyDown(fireKey('z', { ctrlKey: true }));
    });

    // Then redo
    act(() => {
      result.current.shortcuts.handleKeyDown(fireKey('Z', { ctrlKey: true, shiftKey: true }));
    });

    const currentZones = useProjectStore.getState().zones;
    expect(currentZones[0].x_mm).toBe(100); // Back to zones2
  });

  it('Delete key does nothing (zones are read-only per Rule 65)', () => {
    const zone = makeZone('z1', 100, 100);
    useProjectStore.setState({ zones: [zone] });
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1'], resizeHandle: null, marqueeRect: null },
    });

    const { result } = renderHook(() => {
      const history = useHistory();
      return useKeyboardShortcuts({ history });
    });

    act(() => {
      result.current.handleKeyDown(fireKey('Delete'));
    });

    // Zone should still exist - deletion is no longer supported
    expect(useProjectStore.getState().zones).toHaveLength(1);
  });

  it('Arrow keys do nothing (zone nudge removed per Rule 65)', () => {
    const zone = makeZone('z1', 500, 500);
    useProjectStore.setState({ zones: [zone] });
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1'], resizeHandle: null, marqueeRect: null },
      gridConfig: { size: 100, snapEnabled: true },
    });

    const { result } = renderHook(() => {
      const history = useHistory();
      return useKeyboardShortcuts({ history });
    });

    act(() => {
      result.current.handleKeyDown(fireKey('ArrowRight'));
    });

    const updatedZones = useProjectStore.getState().zones;
    expect(updatedZones[0].x_mm).toBe(500); // Unchanged
    expect(updatedZones[0].y_mm).toBe(500); // Unchanged
  });

  it('Ctrl+C does nothing (zone copy removed per Rule 65)', () => {
    const zones = [makeZone('z1', 200, 200)];
    useProjectStore.setState({ zones });
    useCanvasStore.setState({
      selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1'], resizeHandle: null, marqueeRect: null },
    });

    const { result } = renderHook(() => {
      const history = useHistory();
      return useKeyboardShortcuts({ history });
    });

    act(() => {
      result.current.handleKeyDown(fireKey('c', { ctrlKey: true }));
    });

    expect(useCanvasStore.getState().clipboard).toBeNull();
  });

  it('Ctrl+V does nothing (zone paste removed per Rule 65)', () => {
    const zones = [makeZone('z1', 200, 200)];
    useProjectStore.setState({ zones });
    useCanvasStore.setState({
      clipboard: [makeZone('z1', 200, 200)],
    });

    const { result } = renderHook(() => {
      const history = useHistory();
      return useKeyboardShortcuts({ history });
    });

    act(() => {
      result.current.handleKeyDown(fireKey('v', { ctrlKey: true }));
    });

    // No new zones pasted
    expect(useProjectStore.getState().zones).toHaveLength(1);
  });
});
