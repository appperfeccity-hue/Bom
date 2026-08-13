// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../canvasStore';
import { CanvasMode } from '@/types/database';
import type { TemplateZone } from '@/types/database';

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
    
    created_at: '2024-01-01',
    segment: null,
    segment: null,
  };
}

describe('canvasStore multi-select', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      selection: {
        selectedZoneId: null,
        selectedZoneIds: [],
        resizeHandle: null,
        marqueeRect: null,
      },
    });
  });

  describe('selectZone', () => {
    it('sets selectedZoneIds to single element array', () => {
      useCanvasStore.getState().selectZone('zone-1');
      const { selection } = useCanvasStore.getState();
      expect(selection.selectedZoneId).toBe('zone-1');
      expect(selection.selectedZoneIds).toEqual(['zone-1']);
      expect(selection.marqueeRect).toBeNull();
    });

    it('clears selectedZoneIds when called with null', () => {
      useCanvasStore.getState().selectZone('zone-1');
      useCanvasStore.getState().selectZone(null);
      const { selection } = useCanvasStore.getState();
      expect(selection.selectedZoneId).toBeNull();
      expect(selection.selectedZoneIds).toEqual([]);
    });
  });

  describe('toggleZoneSelection', () => {
    it('adds a zone to the selection', () => {
      useCanvasStore.getState().selectZone('zone-1');
      useCanvasStore.getState().toggleZoneSelection('zone-2');
      const { selection } = useCanvasStore.getState();
      expect(selection.selectedZoneIds).toEqual(['zone-1', 'zone-2']);
      expect(selection.selectedZoneId).toBe('zone-1');
    });

    it('removes a zone from the selection', () => {
      useCanvasStore.getState().selectZone('zone-1');
      useCanvasStore.getState().toggleZoneSelection('zone-2');
      useCanvasStore.getState().toggleZoneSelection('zone-1');
      const { selection } = useCanvasStore.getState();
      expect(selection.selectedZoneIds).toEqual(['zone-2']);
      expect(selection.selectedZoneId).toBe('zone-2');
    });

    it('results in empty selection when last zone is toggled off', () => {
      useCanvasStore.getState().selectZone('zone-1');
      useCanvasStore.getState().toggleZoneSelection('zone-1');
      const { selection } = useCanvasStore.getState();
      expect(selection.selectedZoneIds).toEqual([]);
      expect(selection.selectedZoneId).toBeNull();
    });
  });

  describe('selectZonesInRect', () => {
    const zones: TemplateZone[] = [
      makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0, width_mm: 400, height_mm: 400 }),
      makeZone({ zone_id: 'z2', x_mm: 500, y_mm: 0, width_mm: 400, height_mm: 400 }),
      makeZone({ zone_id: 'z3', x_mm: 1000, y_mm: 0, width_mm: 400, height_mm: 400 }),
    ];

    it('selects zones that intersect the rectangle', () => {
      // Rectangle that covers z1 and z2 but not z3
      useCanvasStore.getState().selectZonesInRect(
        { x: 0, y: 0, width: 900, height: 400 },
        zones,
      );
      const { selection } = useCanvasStore.getState();
      expect(selection.selectedZoneIds).toEqual(['z1', 'z2']);
    });

    it('returns empty selection for non-intersecting rectangle', () => {
      useCanvasStore.getState().selectZonesInRect(
        { x: 2000, y: 2000, width: 100, height: 100 },
        zones,
      );
      const { selection } = useCanvasStore.getState();
      expect(selection.selectedZoneIds).toEqual([]);
      expect(selection.selectedZoneId).toBeNull();
    });

    it('selects all zones for a large rectangle', () => {
      useCanvasStore.getState().selectZonesInRect(
        { x: 0, y: 0, width: 2000, height: 2000 },
        zones,
      );
      const { selection } = useCanvasStore.getState();
      expect(selection.selectedZoneIds).toEqual(['z1', 'z2', 'z3']);
    });
  });

  describe('setMarqueeRect', () => {
    it('sets the marquee rectangle', () => {
      const rect = { x: 10, y: 20, width: 300, height: 200 };
      useCanvasStore.getState().setMarqueeRect(rect);
      const { selection } = useCanvasStore.getState();
      expect(selection.marqueeRect).toEqual(rect);
    });

    it('clears the marquee rectangle', () => {
      useCanvasStore.getState().setMarqueeRect({ x: 10, y: 20, width: 300, height: 200 });
      useCanvasStore.getState().setMarqueeRect(null);
      const { selection } = useCanvasStore.getState();
      expect(selection.marqueeRect).toBeNull();
    });
  });

  describe('clearSelection', () => {
    it('clears all selection state including selectedZoneIds and marqueeRect', () => {
      useCanvasStore.getState().selectZone('zone-1');
      useCanvasStore.getState().toggleZoneSelection('zone-2');
      useCanvasStore.getState().setMarqueeRect({ x: 0, y: 0, width: 100, height: 100 });
      useCanvasStore.getState().clearSelection();
      const { selection } = useCanvasStore.getState();
      expect(selection.selectedZoneId).toBeNull();
      expect(selection.selectedZoneIds).toEqual([]);
      expect(selection.resizeHandle).toBeNull();
      expect(selection.marqueeRect).toBeNull();
    });
  });
});
