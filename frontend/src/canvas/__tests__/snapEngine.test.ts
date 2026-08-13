import { describe, it, expect } from 'vitest';
import {
  getSnapCandidates,
  findSnapLines,
  snapToEdges,
  SNAP_THRESHOLD,
} from '@/canvas/utils/snapEngine';
import type { TemplateZone } from '@/types/database';

function makeZone(overrides: Partial<TemplateZone> & { x_mm: number; y_mm: number; width_mm: number; height_mm: number }): TemplateZone {
  const { x_mm, y_mm, width_mm, height_mm, ...rest } = overrides;
  return {
    zone_id: 'zone-1',
    template_id: 'tpl-1',
    zone_type: 'PRODUCT_DISPLAY',
    min_width_mm: 200,
    max_width_mm: 2000,
    min_height_mm: 200,
    max_height_mm: 2000,
    segment: null,
    created_at: '2024-01-01T00:00:00Z',
    ...rest,
    x_mm,
    y_mm,
    width_mm,
    height_mm,
  } as TemplateZone;
}

describe('snapEngine', () => {
  describe('getSnapCandidates', () => {
    it('returns wall edges when no other zones exist', () => {
      const result = getSnapCandidates([], 3000, 2400);
      expect(result.vertical).toContain(0);
      expect(result.vertical).toContain(3000);
      expect(result.horizontal).toContain(0);
      expect(result.horizontal).toContain(2400);
    });

    it('includes all 4 edges of other zones', () => {
      const zones = [makeZone({ x_mm: 100, y_mm: 200, width_mm: 500, height_mm: 400 })];
      const result = getSnapCandidates(zones, 3000, 2400);
      expect(result.vertical).toContain(100);
      expect(result.vertical).toContain(600); // 100+500
      expect(result.horizontal).toContain(200);
      expect(result.horizontal).toContain(600); // 200+400
    });

    it('deduplicates overlapping edges from multiple zones', () => {
      const zones = [
        makeZone({ zone_id: 'z1', x_mm: 0, y_mm: 0, width_mm: 500, height_mm: 400 }),
        makeZone({ zone_id: 'z2', x_mm: 500, y_mm: 0, width_mm: 500, height_mm: 400 }),
      ];
      const result = getSnapCandidates(zones, 3000, 2400);
      // x=500 appears from z1.right and z2.left, but should be in list only once
      const count500 = result.vertical.filter((v) => v === 500).length;
      expect(count500).toBe(1);
    });
  });

  describe('findSnapLines', () => {
    it('returns matching snap lines within threshold', () => {
      const zones = [makeZone({ zone_id: 'z2', x_mm: 500, y_mm: 0, width_mm: 400, height_mm: 300 })];
      // Moving zone: right edge at 495 (x=95, w=400), within 10mm of z2.left at 500
      const movingBox = { x: 95, y: 0, width: 400, height: 300 };
      const result = findSnapLines(movingBox, zones, 3000, 2400, SNAP_THRESHOLD);
      expect(result.vertical).toContain(500);
    });

    it('excludes snap lines beyond threshold', () => {
      const zones = [makeZone({ zone_id: 'z2', x_mm: 500, y_mm: 0, width_mm: 400, height_mm: 300 })];
      // Moving zone: right edge at 480 (x=80, w=400), 20mm from z2.left at 500
      const movingBox = { x: 80, y: 0, width: 400, height: 300 };
      const result = findSnapLines(movingBox, zones, 3000, 2400, SNAP_THRESHOLD);
      expect(result.vertical).not.toContain(500);
    });

    it('detects wall edge snapping', () => {
      const movingBox = { x: 5, y: 3, width: 400, height: 300 };
      const result = findSnapLines(movingBox, [], 3000, 2400, SNAP_THRESHOLD);
      expect(result.vertical).toContain(0); // left wall edge
      expect(result.horizontal).toContain(0); // bottom wall edge
    });

    it('detects horizontal snap for top edge near wall height', () => {
      // Zone top = y + height = 2395, within 10mm of wall top at 2400
      const movingBox = { x: 100, y: 2095, width: 400, height: 300 };
      const result = findSnapLines(movingBox, [], 3000, 2400, SNAP_THRESHOLD);
      expect(result.horizontal).toContain(2400);
    });
  });

  describe('snapToEdges', () => {
    it('snaps left edge to a nearby vertical line', () => {
      const candidates = { vertical: [0, 500, 3000], horizontal: [0, 2400] };
      // x=7, left edge is 7, near vertical line 0 (distance 7 <= 10)
      const result = snapToEdges(7, 100, 400, 300, candidates, SNAP_THRESHOLD);
      expect(result.x).toBe(0);
      expect(result.snappedVertical).toBe(0);
    });

    it('snaps right edge to a nearby vertical line', () => {
      const candidates = { vertical: [0, 500, 3000], horizontal: [0, 2400] };
      // x=95, right edge = 95+400 = 495, within 10mm of 500
      const result = snapToEdges(95, 100, 400, 300, candidates, SNAP_THRESHOLD);
      expect(result.x).toBe(100); // 500 - 400 = 100
      expect(result.snappedVertical).toBe(500);
    });

    it('snaps bottom edge to a nearby horizontal line', () => {
      const candidates = { vertical: [0, 3000], horizontal: [0, 200, 2400] };
      // y=5, bottom edge 5, near horizontal 0 (distance 5 <= 10)
      const result = snapToEdges(100, 5, 400, 300, candidates, SNAP_THRESHOLD);
      expect(result.y).toBe(0);
      expect(result.snappedHorizontal).toBe(0);
    });

    it('snaps top edge to a nearby horizontal line', () => {
      const candidates = { vertical: [0, 3000], horizontal: [0, 200, 2400] };
      // y=1800, top edge = 1800+300 = 2100. Not near 2400. Try y=2095, top=2395, near 2400
      const result = snapToEdges(100, 2095, 400, 300, candidates, SNAP_THRESHOLD);
      expect(result.y).toBe(2100); // 2400 - 300 = 2100
      expect(result.snappedHorizontal).toBe(2400);
    });

    it('returns null snapped values when no edge is within threshold', () => {
      const candidates = { vertical: [0, 500, 3000], horizontal: [0, 2400] };
      // x=250, left=250 (250 from 0, 250 from 500), right=650 (150 from 500)
      // All > 10mm threshold
      const result = snapToEdges(250, 100, 400, 300, candidates, SNAP_THRESHOLD);
      expect(result.snappedVertical).toBeNull();
      expect(result.x).toBe(250);
    });

    it('snaps to closest edge when multiple are within threshold', () => {
      // Two vertical lines close together
      const candidates = { vertical: [100, 108], horizontal: [] };
      // x=105, left=105: dist to 100 is 5, dist to 108 is 3. Right=505: far from both.
      // Closest is 108 (dist 3)
      const result = snapToEdges(105, 0, 400, 300, candidates, SNAP_THRESHOLD);
      expect(result.x).toBe(108);
      expect(result.snappedVertical).toBe(108);
    });
  });
});
