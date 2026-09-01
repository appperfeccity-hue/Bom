/**
 * Installation Area semantics (spec sections 9-14).
 *
 * The installation area is the parent of zones: it is the region of the wall the
 * design actually covers. Zones are bounded by the installation-area OUTER EDGE,
 * not by the full wall. This module is pure geometry/validation; it adds no DB
 * authority. Existing DB rules stay authoritative:
 *   - one SKU per zone            -> uq_zone_single_sku (template_zone_sku)
 *   - zone dimension ranges       -> template_zone CHECK 200-3000 x 200-2700
 * The only genuinely new zone rule here is MAX_ZONES_PER_WALL.
 */

import type { InstallationArea, InstallationAreaCoverage, EdgeRect } from './types';

/** Spec sections 11 and 14: a wall may carry at most three zones. */
export const MAX_ZONES_PER_WALL = 3;

/** True when another zone may still be added to the wall. */
export function canAddZone(currentZoneCount: number): boolean {
  return currentZoneCount < MAX_ZONES_PER_WALL;
}

interface ZoneLike {
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
}

/**
 * Resolve the installation area for a wall. FULL coverage spans the whole wall;
 * PARTIAL coverage uses the authored outer edge, clamped to the wall.
 */
export function resolveInstallationArea(
  wall: { width_mm: number; height_mm: number },
  area?: Partial<InstallationArea> | null,
): InstallationArea {
  const coverage: InstallationAreaCoverage = area?.coverage ?? 'FULL';
  if (coverage === 'FULL' || !area?.outerEdge) {
    return {
      coverage: 'FULL',
      outerEdge: { x_mm: 0, y_mm: 0, width_mm: wall.width_mm, height_mm: wall.height_mm },
    };
  }
  const e = area.outerEdge;
  const x = Math.max(0, Math.min(e.x_mm, wall.width_mm));
  const y = Math.max(0, Math.min(e.y_mm, wall.height_mm));
  return {
    coverage: 'PARTIAL',
    outerEdge: {
      x_mm: x,
      y_mm: y,
      width_mm: Math.max(0, Math.min(e.width_mm, wall.width_mm - x)),
      height_mm: Math.max(0, Math.min(e.height_mm, wall.height_mm - y)),
    },
  };
}

/** The zone boundary against the installation area. */
export function zoneOuterEdge(zone: ZoneLike): EdgeRect {
  return {
    x_mm: zone.x_mm,
    y_mm: zone.y_mm,
    width_mm: zone.width_mm,
    height_mm: zone.height_mm,
  };
}

/**
 * The zone <-> SKU relationship boundary: the usable region inside the zone once
 * the zone-to-SKU inset (gaps/trims reserved at the zone border) is removed.
 */
export function zoneInnerEdge(zone: ZoneLike, insetMm = 0): EdgeRect {
  const inset = Math.max(0, insetMm);
  return {
    x_mm: zone.x_mm + inset,
    y_mm: zone.y_mm + inset,
    width_mm: Math.max(0, zone.width_mm - inset * 2),
    height_mm: Math.max(0, zone.height_mm - inset * 2),
  };
}

/** Derived zone area in mm^2 (never persisted). */
export function zoneArea(zone: ZoneLike): number {
  return zone.width_mm * zone.height_mm;
}

/** True when the zone lies entirely inside the installation-area outer edge. */
export function isZoneWithinInstallationArea(
  zone: ZoneLike,
  area: InstallationArea,
): boolean {
  const a = area.outerEdge;
  return (
    zone.x_mm >= a.x_mm &&
    zone.y_mm >= a.y_mm &&
    zone.x_mm + zone.width_mm <= a.x_mm + a.width_mm &&
    zone.y_mm + zone.height_mm <= a.y_mm + a.height_mm
  );
}
