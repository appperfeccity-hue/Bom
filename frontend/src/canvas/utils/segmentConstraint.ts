/**
 * Pure function to detect whether a zone crosses the L_SHAPE (legacy L_CORNER) boundary.
 * Used to prevent zone creation/drag/resize across the corner.
 */

import type { BoundingBox } from '@/types/canvas';

export interface CornerPosition {
  x: number;
  y: number;
}

/**
 * Returns true if the zone straddles the corner boundary
 * (i.e., it starts before the corner and ends after the corner).
 */
export function doesZoneCrossCorner(
  zone: BoundingBox,
  cornerAt: CornerPosition,
): boolean {
  const leftEdge = zone.x;
  const rightEdge = zone.x + zone.width;

  return leftEdge < cornerAt.x && rightEdge > cornerAt.x;
}
