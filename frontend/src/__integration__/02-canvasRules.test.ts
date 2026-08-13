/**
 * Integration Test Area 2: Canvas -> Rules
 *
 * Validates that:
 * - Valid geometry passes validateGeometry with zones within wall bounds
 * - Mounting rules are deterministic (same input always produces same output)
 * - L-corner segments are correctly assigned via assignSegment
 * - doesZoneCrossCorner detects straddling zone
 */

import { describe, it, expect } from 'vitest';
import { validateGeometry } from '@/engines/validationEngine';
import type { GeometryZone, WallDimensions } from '@/engines/validationEngine';
import { assignSegment } from '@/canvas/utils/segmentAssignment';
import { doesZoneCrossCorner } from '@/canvas/utils/segmentConstraint';

describe('Integration Area 2: Canvas -> Rules', () => {
  describe('Valid geometry passes validation', () => {
    it('zones within wall bounds pass geometry validation', () => {
      const zones: GeometryZone[] = [
        { zoneId: 'z1', x: 0, y: 0, width: 1500, height: 2400, panelWidth: 600, panelHeight: 1200, gapHorizontal: 3, gapVertical: 3 },
        { zoneId: 'z2', x: 1500, y: 0, width: 1500, height: 2400, panelWidth: 600, panelHeight: 1200, gapHorizontal: 3, gapVertical: 3 },
      ];
      const wallDimensions: WallDimensions = { width: 3000, height: 2400 };

      const result = validateGeometry(zones, wallDimensions);

      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('single zone filling entire wall passes', () => {
      const zones: GeometryZone[] = [
        { zoneId: 'z1', x: 0, y: 0, width: 3000, height: 2400, panelWidth: 600, panelHeight: 1200, gapHorizontal: 3, gapVertical: 3 },
      ];
      const wallDimensions: WallDimensions = { width: 3000, height: 2400 };

      const result = validateGeometry(zones, wallDimensions);

      expect(result.passed).toBe(true);
    });

    it('zones at boundary edges (touching but not exceeding) pass', () => {
      const zones: GeometryZone[] = [
        { zoneId: 'z1', x: 0, y: 0, width: 1000, height: 2400 },
        { zoneId: 'z2', x: 1000, y: 0, width: 1000, height: 2400 },
        { zoneId: 'z3', x: 2000, y: 0, width: 1000, height: 2400 },
      ];
      const wallDimensions: WallDimensions = { width: 3000, height: 2400 };

      const result = validateGeometry(zones, wallDimensions);

      expect(result.passed).toBe(true);
    });
  });

  describe('Mounting rules are deterministic', () => {
    it('same construction input always produces same validation result', () => {
      const zones: GeometryZone[] = [
        { zoneId: 'z1', x: 0, y: 0, width: 1500, height: 2400, panelWidth: 600, panelHeight: 1200, gapHorizontal: 3, gapVertical: 3 },
        { zoneId: 'z2', x: 1500, y: 0, width: 1500, height: 2400, panelWidth: 600, panelHeight: 1200, gapHorizontal: 3, gapVertical: 3 },
      ];
      const wallDimensions: WallDimensions = { width: 3000, height: 2400 };

      const result1 = validateGeometry(zones, wallDimensions);
      const result2 = validateGeometry(zones, wallDimensions);
      const result3 = validateGeometry(zones, wallDimensions);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });

    it('invalid input always produces the same deterministic error', () => {
      const zones: GeometryZone[] = [
        { zoneId: 'z-over', x: 2800, y: 0, width: 500, height: 2400 },
      ];
      const wallDimensions: WallDimensions = { width: 3000, height: 2400 };

      const result1 = validateGeometry(zones, wallDimensions);
      const result2 = validateGeometry(zones, wallDimensions);

      expect(result1.passed).toBe(result2.passed);
      expect(result1.errors).toEqual(result2.errors);
    });
  });

  describe('L-corner segment assignment', () => {
    it('zone entirely in segment A is assigned SEGMENT_A', () => {
      const zone = { x_mm: 0, y_mm: 0, width_mm: 1000, height_mm: 2400 };
      const cornerAt = { x: 2000, y: 0 };

      const result = assignSegment(zone, cornerAt, 'L_CORNER');

      expect(result).toBe('SEGMENT_A');
    });

    it('zone entirely in segment B is assigned SEGMENT_B', () => {
      const zone = { x_mm: 2000, y_mm: 0, width_mm: 1500, height_mm: 2400 };
      const cornerAt = { x: 2000, y: 0 };

      const result = assignSegment(zone, cornerAt, 'L_CORNER');

      expect(result).toBe('SEGMENT_B');
    });

    it('zone straddling the corner returns null (invalid)', () => {
      const zone = { x_mm: 1500, y_mm: 0, width_mm: 1000, height_mm: 2400 };
      const cornerAt = { x: 2000, y: 0 };

      const result = assignSegment(zone, cornerAt, 'L_CORNER');

      expect(result).toBeNull();
    });

    it('STRAIGHT wall geometry always returns null (no segments)', () => {
      const zone = { x_mm: 0, y_mm: 0, width_mm: 1500, height_mm: 2400 };
      const cornerAt = { x: 2000, y: 0 };

      const result = assignSegment(zone, cornerAt, 'STRAIGHT');

      expect(result).toBeNull();
    });

    it('zone at exact corner boundary (right edge = cornerAt.x) is SEGMENT_A', () => {
      const zone = { x_mm: 1000, y_mm: 0, width_mm: 1000, height_mm: 2400 };
      const cornerAt = { x: 2000, y: 0 };

      const result = assignSegment(zone, cornerAt, 'L_CORNER');

      expect(result).toBe('SEGMENT_A');
    });

    it('zone starting at exact corner boundary (left edge = cornerAt.x) is SEGMENT_B', () => {
      const zone = { x_mm: 2000, y_mm: 0, width_mm: 500, height_mm: 2400 };
      const cornerAt = { x: 2000, y: 0 };

      const result = assignSegment(zone, cornerAt, 'L_CORNER');

      expect(result).toBe('SEGMENT_B');
    });
  });

  describe('doesZoneCrossCorner detection', () => {
    it('detects zone straddling the corner boundary', () => {
      const zone = { x: 1500, y: 0, width: 1000, height: 2400 };
      const cornerAt = { x: 2000, y: 0 };

      const result = doesZoneCrossCorner(zone, cornerAt);

      expect(result).toBe(true);
    });

    it('does not flag zone entirely before corner', () => {
      const zone = { x: 0, y: 0, width: 1000, height: 2400 };
      const cornerAt = { x: 2000, y: 0 };

      const result = doesZoneCrossCorner(zone, cornerAt);

      expect(result).toBe(false);
    });

    it('does not flag zone entirely after corner', () => {
      const zone = { x: 2000, y: 0, width: 1500, height: 2400 };
      const cornerAt = { x: 2000, y: 0 };

      const result = doesZoneCrossCorner(zone, cornerAt);

      expect(result).toBe(false);
    });

    it('does not flag zone ending exactly at corner', () => {
      const zone = { x: 1000, y: 0, width: 1000, height: 2400 };
      const cornerAt = { x: 2000, y: 0 };

      const result = doesZoneCrossCorner(zone, cornerAt);

      expect(result).toBe(false);
    });
  });
});
