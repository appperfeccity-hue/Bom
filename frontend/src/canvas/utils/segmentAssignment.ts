/**
 * Pure function for auto-assigning zones to SEGMENT_A or SEGMENT_B
 * based on their position relative to the corner boundary in L_SHAPE templates.
 */

import type { WallGeometryType } from '@/types/database';
import { isLShape } from '@/engines/wallType';

export interface ZoneBounds {
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
}

export interface CornerPosition {
  x: number;
  y: number;
}

/**
 * Determines which segment a zone belongs to based on its position.
 *
 * For STRAIGHT walls: returns null (no segments).
 * For L_SHAPE (legacy L_CORNER):
 *   - If zone's right edge <= cornerAt.x => SEGMENT_A
 *   - If zone's left edge >= cornerAt.x => SEGMENT_B
 *   - If zone straddles the corner => null (invalid state)
 */
export function assignSegment(
  zone: ZoneBounds,
  cornerAt: CornerPosition,
  wallGeometry: WallGeometryType,
): 'SEGMENT_A' | 'SEGMENT_B' | null {
  if (!isLShape(wallGeometry)) return null;

  const rightEdge = zone.x_mm + zone.width_mm;
  const leftEdge = zone.x_mm;

  if (rightEdge <= cornerAt.x) {
    return 'SEGMENT_A';
  }

  if (leftEdge >= cornerAt.x) {
    return 'SEGMENT_B';
  }

  // Zone straddles the corner boundary - invalid state
  return null;
}
