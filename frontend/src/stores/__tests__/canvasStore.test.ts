import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore, clampZoom, MIN_ZOOM, MAX_ZOOM } from '../canvasStore';
import { CanvasLayer } from '@/types/canvas';
import { CanvasMode } from '@/types/database';

describe('canvasStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      viewport: { zoom: 1.0, panX: 0, panY: 0 },
      gridConfig: { size: 100, snapEnabled: true },
      layerVisibility: {
        [CanvasLayer.GRID]: true,
        [CanvasLayer.WALL_OUTLINE]: true,
        [CanvasLayer.ZONES]: true,
        [CanvasLayer.SKU_PLACEMENT]: true,
        [CanvasLayer.LIGHTING]: true,
        [CanvasLayer.FURNITURE]: true,
        [CanvasLayer.TRIMS]: true,
        [CanvasLayer.MEASUREMENTS]: true,
        [CanvasLayer.SELECTION]: true,
        [CanvasLayer.GRID_OVERLAY]: true,
      },
      selection: { selectedZoneId: null, selectedZoneIds: [], resizeHandle: null, marqueeRect: null },
      saveStatus: 'saved',
      version: 1,
    });
  });

  describe('clampZoom', () => {
    it('should clamp zoom below minimum to 0.25', () => {
      expect(clampZoom(0.1)).toBe(MIN_ZOOM);
      expect(clampZoom(0)).toBe(MIN_ZOOM);
      expect(clampZoom(-1)).toBe(MIN_ZOOM);
    });

    it('should clamp zoom above maximum to 4.0', () => {
      expect(clampZoom(5)).toBe(MAX_ZOOM);
      expect(clampZoom(10)).toBe(MAX_ZOOM);
      expect(clampZoom(4.1)).toBe(MAX_ZOOM);
    });

    it('should pass through valid zoom values', () => {
      expect(clampZoom(1.0)).toBe(1.0);
      expect(clampZoom(0.25)).toBe(0.25);
      expect(clampZoom(4.0)).toBe(4.0);
      expect(clampZoom(2.5)).toBe(2.5);
    });
  });

  describe('setZoom', () => {
    it('should clamp zoom to minimum when setting below MIN_ZOOM', () => {
      useCanvasStore.getState().setZoom(0.1);
      expect(useCanvasStore.getState().viewport.zoom).toBe(MIN_ZOOM);
    });

    it('should clamp zoom to maximum when setting above MAX_ZOOM', () => {
      useCanvasStore.getState().setZoom(5.0);
      expect(useCanvasStore.getState().viewport.zoom).toBe(MAX_ZOOM);
    });

    it('should set valid zoom levels', () => {
      useCanvasStore.getState().setZoom(2.0);
      expect(useCanvasStore.getState().viewport.zoom).toBe(2.0);
    });
  });

  describe('layer visibility', () => {
    it('should toggle layer visibility', () => {
      const store = useCanvasStore.getState();
      expect(store.layerVisibility[CanvasLayer.GRID]).toBe(true);

      store.toggleLayer(CanvasLayer.GRID);
      expect(useCanvasStore.getState().layerVisibility[CanvasLayer.GRID]).toBe(false);

      useCanvasStore.getState().toggleLayer(CanvasLayer.GRID);
      expect(useCanvasStore.getState().layerVisibility[CanvasLayer.GRID]).toBe(true);
    });

    it('should set specific layer visibility', () => {
      useCanvasStore.getState().setLayerVisibility(CanvasLayer.ZONES, false);
      expect(useCanvasStore.getState().layerVisibility[CanvasLayer.ZONES]).toBe(false);
    });
  });

  describe('selection', () => {
    it('should select a zone', () => {
      useCanvasStore.getState().selectZone('zone-1');
      const state = useCanvasStore.getState();
      expect(state.selection.selectedZoneId).toBe('zone-1');
      expect(state.selection.resizeHandle).toBeNull();
    });

    it('should clear selection', () => {
      useCanvasStore.getState().selectZone('zone-1');
      useCanvasStore.getState().clearSelection();
      const state = useCanvasStore.getState();
      expect(state.selection.selectedZoneId).toBeNull();
      expect(state.selection.resizeHandle).toBeNull();
    });

    it('should set resize handle', () => {
      useCanvasStore.getState().selectZone('zone-1');
      useCanvasStore.getState().setResizeHandle('nw');
      expect(useCanvasStore.getState().selection.resizeHandle).toBe('nw');
    });
  });

  describe('pan', () => {
    it('should update pan position', () => {
      useCanvasStore.getState().pan(10, 20);
      const { panX, panY } = useCanvasStore.getState().viewport;
      expect(panX).toBe(10);
      expect(panY).toBe(20);
    });

    it('should accumulate pan values', () => {
      useCanvasStore.getState().pan(10, 20);
      useCanvasStore.getState().pan(5, -10);
      const { panX, panY } = useCanvasStore.getState().viewport;
      expect(panX).toBe(15);
      expect(panY).toBe(10);
    });
  });

  describe('mode', () => {
    it('should switch mode', () => {
      useCanvasStore.getState().setMode(CanvasMode.CONSULTANT);
      expect(useCanvasStore.getState().mode).toBe(CanvasMode.CONSULTANT);
    });
  });

  describe('save status', () => {
    it('should update save status', () => {
      useCanvasStore.getState().setSaveStatus('unsaved');
      expect(useCanvasStore.getState().saveStatus).toBe('unsaved');

      useCanvasStore.getState().setSaveStatus('saving');
      expect(useCanvasStore.getState().saveStatus).toBe('saving');

      useCanvasStore.getState().setSaveStatus('saved');
      expect(useCanvasStore.getState().saveStatus).toBe('saved');
    });
  });

  describe('version', () => {
    it('should increment version for optimistic locking', () => {
      expect(useCanvasStore.getState().version).toBe(1);
      useCanvasStore.getState().incrementVersion();
      expect(useCanvasStore.getState().version).toBe(2);
    });
  });
});
