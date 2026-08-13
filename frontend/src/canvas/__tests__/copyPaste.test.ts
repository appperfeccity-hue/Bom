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

    segment: null, created_at: '2024-01-01',

  } as TemplateZone;
}
const WALL_WIDTH = 3000;
const WALL_HEIGHT = 2400;
describe('Copy/Paste/Duplicate (Rule 65: zone manipulation removed)', () => {
  beforeEach(() => {
    resetHistory();
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      viewport: { zoom: 1.0, panX: 0, panY: 0 },
      selection: { selectedZoneId: null, selectedZoneIds: [], resizeHandle: null, marqueeRect: null },
      gridConfig: { size: 100, snapEnabled: true },
      clipboard: null,
      highlightedZoneIds: [],
      highlightedBomLineIds: [],
    });
    useProjectStore.setState({
      currentTemplate: {
        template_id: 'tpl-1',
        name: 'Test Template',
        wall_geometry: { type: 'STRAIGHT', base_width_mm: WALL_WIDTH, base_height_mm: WALL_HEIGHT },

        status: 'DRAFT' as any,
        segment: null, created_at: '2024-01-01',

      } as any,
      zones: [],
    });
  });
  describe('Keyboard shortcuts removed (Rule 65)', () => {
    it('Ctrl+C does not copy zones (zone manipulation disabled)', () => {
      const zones = [
        makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0 }),
        makeZone({ zone_id: 'z2', x_mm: 500, y_mm: 0 }),
      ];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1', 'z2'], resizeHandle: null, marqueeRect: null },
      });
      const { result } = renderHook(() => useHistory());
      const { result: shortcuts } = renderHook(() =>
        useKeyboardShortcuts({ history: result.current }),
      );
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true });
      act(() => {
        shortcuts.current.handleKeyDown(event);
      });
      // Clipboard should remain null - Ctrl+C no longer copies zones
      expect(useCanvasStore.getState().clipboard).toBeNull();
    });
    it('Ctrl+V does not paste zones (zone manipulation disabled)', () => {
      const zones: TemplateZone[] = [];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        clipboard: [makeZone({ zone_id: 'z1', x_mm: 200, y_mm: 200 })],
      });
      const { result } = renderHook(() => useHistory());
      const { result: shortcuts } = renderHook(() =>
        useKeyboardShortcuts({ history: result.current }),
      );
      const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true });
      act(() => {
        shortcuts.current.handleKeyDown(event);
      });
      // No zones should be pasted
      expect(useProjectStore.getState().zones).toHaveLength(0);
    });
    it('Ctrl+D does not duplicate zones (zone manipulation disabled)', () => {
      const zones = [makeZone({ zone_id: 'z1', x_mm: 200, y_mm: 200, width_mm: 200, height_mm: 200 })];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1'], resizeHandle: null, marqueeRect: null },
      });
      const { result } = renderHook(() => useHistory());
      const { result: shortcuts } = renderHook(() =>
        useKeyboardShortcuts({ history: result.current }),
      );
      const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true });
      act(() => {
        shortcuts.current.handleKeyDown(event);
      });
      // No duplication should occur
      expect(useProjectStore.getState().zones).toHaveLength(1);
    });
  });
  describe('Store-level copy/paste API still exists for programmatic use', () => {
    it('copySelection stores zones in clipboard via store API', () => {
      const zones = [
        makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0 }),
        makeZone({ zone_id: 'z2', x_mm: 500, y_mm: 0 }),
        makeZone({ zone_id: 'z3', x_mm: 1000, y_mm: 0 }),
      ];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1', 'z2'], resizeHandle: null, marqueeRect: null },
      });
      useCanvasStore.getState().copySelection(zones);
      const { clipboard } = useCanvasStore.getState();
      expect(clipboard).toHaveLength(2);
      expect(clipboard!.map((z: TemplateZone) => z.zone_id)).toContain('z1');
      expect(clipboard!.map((z: TemplateZone) => z.zone_id)).toContain('z2');
    });
    it('copySelection does not copy when no zones are selected', () => {
      const zones = [makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0 })];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        selection: { selectedZoneId: null, selectedZoneIds: [], resizeHandle: null, marqueeRect: null },
      });
      useCanvasStore.getState().copySelection(zones);
      expect(useCanvasStore.getState().clipboard).toBeNull();
    });
  });
});
