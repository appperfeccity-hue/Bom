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

const makeZone = (id: string, x: number = 0, y: number = 0, width: number = 400, height: number = 400): TemplateZone => ({
  id,
  template_id: 'tmpl-1',
  name: `Zone ${id}`,
  x_mm: x,
  y_mm: y,
  width_mm: width,
  height_mm: height,
  width_strategy: 'FIXED' as never,
  height_strategy: 'FIXED' as never,
  position_strategy: 'ABSOLUTE' as never,
  z_index: 0,
  created_at: '',
  updated_at: '',
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
      selection: { selectedZoneId: null, resizeHandle: null },
      gridConfig: { size: 100, snapEnabled: true },
    });
    useProjectStore.setState({
      currentTemplate: {
        id: 'tmpl-1',
        name: 'Test Template',
        description: null,
        status: 'ACTIVE' as never,
        wall_geometry: 'STRAIGHT',
        base_width_mm: 3000,
        base_height_mm: 2400,
        adaptation_strategy: 'SCALE' as never,
        created_by: 'user-1',
        created_at: '',
        updated_at: '',
        version: 1,
      },
      zones: [],
      currentProject: null,
    });
  });

  it('Delete key removes selected zone in Designer mode', () => {
    const zone = makeZone('z1', 100, 100);
    useProjectStore.setState({ zones: [zone] });
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      selection: { selectedZoneId: 'z1', resizeHandle: null },
    });

    const { result } = renderHook(() => {
      const history = useHistory();
      return useKeyboardShortcuts({ history });
    });

    act(() => {
      result.current.handleKeyDown(fireKey('Delete'));
    });

    // Zone should be removed from store
    expect(useProjectStore.getState().zones).toHaveLength(0);
    // Selection should be cleared
    expect(useCanvasStore.getState().selection.selectedZoneId).toBeNull();
  });

  it('Delete key does nothing in Consultant mode', () => {
    const zone = makeZone('z1', 100, 100);
    useProjectStore.setState({ zones: [zone] });
    useCanvasStore.setState({
      mode: CanvasMode.CONSULTANT,
      selection: { selectedZoneId: 'z1', resizeHandle: null },
    });

    const { result } = renderHook(() => {
      const history = useHistory();
      return useKeyboardShortcuts({ history });
    });

    act(() => {
      result.current.handleKeyDown(fireKey('Delete'));
    });

    // Zone should still exist
    expect(useProjectStore.getState().zones).toHaveLength(1);
  });

  it('Escape clears selection', () => {
    useCanvasStore.setState({
      selection: { selectedZoneId: 'z1', resizeHandle: null },
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

  it('Arrow keys nudge zone by grid size when snap enabled', () => {
    const zone = makeZone('z1', 500, 500);
    useProjectStore.setState({ zones: [zone] });
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      selection: { selectedZoneId: 'z1', resizeHandle: null },
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
    expect(updatedZones[0].x_mm).toBe(600); // 500 + 100 (grid size)
    expect(updatedZones[0].y_mm).toBe(500); // unchanged
  });

  it('Arrow keys nudge by 1mm when snap disabled', () => {
    const zone = makeZone('z1', 500, 500);
    useProjectStore.setState({ zones: [zone] });
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      selection: { selectedZoneId: 'z1', resizeHandle: null },
      gridConfig: { size: 100, snapEnabled: false },
    });

    const { result } = renderHook(() => {
      const history = useHistory();
      return useKeyboardShortcuts({ history });
    });

    act(() => {
      result.current.handleKeyDown(fireKey('ArrowLeft'));
    });

    const updatedZones = useProjectStore.getState().zones;
    expect(updatedZones[0].x_mm).toBe(499); // 500 - 1
  });

  it('Nudge is constrained to wall boundary', () => {
    // Place zone at x=0, nudge left should keep it at 0
    const zone = makeZone('z1', 0, 500);
    useProjectStore.setState({ zones: [zone] });
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      selection: { selectedZoneId: 'z1', resizeHandle: null },
      gridConfig: { size: 100, snapEnabled: true },
    });

    const { result } = renderHook(() => {
      const history = useHistory();
      return useKeyboardShortcuts({ history });
    });

    act(() => {
      result.current.handleKeyDown(fireKey('ArrowLeft'));
    });

    // Zone should stay at 0 since constrainToWall clamps it
    const updatedZones = useProjectStore.getState().zones;
    expect(updatedZones[0].x_mm).toBe(0);
  });

  it('Nudge is blocked when it would cause overlap', () => {
    // Two zones side by side
    const zone1 = makeZone('z1', 0, 0);
    const zone2 = makeZone('z2', 400, 0);
    useProjectStore.setState({ zones: [zone1, zone2] });
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      selection: { selectedZoneId: 'z1', resizeHandle: null },
      gridConfig: { size: 100, snapEnabled: true },
    });

    const { result } = renderHook(() => {
      const history = useHistory();
      return useKeyboardShortcuts({ history });
    });

    act(() => {
      result.current.handleKeyDown(fireKey('ArrowRight'));
    });

    // Zone1 should not move because it would overlap with zone2
    const updatedZones = useProjectStore.getState().zones;
    expect(updatedZones[0].x_mm).toBe(0);
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

  it('ArrowUp increases y (bottom-left origin)', () => {
    const zone = makeZone('z1', 500, 500);
    useProjectStore.setState({ zones: [zone] });
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      selection: { selectedZoneId: 'z1', resizeHandle: null },
      gridConfig: { size: 100, snapEnabled: true },
    });

    const { result } = renderHook(() => {
      const history = useHistory();
      return useKeyboardShortcuts({ history });
    });

    act(() => {
      result.current.handleKeyDown(fireKey('ArrowUp'));
    });

    const updatedZones = useProjectStore.getState().zones;
    expect(updatedZones[0].y_mm).toBe(600); // 500 + 100
  });

  it('ArrowDown decreases y (bottom-left origin)', () => {
    const zone = makeZone('z1', 500, 500);
    useProjectStore.setState({ zones: [zone] });
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      selection: { selectedZoneId: 'z1', resizeHandle: null },
      gridConfig: { size: 100, snapEnabled: true },
    });

    const { result } = renderHook(() => {
      const history = useHistory();
      return useKeyboardShortcuts({ history });
    });

    act(() => {
      result.current.handleKeyDown(fireKey('ArrowDown'));
    });

    const updatedZones = useProjectStore.getState().zones;
    expect(updatedZones[0].y_mm).toBe(400); // 500 - 100
  });
});
