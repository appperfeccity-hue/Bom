// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode } from '@/types/database';
import type { TemplateZone } from '@/types/database';
import { useKeyboardShortcuts } from '@/canvas/interactions/useKeyboardShortcuts';
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
  describe('Rule 65: Zone deletion removed (zones are system-generated)', () => {
    it('Delete key does not remove zones in Designer mode', () => {
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
      const event = new KeyboardEvent('keydown', { key: 'Delete' });
      act(() => {
        shortcuts.current.handleKeyDown(event);
      });
      // All zones should remain - deletion is no longer supported
      const remainingZones = useProjectStore.getState().zones;
      expect(remainingZones).toHaveLength(3);
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
  describe('Undo/Redo still works for wall configuration changes', () => {
    it('Ctrl+Z undoes wall configuration changes', () => {
      const zonesV1 = [makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0, width_mm: 500 })];
      const zonesV2 = [makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0, width_mm: 800 })];
      useProjectStore.setState({ zones: zonesV2 });

      const { result } = renderHook(() => useHistory());
      const { result: shortcuts } = renderHook(() =>
        useKeyboardShortcuts({ history: result.current }),
      );

      act(() => {
        result.current.pushState(zonesV1);
        result.current.pushState(zonesV2);
      });

      const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true });
      act(() => {
        shortcuts.current.handleKeyDown(event);
      });

      const currentZones = useProjectStore.getState().zones;
      expect(currentZones[0].width_mm).toBe(500);
    });
  });
});
