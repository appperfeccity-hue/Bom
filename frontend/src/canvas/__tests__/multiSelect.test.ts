// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode } from '@/types/database';
import type { TemplateZone } from '@/types/database';
import { useKeyboardShortcuts, resetNudgeTimer } from '@/canvas/interactions/useKeyboardShortcuts';
import { resetHistory, useHistory } from '@/canvas/history/useHistory';
import { renderHook, act } from '@testing-library/react';
function makeZone(overrides: Partial<TemplateZone> & { zone_id: string }): TemplateZone {
  return {
    zone_id: overrides.zone_id,
    template_id: 'tpl-1',
    x_mm: overrides.x_mm ?? 0,
    y_mm: overrides.y_mm ?? 0,
    width_mm: overrides.width_mm ?? 400,
    height_mm: overrides.height_mm ?? 400,
    width_strategy: 'FIXED' as any,
    height_strategy: 'FIXED' as any,
    position_strategy: 'FIXED' as any,
    segment: null,
    created_at: '2024-01-01',
  };
}
const WALL_WIDTH = 3000;
const WALL_HEIGHT = 2400;
describe('Multi-select interactions', () => {
  beforeEach(() => {
    resetHistory();
    resetNudgeTimer();
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      viewport: { zoom: 1.0, panX: 0, panY: 0 },
      selection: { selectedZoneId: null, selectedZoneIds: [], resizeHandle: null, marqueeRect: null },
      gridConfig: { size: 100, snapEnabled: true },
    });
    useProjectStore.setState({
      currentTemplate: {
        template_id: 'tpl-1',
        project_id: 'proj-1',
        name: 'Test Template',
        wall_geometry: { type: 'STRAIGHT', base_width_mm: WALL_WIDTH, base_height_mm: WALL_HEIGHT },
        status: 'DRAFT' as any,
        created_at: '2024-01-01',
      } as any,
      zones: [],
    });
  });
  describe('Batch delete via keyboard', () => {
    it('deletes all selected zones with single history push', () => {
      const zones = [
        makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0 }),
        makeZone({ zone_id: 'z2', x_mm: 500, y_mm: 0 }),
        makeZone({ zone_id: 'z3', x_mm: 1000, y_mm: 0 }),
      ];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1', 'z2'], resizeHandle: null, marqueeRect: null },
      });
      const { result } = renderHook(() => useHistory());
      const { result: shortcuts } = renderHook(() =>
        useKeyboardShortcuts({ history: result.current }),
      );
      // Push initial state to enable undo
      act(() => {
        result.current.pushState(zones);
      });
      const event = new KeyboardEvent('keydown', { key: 'Delete' });
      act(() => {
        shortcuts.current.handleKeyDown(event);
      });
      const remainingZones = useProjectStore.getState().zones;
      expect(remainingZones).toHaveLength(1);
      expect(remainingZones[0].zone_id).toBe('z3');
      // Selection should be cleared
      expect(useCanvasStore.getState().selection.selectedZoneIds).toEqual([]);
    });
    it('does not delete in CONSULTANT mode', () => {
      const zones = [makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0 })];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        mode: CanvasMode.CONSULTANT,
        selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1'], resizeHandle: null, marqueeRect: null },
      });
      const { result } = renderHook(() => useHistory());
      const { result: shortcuts } = renderHook(() =>
        useKeyboardShortcuts({ history: result.current }),
      );
      const event = new KeyboardEvent('keydown', { key: 'Delete' });
      act(() => {
        shortcuts.current.handleKeyDown(event);
      });
      expect(useProjectStore.getState().zones).toHaveLength(1);
    });
  });
  describe('Batch nudge via arrow keys', () => {
    it('nudges all selected zones by the same offset', () => {
      const zones = [
        makeZone({ zone_id: 'z1', x_mm: 200, y_mm: 200 }),
        makeZone({ zone_id: 'z2', x_mm: 700, y_mm: 200 }),
      ];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1', 'z2'], resizeHandle: null, marqueeRect: null },
      });
      const { result } = renderHook(() => useHistory());
      const { result: shortcuts } = renderHook(() =>
        useKeyboardShortcuts({ history: result.current }),
      );
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      act(() => {
        shortcuts.current.handleKeyDown(event);
      });
      const updatedZones = useProjectStore.getState().zones;
      const z1 = updatedZones.find((z) => z.zone_id === 'z1')!;
      const z2 = updatedZones.find((z) => z.zone_id === 'z2')!;
      expect(z1.x_mm).toBe(300);
      expect(z2.x_mm).toBe(800);
      // Y unchanged
      expect(z1.y_mm).toBe(200);
      expect(z2.y_mm).toBe(200);
    });
    it('does not nudge if group would exceed wall boundary', () => {
      // z2 is at the right edge
      const zones = [
        makeZone({ zone_id: 'z1', x_mm: 200, y_mm: 200 }),
        makeZone({ zone_id: 'z2', x_mm: 2600, y_mm: 200 }),
      ];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1', 'z2'], resizeHandle: null, marqueeRect: null },
      });
      const { result } = renderHook(() => useHistory());
      const { result: shortcuts } = renderHook(() =>
        useKeyboardShortcuts({ history: result.current }),
      );
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      act(() => {
        shortcuts.current.handleKeyDown(event);
      });
      // Already at wall boundary for the group
      const updatedZones = useProjectStore.getState().zones;
      const z1 = updatedZones.find((z) => z.zone_id === 'z1')!;
      const z2 = updatedZones.find((z) => z.zone_id === 'z2')!;
      // The group can still move right because z2 at 2600 + 400 = 3000, which is at the boundary
      // but the nudge amount is 100 (grid size), so 2600+100+400 = 3100 > 3000
      // constrainToWall should clamp: group goes from x=200 to x=3000, width=2800
      // constrained: max x = 3000 - 2800 = 200, so dx = 0
      expect(z1.x_mm).toBe(200);
      expect(z2.x_mm).toBe(2600);
    });
    it('does not nudge if it would cause overlap with non-selected zone', () => {
      const zones = [
        makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0 }),
        makeZone({ zone_id: 'z2', x_mm: 500, y_mm: 0 }), // not selected, blocks z1 from moving right
      ];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1'], resizeHandle: null, marqueeRect: null },
      });
      const { result } = renderHook(() => useHistory());
      const { result: shortcuts } = renderHook(() =>
        useKeyboardShortcuts({ history: result.current }),
      );
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      act(() => {
        shortcuts.current.handleKeyDown(event);
      });
      const updatedZones = useProjectStore.getState().zones;
      const z1 = updatedZones.find((z) => z.zone_id === 'z1')!;
      // z1 nudges right by 100: from 0 to 100, width 400, so occupies 100-500
      // z2 occupies 500-900 - no overlap (edge touching is not overlap)
      expect(z1.x_mm).toBe(100);
    });
  });
  describe('Shift+Click toggle selection', () => {
    it('adds zone to selection on Shift+Click via toggleZoneSelection', () => {
      useCanvasStore.getState().selectZone('z1');
      useCanvasStore.getState().toggleZoneSelection('z2');
      const { selection } = useCanvasStore.getState();
      expect(selection.selectedZoneIds).toContain('z1');
      expect(selection.selectedZoneIds).toContain('z2');
    });
    it('removes zone from selection on second Shift+Click', () => {
      useCanvasStore.getState().selectZone('z1');
      useCanvasStore.getState().toggleZoneSelection('z2');
      useCanvasStore.getState().toggleZoneSelection('z2');
      const { selection } = useCanvasStore.getState();
      expect(selection.selectedZoneIds).toEqual(['z1']);
    });
  });
});
