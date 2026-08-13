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
    
    segment: null, created_at: '2024-01-01',
    
  } as TemplateZone;
}
const WALL_WIDTH = 3000;
const WALL_HEIGHT = 2400;
describe('Copy/Paste/Duplicate', () => {
  beforeEach(() => {
    resetHistory();
    resetNudgeTimer();
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
  describe('copySelection', () => {
    it('copies selected zones to clipboard', () => {
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
    it('does not copy when no zones are selected', () => {
      const zones = [makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0 })];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        selection: { selectedZoneId: null, selectedZoneIds: [], resizeHandle: null, marqueeRect: null },
      });
      useCanvasStore.getState().copySelection(zones);
      expect(useCanvasStore.getState().clipboard).toBeNull();
    });
  });
  describe('pasteClipboard', () => {
    it('pastes zones with 100mm offset when no overlap', () => {
      // Paste into empty canvas - no overlap possible
      const zones: TemplateZone[] = [];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        clipboard: [makeZone({ zone_id: 'z1', x_mm: 200, y_mm: 200 })],
      });
      const { result: historyResult } = renderHook(() => useHistory());
      act(() => {
        historyResult.current.pushState(zones);
      });
      const newZones = useCanvasStore.getState().pasteClipboard(
        zones,
        WALL_WIDTH,
        WALL_HEIGHT,
        historyResult.current.pushState,
      );
      expect(newZones).toHaveLength(1);
      expect(newZones[0].x_mm).toBe(300); // 200 + 100 offset
      expect(newZones[0].y_mm).toBe(300); // 200 + 100 offset
      expect(newZones[0].zone_id).not.toBe('z1'); // New UUID
    });
    it('constrains pasted zone to wall boundary', () => {
      // Zone at the edge of the wall - paste offset would go beyond wall
      const zones = [makeZone({ zone_id: 'z1', x_mm: 2700, y_mm: 2100, width_mm: 300, height_mm: 300 })];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        clipboard: [makeZone({ zone_id: 'z1', x_mm: 2700, y_mm: 2100, width_mm: 300, height_mm: 300 })],
      });
      const { result: historyResult } = renderHook(() => useHistory());
      act(() => {
        historyResult.current.pushState(zones);
      });
      const newZones = useCanvasStore.getState().pasteClipboard(
        zones,
        WALL_WIDTH,
        WALL_HEIGHT,
        historyResult.current.pushState,
      );
      expect(newZones).toHaveLength(1);
      // Should be constrained: max x = 3000 - 300 = 2700, max y = 2400 - 300 = 2100
      expect(newZones[0].x_mm).toBeLessThanOrEqual(WALL_WIDTH - 300);
      expect(newZones[0].y_mm).toBeLessThanOrEqual(WALL_HEIGHT - 300);
    });
    it('avoids overlap with existing zones', () => {
      // z1 occupies 0-400 x 0-400, paste z1 would go to 100-500 x 100-500
      // but z_existing occupies 100-500 x 100-500
      const existingZone = makeZone({ zone_id: 'z_existing', x_mm: 100, y_mm: 100 });
      const zones = [
        makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0 }),
        existingZone,
      ];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        clipboard: [makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0 })],
      });
      const { result: historyResult } = renderHook(() => useHistory());
      act(() => {
        historyResult.current.pushState(zones);
      });
      const newZones = useCanvasStore.getState().pasteClipboard(
        zones,
        WALL_WIDTH,
        WALL_HEIGHT,
        historyResult.current.pushState,
      );
      expect(newZones).toHaveLength(1);
      // Should have moved to avoid overlap
      const pastedZone = newZones[0];
      const overlapWithExisting =
        pastedZone.x_mm < existingZone.x_mm + existingZone.width_mm &&
        pastedZone.x_mm + pastedZone.width_mm > existingZone.x_mm &&
        pastedZone.y_mm < existingZone.y_mm + existingZone.height_mm &&
        pastedZone.y_mm + pastedZone.height_mm > existingZone.y_mm;
      expect(overlapWithExisting).toBe(false);
    });
    it('pushes a single history entry', () => {
      const zones = [makeZone({ zone_id: 'z1', x_mm: 200, y_mm: 200 })];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        clipboard: [makeZone({ zone_id: 'z1', x_mm: 200, y_mm: 200 })],
      });
      const { result: historyResult } = renderHook(() => useHistory());
      act(() => {
        historyResult.current.pushState(zones);
      });
      const pushSpy = { count: 0 };
      const pushHistory = (z: TemplateZone[]) => {
        pushSpy.count++;
        historyResult.current.pushState(z);
      };
      useCanvasStore.getState().pasteClipboard(zones, WALL_WIDTH, WALL_HEIGHT, pushHistory);
      expect(pushSpy.count).toBe(1);
    });
    it('auto-selects pasted zones', () => {
      const zones = [makeZone({ zone_id: 'z1', x_mm: 200, y_mm: 200 })];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        clipboard: [
          makeZone({ zone_id: 'z1', x_mm: 200, y_mm: 200 }),
          makeZone({ zone_id: 'z2', x_mm: 700, y_mm: 200 }),
        ],
      });
      const { result: historyResult } = renderHook(() => useHistory());
      act(() => {
        historyResult.current.pushState(zones);
      });
      const newZones = useCanvasStore.getState().pasteClipboard(
        zones,
        WALL_WIDTH,
        WALL_HEIGHT,
        historyResult.current.pushState,
      );
      const { selection } = useCanvasStore.getState();
      expect(selection.selectedZoneIds).toHaveLength(2);
      expect(selection.selectedZoneIds).toEqual(newZones.map((z: TemplateZone) => z.zone_id));
    });
    it('returns empty array when clipboard is empty', () => {
      const zones = [makeZone({ zone_id: 'z1', x_mm: 200, y_mm: 200 })];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({ clipboard: null });
      const { result: historyResult } = renderHook(() => useHistory());
      const newZones = useCanvasStore.getState().pasteClipboard(
        zones,
        WALL_WIDTH,
        WALL_HEIGHT,
        historyResult.current.pushState,
      );
      expect(newZones).toHaveLength(0);
    });
  });
  describe('duplicateSelection', () => {
    it('duplicates selected zones with offset, avoiding overlaps', () => {
      const zones = [
        makeZone({ zone_id: 'z1', x_mm: 200, y_mm: 200 }),
        makeZone({ zone_id: 'z2', x_mm: 1500, y_mm: 200 }),
      ];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1'], resizeHandle: null, marqueeRect: null },
      });
      const { result: historyResult } = renderHook(() => useHistory());
      act(() => {
        historyResult.current.pushState(zones);
      });
      const newZones = useCanvasStore.getState().duplicateSelection(
        zones,
        WALL_WIDTH,
        WALL_HEIGHT,
        historyResult.current.pushState,
      );
      expect(newZones).toHaveLength(1);
      // Original zone z1 at 200-600, paste at 300-700 overlaps, so offset tries increase
      // until no overlap is found
      expect(newZones[0].zone_id).not.toBe('z1');
      expect(newZones[0].x_mm).toBeGreaterThanOrEqual(200 + 100);
      expect(newZones[0].y_mm).toBeGreaterThanOrEqual(200 + 100);
    });
    it('returns empty when no zones selected', () => {
      const zones = [makeZone({ zone_id: 'z1', x_mm: 200, y_mm: 200 })];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        selection: { selectedZoneId: null, selectedZoneIds: [], resizeHandle: null, marqueeRect: null },
      });
      const { result: historyResult } = renderHook(() => useHistory());
      const newZones = useCanvasStore.getState().duplicateSelection(
        zones,
        WALL_WIDTH,
        WALL_HEIGHT,
        historyResult.current.pushState,
      );
      expect(newZones).toHaveLength(0);
    });
  });
  describe('Keyboard shortcuts (Ctrl+C/V/D)', () => {
    it('Ctrl+C copies selected zones', () => {
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
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true });
      act(() => {
        shortcuts.current.handleKeyDown(event);
      });
      const { clipboard } = useCanvasStore.getState();
      expect(clipboard).toHaveLength(2);
    });
    it('Ctrl+V pastes clipboard with offset', () => {
      // Empty canvas so paste doesn't need overlap avoidance
      const zones: TemplateZone[] = [];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        clipboard: [makeZone({ zone_id: 'z1', x_mm: 200, y_mm: 200, width_mm: 200, height_mm: 200 })],
      });
      const { result } = renderHook(() => useHistory());
      act(() => {
        result.current.pushState(zones);
      });
      const { result: shortcuts } = renderHook(() =>
        useKeyboardShortcuts({ history: result.current }),
      );
      const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true });
      act(() => {
        shortcuts.current.handleKeyDown(event);
      });
      const updatedZones = useProjectStore.getState().zones;
      expect(updatedZones).toHaveLength(1);
      expect(updatedZones[0].x_mm).toBe(300); // 200 + 100 offset
      expect(updatedZones[0].y_mm).toBe(300);
    });
    it('Ctrl+D duplicates selected zones', () => {
      const zones = [makeZone({ zone_id: 'z1', x_mm: 200, y_mm: 200, width_mm: 200, height_mm: 200 })];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1'], resizeHandle: null, marqueeRect: null },
      });
      const { result } = renderHook(() => useHistory());
      act(() => {
        result.current.pushState(zones);
      });
      const { result: shortcuts } = renderHook(() =>
        useKeyboardShortcuts({ history: result.current }),
      );
      const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true });
      act(() => {
        shortcuts.current.handleKeyDown(event);
      });
      const updatedZones = useProjectStore.getState().zones;
      expect(updatedZones).toHaveLength(2);
      const duplicatedZone = updatedZones.find((z) => z.zone_id !== 'z1')!;
      // (300,300) overlaps (200-400,200-400), so moves to (400,400) which doesn't overlap
      expect(duplicatedZone.x_mm).toBe(400);
      expect(duplicatedZone.y_mm).toBe(400);
    });
    it('Ctrl+C does nothing in CONSULTANT mode', () => {
      const zones = [makeZone({ zone_id: 'z1', x_mm: 200, y_mm: 200 })];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        mode: CanvasMode.CONSULTANT,
        selection: { selectedZoneId: 'z1', selectedZoneIds: ['z1'], resizeHandle: null, marqueeRect: null },
      });
      const { result } = renderHook(() => useHistory());
      const { result: shortcuts } = renderHook(() =>
        useKeyboardShortcuts({ history: result.current }),
      );
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true });
      act(() => {
        shortcuts.current.handleKeyDown(event);
      });
      expect(useCanvasStore.getState().clipboard).toBeNull();
    });
    it('Ctrl+V does nothing in CONSULTANT mode', () => {
      const zones = [makeZone({ zone_id: 'z1', x_mm: 200, y_mm: 200 })];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        mode: CanvasMode.CONSULTANT,
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
      expect(useProjectStore.getState().zones).toHaveLength(1);
    });
    it('Ctrl+D does nothing in CONSULTANT mode', () => {
      const zones = [makeZone({ zone_id: 'z1', x_mm: 200, y_mm: 200 })];
      useProjectStore.setState({ zones });
      useCanvasStore.setState({
        mode: CanvasMode.CONSULTANT,
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
      expect(useProjectStore.getState().zones).toHaveLength(1);
    });
  });
});
