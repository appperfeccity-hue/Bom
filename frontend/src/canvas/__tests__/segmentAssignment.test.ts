import { describe, it, expect } from 'vitest';
import { assignSegment } from '@/canvas/utils/segmentAssignment';
import { doesZoneCrossCorner } from '@/canvas/utils/segmentConstraint';

describe('assignSegment', () => {
  const cornerAt = { x: 1500, y: 0 };

  it('returns null for STRAIGHT wall geometry', () => {
    const zone = { x_mm: 0, y_mm: 0, width_mm: 500, height_mm: 400 };
    expect(assignSegment(zone, cornerAt, 'STRAIGHT')).toBeNull();
  });

  it('assigns SEGMENT_A when zone right edge <= corner x', () => {
    const zone = { x_mm: 0, y_mm: 0, width_mm: 1500, height_mm: 400 };
    expect(assignSegment(zone, cornerAt, 'L_CORNER')).toBe('SEGMENT_A');
  });

  it('assigns SEGMENT_A when zone is fully within segment A', () => {
    const zone = { x_mm: 200, y_mm: 100, width_mm: 800, height_mm: 400 };
    expect(assignSegment(zone, cornerAt, 'L_CORNER')).toBe('SEGMENT_A');
  });

  it('assigns SEGMENT_B when zone left edge >= corner x', () => {
    const zone = { x_mm: 1500, y_mm: 0, width_mm: 500, height_mm: 400 };
    expect(assignSegment(zone, cornerAt, 'L_CORNER')).toBe('SEGMENT_B');
  });

  it('assigns SEGMENT_B when zone is fully within segment B', () => {
    const zone = { x_mm: 2000, y_mm: 100, width_mm: 600, height_mm: 300 };
    expect(assignSegment(zone, cornerAt, 'L_CORNER')).toBe('SEGMENT_B');
  });

  it('returns null (invalid) when zone straddles the corner', () => {
    const zone = { x_mm: 1000, y_mm: 0, width_mm: 1000, height_mm: 400 };
    expect(assignSegment(zone, cornerAt, 'L_CORNER')).toBeNull();
  });

  it('assigns SEGMENT_A when zone right edge is exactly at corner', () => {
    const zone = { x_mm: 1000, y_mm: 0, width_mm: 500, height_mm: 400 };
    expect(assignSegment(zone, cornerAt, 'L_CORNER')).toBe('SEGMENT_A');
  });

  it('assigns SEGMENT_B when zone left edge is exactly at corner', () => {
    const zone = { x_mm: 1500, y_mm: 200, width_mm: 300, height_mm: 200 };
    expect(assignSegment(zone, cornerAt, 'L_CORNER')).toBe('SEGMENT_B');
  });
});

describe('doesZoneCrossCorner', () => {
  const cornerAt = { x: 1500, y: 0 };

  it('returns false when zone is entirely in segment A', () => {
    const zone = { x: 0, y: 0, width: 1000, height: 400 };
    expect(doesZoneCrossCorner(zone, cornerAt)).toBe(false);
  });

  it('returns false when zone is entirely in segment B', () => {
    const zone = { x: 1500, y: 0, width: 500, height: 400 };
    expect(doesZoneCrossCorner(zone, cornerAt)).toBe(false);
  });

  it('returns true when zone crosses the corner boundary', () => {
    const zone = { x: 1000, y: 0, width: 1000, height: 400 };
    expect(doesZoneCrossCorner(zone, cornerAt)).toBe(true);
  });

  it('returns false when zone right edge touches corner exactly', () => {
    const zone = { x: 1000, y: 0, width: 500, height: 400 };
    expect(doesZoneCrossCorner(zone, cornerAt)).toBe(false);
  });

  it('returns false when zone left edge touches corner exactly', () => {
    const zone = { x: 1500, y: 0, width: 500, height: 400 };
    expect(doesZoneCrossCorner(zone, cornerAt)).toBe(false);
  });

  it('returns true for a zone that starts 1mm before corner and extends past', () => {
    const zone = { x: 1499, y: 0, width: 200, height: 400 };
    expect(doesZoneCrossCorner(zone, cornerAt)).toBe(true);
  });
});
