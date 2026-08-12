import { describe, it, expect } from 'vitest';
import {
  clampDimensions,
  isWithinWallBoundary,
  constrainToWall,
  doBoxesOverlap,
  hasOverlap,
  canAddZone,
  isValidZoneDimensions,
  MIN_ZONE_WIDTH,
  MIN_ZONE_HEIGHT,
  MAX_ZONE_WIDTH,
  MAX_ZONE_HEIGHT,
  MAX_ZONES_PER_WALL,
} from '@/canvas/utils/zoneConstraints';
import type { TemplateZone } from '@/types/database';
import { ZoneWidthStrategy, ZoneHeightStrategy, ZonePositionStrategy } from '@/types/database';

function makeZone(overrides: Partial<TemplateZone> = {}): TemplateZone {
  return {
    id: 'zone-1',
    template_id: 'tmpl-1',
    name: 'Test Zone',
    x_mm: 0,
    y_mm: 0,
    width_mm: 400,
    height_mm: 400,
    width_strategy: ZoneWidthStrategy.FIXED,
    height_strategy: ZoneHeightStrategy.FIXED,
    position_strategy: ZonePositionStrategy.ABSOLUTE,
    z_index: 0,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('zone size constraints', () => {
  it('zone cannot be smaller than 200x200mm', () => {
    expect(isValidZoneDimensions(100, 100)).toBe(false);
    expect(isValidZoneDimensions(199, 200)).toBe(false);
    expect(isValidZoneDimensions(200, 199)).toBe(false);
    expect(isValidZoneDimensions(200, 200)).toBe(true);
  });

  it('zone cannot be larger than 3000x2700mm', () => {
    expect(isValidZoneDimensions(3001, 2700)).toBe(false);
    expect(isValidZoneDimensions(3000, 2701)).toBe(false);
    expect(isValidZoneDimensions(3000, 2700)).toBe(true);
  });

  it('clampDimensions enforces min width', () => {
    const result = clampDimensions(100, 500);
    expect(result.width).toBe(MIN_ZONE_WIDTH);
  });

  it('clampDimensions enforces min height', () => {
    const result = clampDimensions(500, 50);
    expect(result.height).toBe(MIN_ZONE_HEIGHT);
  });

  it('clampDimensions enforces max width', () => {
    const result = clampDimensions(4000, 500);
    expect(result.width).toBe(MAX_ZONE_WIDTH);
  });

  it('clampDimensions enforces max height', () => {
    const result = clampDimensions(500, 3500);
    expect(result.height).toBe(MAX_ZONE_HEIGHT);
  });

  it('clampDimensions preserves valid dimensions', () => {
    const result = clampDimensions(500, 600);
    expect(result.width).toBe(500);
    expect(result.height).toBe(600);
  });
});

describe('wall boundary constraints', () => {
  const wallWidth = 3000;
  const wallHeight = 2400;

  it('zone fully inside wall is valid', () => {
    expect(isWithinWallBoundary({ x: 100, y: 100, width: 400, height: 400 }, wallWidth, wallHeight)).toBe(true);
  });

  it('zone at origin with full wall size is valid', () => {
    expect(isWithinWallBoundary({ x: 0, y: 0, width: wallWidth, height: wallHeight }, wallWidth, wallHeight)).toBe(true);
  });

  it('zone exceeding right boundary is invalid', () => {
    expect(isWithinWallBoundary({ x: 2800, y: 0, width: 400, height: 400 }, wallWidth, wallHeight)).toBe(false);
  });

  it('zone exceeding bottom boundary is invalid', () => {
    expect(isWithinWallBoundary({ x: 0, y: 2200, width: 400, height: 400 }, wallWidth, wallHeight)).toBe(false);
  });

  it('zone with negative x is invalid', () => {
    expect(isWithinWallBoundary({ x: -10, y: 0, width: 400, height: 400 }, wallWidth, wallHeight)).toBe(false);
  });

  it('zone with negative y is invalid', () => {
    expect(isWithinWallBoundary({ x: 0, y: -10, width: 400, height: 400 }, wallWidth, wallHeight)).toBe(false);
  });

  it('constrainToWall clamps position to keep zone inside', () => {
    const result = constrainToWall(2800, 2200, 400, 400, wallWidth, wallHeight);
    expect(result.x).toBe(2600); // wallWidth - width = 2600
    expect(result.y).toBe(2000); // wallHeight - height = 2000
  });

  it('constrainToWall clamps negative positions to 0', () => {
    const result = constrainToWall(-50, -100, 400, 400, wallWidth, wallHeight);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });
});

describe('overlap detection', () => {
  it('overlapping boxes return true', () => {
    const a = { x: 0, y: 0, width: 400, height: 400 };
    const b = { x: 200, y: 200, width: 400, height: 400 };
    expect(doBoxesOverlap(a, b)).toBe(true);
  });

  it('non-overlapping boxes return false', () => {
    const a = { x: 0, y: 0, width: 400, height: 400 };
    const b = { x: 500, y: 500, width: 400, height: 400 };
    expect(doBoxesOverlap(a, b)).toBe(false);
  });

  it('adjacent boxes (touching edges) do not overlap', () => {
    const a = { x: 0, y: 0, width: 400, height: 400 };
    const b = { x: 400, y: 0, width: 400, height: 400 };
    expect(doBoxesOverlap(a, b)).toBe(false);
  });

  it('hasOverlap detects overlap with existing zones', () => {
    const zones = [makeZone({ x_mm: 0, y_mm: 0, width_mm: 400, height_mm: 400 })];
    const newZone = { x: 200, y: 200, width: 400, height: 400 };
    expect(hasOverlap(newZone, zones)).toBe(true);
  });

  it('hasOverlap excludes self by id', () => {
    const zones = [makeZone({ id: 'zone-1', x_mm: 0, y_mm: 0, width_mm: 400, height_mm: 400 })];
    const updatedZone = { x: 100, y: 100, width: 300, height: 300 };
    expect(hasOverlap(updatedZone, zones, 'zone-1')).toBe(false);
  });

  it('hasOverlap returns false when no existing zones overlap', () => {
    const zones = [makeZone({ x_mm: 0, y_mm: 0, width_mm: 400, height_mm: 400 })];
    const newZone = { x: 500, y: 500, width: 400, height: 400 };
    expect(hasOverlap(newZone, zones)).toBe(false);
  });
});

describe('max zones per wall', () => {
  it('can add zone when count is below 12', () => {
    expect(canAddZone(0)).toBe(true);
    expect(canAddZone(11)).toBe(true);
  });

  it('cannot add zone when count is 12', () => {
    expect(canAddZone(12)).toBe(false);
    expect(canAddZone(MAX_ZONES_PER_WALL)).toBe(false);
  });

  it('cannot add zone when count exceeds 12', () => {
    expect(canAddZone(13)).toBe(false);
  });
});
