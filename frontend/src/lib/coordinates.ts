import type { Point, ViewportState } from '@/types/canvas';

/**
 * Convert a point from canvas coordinates (bottom-left origin, mm)
 * to Konva screen coordinates (top-left origin, pixels).
 *
 * The key transform: screenY = wallHeight - canvasY
 * Then apply viewport zoom and pan.
 */
export function canvasToScreen(
  point: Point,
  wallHeight: number,
  viewport: ViewportState,
): Point {
  const flippedY = wallHeight - point.y;
  return {
    x: point.x * viewport.zoom + viewport.panX,
    y: flippedY * viewport.zoom + viewport.panY,
  };
}

/**
 * Convert a point from Konva screen coordinates (top-left origin, pixels)
 * to canvas coordinates (bottom-left origin, mm).
 *
 * Inverse of canvasToScreen.
 */
export function screenToCanvas(
  point: Point,
  wallHeight: number,
  viewport: ViewportState,
): Point {
  const mmX = (point.x - viewport.panX) / viewport.zoom;
  const mmY = (point.y - viewport.panY) / viewport.zoom;
  return {
    x: mmX,
    y: wallHeight - mmY,
  };
}

/**
 * Snap a point to the nearest grid intersection.
 * Uses standard rounding: values at exactly the midpoint round up.
 */
export function snapToGrid(value: number, gridSize: number): number {
  const result = Math.round(value / gridSize) * gridSize;
  // Avoid returning -0 (which is === 0 but not Object.is(0))
  return result === 0 ? 0 : result;
}

/**
 * Snap a Point to the nearest grid intersections.
 */
export function snapPointToGrid(point: Point, gridSize: number): Point {
  return {
    x: snapToGrid(point.x, gridSize),
    y: snapToGrid(point.y, gridSize),
  };
}

/**
 * Convert millimetres to screen pixels given the current zoom level.
 */
export function mmToPixels(mm: number, zoom: number): number {
  return mm * zoom;
}

/**
 * Convert screen pixels to millimetres given the current zoom level.
 */
export function pixelsToMm(px: number, zoom: number): number {
  return px / zoom;
}
