import type { BoundingBox } from '@/types/canvas';
import type { TemplateZone } from '@/types/database';

/** Default snap threshold in mm. */
export const SNAP_THRESHOLD = 10;

export interface SnapLines {
  vertical: number[];
  horizontal: number[];
}

export interface SnapResult {
  x: number;
  y: number;
  snappedVertical: number | null;
  snappedHorizontal: number | null;
}

/**
 * Collects all candidate snap positions from other zones and wall edges.
 * Returns unique vertical (x) and horizontal (y) positions.
 */
export function getSnapCandidates(
  otherZones: TemplateZone[],
  wallWidth: number,
  wallHeight: number,
): SnapLines {
  const vertical = new Set<number>();
  const horizontal = new Set<number>();

  // Wall edges
  vertical.add(0);
  vertical.add(wallWidth);
  horizontal.add(0);
  horizontal.add(wallHeight);

  // All 4 edges of each zone
  for (const zone of otherZones) {
    vertical.add(zone.x_mm);
    vertical.add(zone.x_mm + zone.width_mm);
    horizontal.add(zone.y_mm);
    horizontal.add(zone.y_mm + zone.height_mm);
  }

  return {
    vertical: Array.from(vertical),
    horizontal: Array.from(horizontal),
  };
}

/**
 * Find snap lines within threshold for the moving zone's edges.
 * Returns only those candidate lines that the moving zone is close enough to snap to.
 */
export function findSnapLines(
  movingZone: BoundingBox,
  otherZones: TemplateZone[],
  wallWidth: number,
  wallHeight: number,
  threshold: number = SNAP_THRESHOLD,
): SnapLines {
  const candidates = getSnapCandidates(otherZones, wallWidth, wallHeight);

  const movingEdges = {
    left: movingZone.x,
    right: movingZone.x + movingZone.width,
    top: movingZone.y + movingZone.height,
    bottom: movingZone.y,
  };

  const matchedVertical: number[] = [];
  const matchedHorizontal: number[] = [];

  for (const v of candidates.vertical) {
    if (
      Math.abs(movingEdges.left - v) <= threshold ||
      Math.abs(movingEdges.right - v) <= threshold
    ) {
      matchedVertical.push(v);
    }
  }

  for (const h of candidates.horizontal) {
    if (
      Math.abs(movingEdges.bottom - h) <= threshold ||
      Math.abs(movingEdges.top - h) <= threshold
    ) {
      matchedHorizontal.push(h);
    }
  }

  return {
    vertical: matchedVertical,
    horizontal: matchedHorizontal,
  };
}

/**
 * Adjust position to snap the closest edge to the nearest snap line within threshold.
 * Returns adjusted (x, y) and which lines were snapped to.
 */
export function snapToEdges(
  x: number,
  y: number,
  width: number,
  height: number,
  candidates: SnapLines,
  threshold: number = SNAP_THRESHOLD,
): SnapResult {
  let snappedX = x;
  let snappedY = y;
  let snappedVertical: number | null = null;
  let snappedHorizontal: number | null = null;

  // Check vertical (x) snap: left edge and right edge
  let minVDist = threshold + 1;
  for (const v of candidates.vertical) {
    const distLeft = Math.abs(x - v);
    const distRight = Math.abs(x + width - v);

    if (distLeft < minVDist) {
      minVDist = distLeft;
      snappedX = v;
      snappedVertical = v;
    }
    if (distRight < minVDist) {
      minVDist = distRight;
      snappedX = v - width;
      snappedVertical = v;
    }
  }

  // Check horizontal (y) snap: bottom edge and top edge
  let minHDist = threshold + 1;
  for (const h of candidates.horizontal) {
    const distBottom = Math.abs(y - h);
    const distTop = Math.abs(y + height - h);

    if (distBottom < minHDist) {
      minHDist = distBottom;
      snappedY = h;
      snappedHorizontal = h;
    }
    if (distTop < minHDist) {
      minHDist = distTop;
      snappedY = h - height;
      snappedHorizontal = h;
    }
  }

  return { x: snappedX, y: snappedY, snappedVertical, snappedHorizontal };
}
