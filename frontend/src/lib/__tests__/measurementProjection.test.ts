import { describe, it, expect } from 'vitest';
import {
  isWithinProjectedRange,
  projectMeasurement,
  projectMeasurements,
} from '../measurementModel';

const snapshot = {
  wall_geometry: {
    type: 'L_SHAPE',
    base_width_mm: 3000,
    base_height_mm: 2700,
    segment_a_width_mm: 1800,
    segment_b_width_mm: 1200,
  },
  consultant_permissions: [
    {
      permission_id: 'perm-1',
      parameter_key: 'WALL_WIDTH',
      parameter_type: 'DIMENSION',
      edit_mode: 'RESTRICTED',
      min_value: 2500,
      max_value: 3500,
      allowed_values: null,
    },
    {
      permission_id: 'perm-2',
      parameter_key: 'WALL_HEIGHT',
      parameter_type: 'DIMENSION',
      edit_mode: 'LOCKED',
      min_value: null,
      max_value: null,
      allowed_values: null,
    },
    {
      permission_id: 'perm-3',
      parameter_key: 'SEGMENT_A_WIDTH',
      parameter_type: 'DIMENSION',
      edit_mode: 'RESTRICTED',
      min_value: 1500,
      max_value: 2100,
      allowed_values: null,
    },
  ],
};

const measurements = {
  wall_width_mm: 3200,
  wall_height_mm: 2700,
  segment_a_width_mm: 1900,
  segment_b_width_mm: 1300,
};

describe('PermanentMeasurement projection', () => {
  it('projects default from snapshot geometry, min/max from permissions, actual from measurements', () => {
    const wallWidth = projectMeasurement('wall_width_mm', snapshot, measurements);
    expect(wallWidth).toMatchObject({
      permissionKey: 'WALL_WIDTH',
      default: 3000,
      actual: 3200,
      minimum: 2500,
      maximum: 3500,
      editMode: 'RESTRICTED',
      hasPermission: true,
    });
  });

  it('projects segment defaults frozen in wall_geometry', () => {
    const segmentA = projectMeasurement('SEGMENT_A_WIDTH', snapshot, measurements);
    expect(segmentA?.default).toBe(1800);
    expect(segmentA?.actual).toBe(1900);
    expect(segmentA?.minimum).toBe(1500);
    expect(segmentA?.maximum).toBe(2100);
  });

  it('exposes no adaptation range for a LOCKED field', () => {
    const wallHeight = projectMeasurement('wall_height_mm', snapshot, measurements);
    expect(wallHeight?.editMode).toBe('LOCKED');
    expect(wallHeight?.minimum).toBeNull();
    expect(wallHeight?.maximum).toBeNull();
  });

  it('falls back to LOCKED when no permission was frozen for the field', () => {
    const segmentB = projectMeasurement('segment_b_width_mm', snapshot, measurements);
    expect(segmentB?.hasPermission).toBe(false);
    expect(segmentB?.editMode).toBe('LOCKED');
    expect(segmentB?.default).toBe(1200);
    expect(segmentB?.actual).toBe(1300);
  });

  it('falls back to the frozen default when no actual measurement exists yet', () => {
    const wallWidth = projectMeasurement('wall_width_mm', snapshot, null);
    expect(wallWidth?.actual).toBe(3000);
  });

  it('returns null for keys that are not adaptable measurements', () => {
    expect(projectMeasurement('ZONE_WIDTH', snapshot, measurements)).toBeNull();
    expect(projectMeasurement('finish_type', snapshot, measurements)).toBeNull();
  });

  it('projects every adaptable measurement keyed by measurement column', () => {
    const all = projectMeasurements(snapshot, measurements);
    expect(Object.keys(all).sort()).toEqual([
      'segment_a_width_mm',
      'segment_b_width_mm',
      'wall_height_mm',
      'wall_width_mm',
    ]);
  });

  it('enforces minimum <= actual <= maximum', () => {
    const wallWidth = projectMeasurement('wall_width_mm', snapshot, measurements)!;
    expect(isWithinProjectedRange(wallWidth, 3000)).toBe(true);
    expect(isWithinProjectedRange(wallWidth, 2400)).toBe(false);
    expect(isWithinProjectedRange(wallWidth, 3600)).toBe(false);
  });
});
