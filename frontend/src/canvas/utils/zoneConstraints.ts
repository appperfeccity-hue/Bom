/**
 * Pure functions for zone constraint validation.
 * All spatial values are in integer millimetres (mm).
 */

import type { TemplateZone } from '@/types/database';
import type { BoundingBox } from '@/types/canvas';

/** Minimum zone dimensions in mm. */
export const MIN_ZONE_WIDTH = 200;
export const MIN_ZONE_HEIGHT = 200;

/** Maximum zone dimensions in mm. */
export const MAX_ZONE_WIDTH = 3000;
export const MAX_ZONE_HEIGHT = 2700;

/** Maximum number of zones per wall. */
export const MAX_ZONES_PER_WALL = 12;

/**
 * Clamp a zone's dimensions to valid min/max bounds.
 */
export function clampDimensions(
  width: number,
  height: number,
): { width: number; height: number } {
  return {
    width: Math.min(MAX_ZONE_WIDTH, Math.max(MIN_ZONE_WIDTH, width)),
    height: Math.min(MAX_ZONE_HEIGHT, Math.max(MIN_ZONE_HEIGHT, height)),
  };
}

/**
 * Check if a zone fits within the wall boundary.
 */
export function isWithinWallBoundary(
  zone: BoundingBox,
  wallWidth: number,
  wallHeight: number,
): boolean {
  return (
    zone.x >= 0 &&
    zone.y >= 0 &&
    zone.x + zone.width <= wallWidth &&
    zone.y + zone.height <= wallHeight
  );
}

/**
 * Constrain a zone position to stay within wall boundary.
 */
export function constrainToWall(
  x: number,
  y: number,
  width: number,
  height: number,
  wallWidth: number,
  wallHeight: number,
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(x, wallWidth - width)),
    y: Math.max(0, Math.min(y, wallHeight - height)),
  };
}

/**
 * Check if two bounding boxes overlap.
 */
export function doBoxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Check if a zone overlaps with any existing zones.
 * Excludes the zone itself (by id) when updating an existing zone.
 */
export function hasOverlap(
  zone: BoundingBox,
  existingZones: TemplateZone[],
  excludeId?: string,
): boolean {
  return existingZones.some((existing) => {
    if (excludeId && existing.id === excludeId) return false;
    const existingBox: BoundingBox = {
      x: existing.x_mm,
      y: existing.y_mm,
      width: existing.width_mm,
      height: existing.height_mm,
    };
    return doBoxesOverlap(zone, existingBox);
  });
}

/**
 * Check if a new zone can be added (max 12 zones per wall).
 */
export function canAddZone(currentZoneCount: number): boolean {
  return currentZoneCount < MAX_ZONES_PER_WALL;
}

/**
 * Validate that a zone meets all dimensional constraints.
 */
export function isValidZoneDimensions(width: number, height: number): boolean {
  return (
    width >= MIN_ZONE_WIDTH &&
    width <= MAX_ZONE_WIDTH &&
    height >= MIN_ZONE_HEIGHT &&
    height <= MAX_ZONE_HEIGHT
  );
}
