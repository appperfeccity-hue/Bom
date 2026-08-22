import { describe, it, expect } from 'vitest';
import {
  MEASUREMENT_MAPPINGS,
  PARAMETER_TYPE_BY_KEY,
  PERMISSION_PARAMETER_KEYS,
  getMeasurementMapping,
  isPermissionParameterKey,
  toMeasurementColumn,
  toPermissionKey,
} from '../measurementModel';

describe('canonical measurement mapping', () => {
  it('maps each measurement column to its baseline permission key', () => {
    expect(toPermissionKey('wall_width_mm')).toBe('WALL_WIDTH');
    expect(toPermissionKey('wall_height_mm')).toBe('WALL_HEIGHT');
    expect(toPermissionKey('segment_a_width_mm')).toBe('SEGMENT_A_WIDTH');
    expect(toPermissionKey('segment_b_width_mm')).toBe('SEGMENT_B_WIDTH');
    expect(toPermissionKey('finish_type')).toBeNull();
  });

  it('maps each permission key back to its measurement column', () => {
    expect(toMeasurementColumn('WALL_WIDTH')).toBe('wall_width_mm');
    expect(toMeasurementColumn('SEGMENT_B_WIDTH')).toBe('segment_b_width_mm');
    expect(toMeasurementColumn('ZONE_WIDTH')).toBeNull();
  });

  it('exposes the wall_geometry default key per mapping', () => {
    expect(getMeasurementMapping('WALL_WIDTH')?.wallGeometryKey).toBe('base_width_mm');
    expect(getMeasurementMapping('wall_height_mm')?.wallGeometryKey).toBe('base_height_mm');
    expect(getMeasurementMapping('segment_a_width_mm')?.wallGeometryKey).toBe(
      'segment_a_width_mm',
    );
  });

  it('only uses parameter keys the baseline CHECK constraint accepts', () => {
    for (const mapping of MEASUREMENT_MAPPINGS) {
      expect(isPermissionParameterKey(mapping.permissionKey)).toBe(true);
    }
    expect(isPermissionParameterKey('wall_width')).toBe(false);
  });

  it('declares a parameter_type for every parameter key', () => {
    for (const key of PERMISSION_PARAMETER_KEYS) {
      expect(PARAMETER_TYPE_BY_KEY[key]).toBeDefined();
    }
  });
});
