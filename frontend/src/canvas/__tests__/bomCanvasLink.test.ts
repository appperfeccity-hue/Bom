import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@/stores/canvasStore';
import { useBomStore } from '@/stores/bomStore';
import type { MasterBomLine } from '@/types/database';

describe('BOM-Canvas bidirectional link', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      highlightedZoneIds: [],
      highlightedBomLineIds: [],
      selection: { selectedZoneId: null, selectedZoneIds: [], resizeHandle: null, marqueeRect: null },
    });
    useBomStore.setState({
      masterBomLines: [],
    });
  });

  describe('setHighlightedZoneIds', () => {
    it('sets highlighted zone IDs', () => {
      useCanvasStore.getState().setHighlightedZoneIds(['zone-1', 'zone-2']);
      expect(useCanvasStore.getState().highlightedZoneIds).toEqual(['zone-1', 'zone-2']);
    });

    it('clears highlighted zone IDs', () => {
      useCanvasStore.getState().setHighlightedZoneIds(['zone-1']);
      useCanvasStore.getState().setHighlightedZoneIds([]);
      expect(useCanvasStore.getState().highlightedZoneIds).toEqual([]);
    });
  });

  describe('setHighlightedBomLineIds', () => {
    it('sets highlighted BOM line IDs', () => {
      useCanvasStore.getState().setHighlightedBomLineIds(['line-1', 'line-2']);
      expect(useCanvasStore.getState().highlightedBomLineIds).toEqual(['line-1', 'line-2']);
    });

    it('clears highlighted BOM line IDs', () => {
      useCanvasStore.getState().setHighlightedBomLineIds(['line-1']);
      useCanvasStore.getState().setHighlightedBomLineIds([]);
      expect(useCanvasStore.getState().highlightedBomLineIds).toEqual([]);
    });
  });

  describe('Zone selection highlights BOM lines', () => {
    it('identifies BOM lines matching a zone via source_zone_id', () => {
      const bomLines: Partial<MasterBomLine>[] = [
        { master_bom_line_id: 'line-1', source_zone_id: 'zone-1', sku_id: 'sku-1', product_type: 'WALL_PANEL' as any },
        { master_bom_line_id: 'line-2', source_zone_id: 'zone-1', sku_id: 'sku-2', product_type: 'LIGHT' as any },
        { master_bom_line_id: 'line-3', source_zone_id: 'zone-2', sku_id: 'sku-3', product_type: 'WALL_PANEL' as any },
        { master_bom_line_id: 'line-4', source_zone_id: null, sku_id: 'sku-4', product_type: 'FURNITURE' as any },
      ];
      useBomStore.setState({ masterBomLines: bomLines as MasterBomLine[] });

      // Simulate what ZonesLayer click handler does
      const zoneId = 'zone-1';
      const masterBomLines = useBomStore.getState().masterBomLines;
      const matchingLineIds = masterBomLines
        .filter((line) => line.source_zone_id === zoneId)
        .map((line) => line.master_bom_line_id);

      useCanvasStore.getState().setHighlightedBomLineIds(matchingLineIds);

      const state = useCanvasStore.getState();
      expect(state.highlightedBomLineIds).toEqual(['line-1', 'line-2']);
    });

    it('returns empty when zone has no BOM lines', () => {
      const bomLines: Partial<MasterBomLine>[] = [
        { master_bom_line_id: 'line-1', source_zone_id: 'zone-2', sku_id: 'sku-1', product_type: 'WALL_PANEL' as any },
      ];
      useBomStore.setState({ masterBomLines: bomLines as MasterBomLine[] });

      const zoneId = 'zone-99';
      const masterBomLines = useBomStore.getState().masterBomLines;
      const matchingLineIds = masterBomLines
        .filter((line) => line.source_zone_id === zoneId)
        .map((line) => line.master_bom_line_id);

      useCanvasStore.getState().setHighlightedBomLineIds(matchingLineIds);

      expect(useCanvasStore.getState().highlightedBomLineIds).toEqual([]);
    });
  });

  describe('BOM line hover highlights zone', () => {
    it('highlights zone when BOM line has source_zone_id', () => {
      // Simulate what BomSectionTable does on hover
      const line = { source_zone_id: 'zone-1' };
      if (line.source_zone_id) {
        useCanvasStore.getState().setHighlightedZoneIds([line.source_zone_id]);
      }

      expect(useCanvasStore.getState().highlightedZoneIds).toEqual(['zone-1']);
    });

    it('does not highlight when BOM line has no source_zone_id', () => {
      const line = { source_zone_id: null };
      if (line.source_zone_id) {
        useCanvasStore.getState().setHighlightedZoneIds([line.source_zone_id]);
      }

      expect(useCanvasStore.getState().highlightedZoneIds).toEqual([]);
    });

    it('clears highlight on mouse leave', () => {
      useCanvasStore.getState().setHighlightedZoneIds(['zone-1']);
      // On mouse leave
      useCanvasStore.getState().setHighlightedZoneIds([]);
      expect(useCanvasStore.getState().highlightedZoneIds).toEqual([]);
    });
  });

  describe('Highlight state is separate from selection', () => {
    it('highlight does not affect selection state', () => {
      useCanvasStore.getState().selectZone('zone-1');
      useCanvasStore.getState().setHighlightedZoneIds(['zone-2']);

      const state = useCanvasStore.getState();
      expect(state.selection.selectedZoneIds).toEqual(['zone-1']);
      expect(state.highlightedZoneIds).toEqual(['zone-2']);
    });

    it('selection does not affect highlight state', () => {
      useCanvasStore.getState().setHighlightedZoneIds(['zone-2']);
      useCanvasStore.getState().selectZone('zone-1');

      const state = useCanvasStore.getState();
      expect(state.highlightedZoneIds).toEqual(['zone-2']);
      expect(state.selection.selectedZoneIds).toEqual(['zone-1']);
    });
  });
});
