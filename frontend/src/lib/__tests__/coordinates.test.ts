import { describe, it, expect } from 'vitest';
import {
  canvasToScreen,
  screenToCanvas,
  snapToGrid,
  snapPointToGrid,
  mmToPixels,
  pixelsToMm,
} from '../coordinates';
import type { Point, ViewportState } from '@/types/canvas';

describe('coordinates', () => {
  const defaultViewport: ViewportState = { zoom: 1.0, panX: 0, panY: 0 };
  const wallHeight = 2700; // mm

  describe('canvasToScreen', () => {
    it('should flip Y axis - bottom-left origin to top-left origin', () => {
      // Point at canvas origin (0, 0) in bottom-left
      // should map to (0, wallHeight) in top-left screen coords
      const result = canvasToScreen({ x: 0, y: 0 }, wallHeight, defaultViewport);
      expect(result.x).toBe(0);
      expect(result.y).toBe(2700);
    });

    it('should map top-left canvas point correctly', () => {
      // Point at top-left in canvas coords (0, wallHeight)
      // should map to (0, 0) in screen coords
      const result = canvasToScreen({ x: 0, y: 2700 }, wallHeight, defaultViewport);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('should apply zoom correctly', () => {
      const viewport: ViewportState = { zoom: 2.0, panX: 0, panY: 0 };
      const result = canvasToScreen({ x: 100, y: 200 }, wallHeight, viewport);
      // screenX = 100 * 2 = 200
      // screenY = (2700 - 200) * 2 = 5000
      expect(result.x).toBe(200);
      expect(result.y).toBe(5000);
    });

    it('should apply pan offset correctly', () => {
      const viewport: ViewportState = { zoom: 1.0, panX: 50, panY: 30 };
      const result = canvasToScreen({ x: 100, y: 100 }, wallHeight, viewport);
      // screenX = 100 * 1 + 50 = 150
      // screenY = (2700 - 100) * 1 + 30 = 2630
      expect(result.x).toBe(150);
      expect(result.y).toBe(2630);
    });

    it('should handle center point', () => {
      const result = canvasToScreen({ x: 1000, y: 1350 }, wallHeight, defaultViewport);
      // screenY = 2700 - 1350 = 1350
      expect(result.x).toBe(1000);
      expect(result.y).toBe(1350);
    });
  });

  describe('screenToCanvas', () => {
    it('should be the inverse of canvasToScreen', () => {
      const original: Point = { x: 500, y: 1200 };
      const viewport: ViewportState = { zoom: 1.5, panX: 20, panY: 40 };

      const screen = canvasToScreen(original, wallHeight, viewport);
      const result = screenToCanvas(screen, wallHeight, viewport);

      expect(result.x).toBeCloseTo(original.x, 10);
      expect(result.y).toBeCloseTo(original.y, 10);
    });

    it('should convert screen origin to canvas top-left', () => {
      const result = screenToCanvas({ x: 0, y: 0 }, wallHeight, defaultViewport);
      expect(result.x).toBe(0);
      expect(result.y).toBe(2700); // top in screen = top in canvas (max Y)
    });

    it('should convert screen bottom-left to canvas origin', () => {
      const result = screenToCanvas({ x: 0, y: 2700 }, wallHeight, defaultViewport);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('should handle zoom in inverse', () => {
      const viewport: ViewportState = { zoom: 2.0, panX: 0, panY: 0 };
      const result = screenToCanvas({ x: 200, y: 5000 }, wallHeight, viewport);
      expect(result.x).toBeCloseTo(100, 10);
      expect(result.y).toBeCloseTo(200, 10);
    });
  });

  describe('snapToGrid', () => {
    it('should snap 150 to 200 (rounds up at midpoint)', () => {
      expect(snapToGrid(150, 100)).toBe(200);
    });

    it('should snap 149 to 100 (rounds down below midpoint)', () => {
      expect(snapToGrid(149, 100)).toBe(100);
    });

    it('should snap exact grid values to themselves', () => {
      expect(snapToGrid(0, 100)).toBe(0);
      expect(snapToGrid(100, 100)).toBe(100);
      expect(snapToGrid(200, 100)).toBe(200);
      expect(snapToGrid(1000, 100)).toBe(1000);
    });

    it('should snap negative values correctly', () => {
      expect(snapToGrid(-50, 100)).toBe(0);
      expect(snapToGrid(-51, 100)).toBe(-100);
    });

    it('should handle small grid sizes', () => {
      expect(snapToGrid(7, 10)).toBe(10);
      expect(snapToGrid(4, 10)).toBe(0);
      expect(snapToGrid(5, 10)).toBe(10);
    });

    it('should handle value at boundary between grid lines', () => {
      expect(snapToGrid(50, 100)).toBe(100);
      expect(snapToGrid(250, 100)).toBe(300);
    });
  });

  describe('snapPointToGrid', () => {
    it('should snap both coordinates of a point', () => {
      const result = snapPointToGrid({ x: 150, y: 249 }, 100);
      expect(result.x).toBe(200);
      expect(result.y).toBe(200);
    });
  });

  describe('mmToPixels', () => {
    it('should convert mm to pixels at zoom 1', () => {
      expect(mmToPixels(100, 1.0)).toBe(100);
    });

    it('should scale mm by zoom factor', () => {
      expect(mmToPixels(100, 2.0)).toBe(200);
      expect(mmToPixels(100, 0.5)).toBe(50);
    });
  });

  describe('pixelsToMm', () => {
    it('should convert pixels to mm at zoom 1', () => {
      expect(pixelsToMm(100, 1.0)).toBe(100);
    });

    it('should inverse zoom factor', () => {
      expect(pixelsToMm(200, 2.0)).toBe(100);
      expect(pixelsToMm(50, 0.5)).toBe(100);
    });

    it('should be inverse of mmToPixels', () => {
      const mm = 350;
      const zoom = 1.75;
      expect(pixelsToMm(mmToPixels(mm, zoom), zoom)).toBeCloseTo(mm, 10);
    });
  });
});
