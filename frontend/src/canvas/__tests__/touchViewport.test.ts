import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore, clampZoom } from '@/stores/canvasStore';

/**
 * Tests for touch viewport interactions (pinch-zoom calculation, two-finger pan).
 * Since the touch handlers rely on DOM touch events, we test the underlying
 * store operations and zoom/pan math that would be invoked by the handlers.
 */
describe('touchViewport', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      viewport: { zoom: 1.0, panX: 0, panY: 0 },
    });
  });

  describe('pinch-zoom calculation', () => {
    it('zoom increases when pinch distance grows', () => {
      const initialZoom = 1.0;
      const lastDistance = 100;
      const newDistance = 150;
      const scale = newDistance / lastDistance; // 1.5x
      const newZoom = clampZoom(initialZoom * scale);
      expect(newZoom).toBeCloseTo(1.5);
    });

    it('zoom decreases when pinch distance shrinks', () => {
      const initialZoom = 1.0;
      const lastDistance = 200;
      const newDistance = 100;
      const scale = newDistance / lastDistance; // 0.5x
      const newZoom = clampZoom(initialZoom * scale);
      expect(newZoom).toBeCloseTo(0.5);
    });

    it('clamps zoom to minimum (0.25)', () => {
      const initialZoom = 0.3;
      const lastDistance = 200;
      const newDistance = 50;
      const scale = newDistance / lastDistance; // 0.25
      const newZoom = clampZoom(initialZoom * scale);
      expect(newZoom).toBe(0.25);
    });

    it('clamps zoom to maximum (4.0)', () => {
      const initialZoom = 3.0;
      const lastDistance = 100;
      const newDistance = 200;
      const scale = newDistance / lastDistance; // 2x
      const newZoom = clampZoom(initialZoom * scale);
      expect(newZoom).toBe(4.0);
    });

    it('applies zoom to store via setZoom', () => {
      const store = useCanvasStore.getState();
      store.setZoom(2.0);
      expect(useCanvasStore.getState().viewport.zoom).toBe(2.0);
    });
  });

  describe('two-finger pan calculation', () => {
    it('panning translates the viewport by delta', () => {
      const store = useCanvasStore.getState();
      store.pan(50, -30);
      const { panX, panY } = useCanvasStore.getState().viewport;
      expect(panX).toBe(50);
      expect(panY).toBe(-30);
    });

    it('multiple pan operations accumulate', () => {
      const store = useCanvasStore.getState();
      store.pan(10, 20);
      store.pan(5, -10);
      const { panX, panY } = useCanvasStore.getState().viewport;
      expect(panX).toBe(15);
      expect(panY).toBe(10);
    });

    it('pan center delta calculation is correct', () => {
      // Simulating two touch points moving
      const lastCenter = { x: 200, y: 300 };
      const newCenter = { x: 220, y: 280 };
      const dx = newCenter.x - lastCenter.x;
      const dy = newCenter.y - lastCenter.y;
      expect(dx).toBe(20);
      expect(dy).toBe(-20);
    });
  });

  describe('combined pinch and pan', () => {
    it('simultaneous zoom and pan updates viewport correctly', () => {
      const store = useCanvasStore.getState();
      // Simulate: zoom from 1.0 to 1.5, then pan 30, -20
      store.setZoom(1.5);
      store.pan(30, -20);
      const { zoom, panX, panY } = useCanvasStore.getState().viewport;
      expect(zoom).toBe(1.5);
      expect(panX).toBe(30);
      expect(panY).toBe(-20);
    });
  });
});
