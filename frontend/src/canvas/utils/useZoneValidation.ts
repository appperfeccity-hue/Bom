import { useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import {
  hasOverlap,
  isWithinWallBoundary,
  isValidZoneDimensions,
} from './zoneConstraints';

export interface ZoneValidationState {
  errors: string[];
}

/**
 * Hook that computes validation state for all zones.
 * Returns a Map<zoneId, { errors: string[] }> where errors is an array
 * of human-readable error messages for each invalid zone.
 *
 * Checks performed per zone:
 * - hasOverlap: zone overlaps with another zone
 * - isOutOfBounds: zone extends beyond wall boundary
 * - isUndersized: zone dimensions are below the minimum (200x200mm)
 */
export function useZoneValidation(): Map<string, ZoneValidationState> {
  const zones = useProjectStore((s) => s.zones);
  const currentTemplate = useProjectStore((s) => s.currentTemplate);

  const wallWidth = currentTemplate?.base_width_mm ?? 0;
  const wallHeight = currentTemplate?.base_height_mm ?? 0;

  return useMemo(() => {
    const validationMap = new Map<string, ZoneValidationState>();

    for (const zone of zones) {
      const errors: string[] = [];

      const box = {
        x: zone.x_mm,
        y: zone.y_mm,
        width: zone.width_mm,
        height: zone.height_mm,
      };

      // Check overlap with other zones
      if (hasOverlap(box, zones, zone.id)) {
        errors.push('Zone overlaps with another zone');
      }

      // Check within wall boundary
      if (!isWithinWallBoundary(box, wallWidth, wallHeight)) {
        errors.push('Zone extends beyond wall boundary');
      }

      // Check minimum dimensions
      if (!isValidZoneDimensions(zone.width_mm, zone.height_mm)) {
        errors.push('Zone dimensions are below the minimum (200x200mm)');
      }

      if (errors.length > 0) {
        validationMap.set(zone.id, { errors });
      }
    }

    return validationMap;
  }, [zones, wallWidth, wallHeight]);
}
