/**
 * Canonical measurement / permission vocabulary.
 *
 * The frozen baseline (baseline/v1.1.5_baseline.sql, template_consultant_permission)
 * owns the UPPERCASE parameter_key vocabulary. This module is the SINGLE source that
 * maps that vocabulary onto the frontend measurement columns and the snapshot
 * wall_geometry keys; nothing else may hardcode the correspondence.
 */

/** Authoritative parameter_key values (baseline CHECK constraint). */
export const PERMISSION_PARAMETER_KEYS = [
  'WALL_WIDTH',
  'WALL_HEIGHT',
  'SEGMENT_A_WIDTH',
  'SEGMENT_B_WIDTH',
  'ZONE_WIDTH',
  'ZONE_HEIGHT',
  'ZONE_POSITION_X',
  'ZONE_POSITION_Y',
  'ZONE_PRIMARY_SKU',
  'LIGHT_SKU',
  'LIGHT_QUANTITY',
  'LIGHT_MOUNTING_TYPE',
  'FURNITURE_SKU',
  'FURNITURE_QUANTITY',
  'FURNITURE_POSITION_X',
  'FURNITURE_POSITION_Y',
  'FURNITURE_ORIENTATION',
  'TRIM_SKU',
] as const;

export type PermissionParameterKey = (typeof PERMISSION_PARAMETER_KEYS)[number];

/** Authoritative parameter_type values (baseline CHECK constraint). */
export const PERMISSION_PARAMETER_TYPES = [
  'DIMENSION',
  'SKU_SELECTION',
  'OPTION',
  'BOOLEAN',
] as const;

export type PermissionParameterType = (typeof PERMISSION_PARAMETER_TYPES)[number];

/** Authoritative edit_mode values (baseline CHECK constraint). */
export const PERMISSION_EDIT_MODES = ['LOCKED', 'RESTRICTED', 'FREE'] as const;

export type PermissionEditMode = (typeof PERMISSION_EDIT_MODES)[number];

/** Default parameter_type per parameter_key, so the authoring UI cannot emit an invalid pair. */
export const PARAMETER_TYPE_BY_KEY: Record<PermissionParameterKey, PermissionParameterType> = {
  WALL_WIDTH: 'DIMENSION',
  WALL_HEIGHT: 'DIMENSION',
  SEGMENT_A_WIDTH: 'DIMENSION',
  SEGMENT_B_WIDTH: 'DIMENSION',
  ZONE_WIDTH: 'DIMENSION',
  ZONE_HEIGHT: 'DIMENSION',
  ZONE_POSITION_X: 'DIMENSION',
  ZONE_POSITION_Y: 'DIMENSION',
  ZONE_PRIMARY_SKU: 'SKU_SELECTION',
  LIGHT_SKU: 'SKU_SELECTION',
  LIGHT_QUANTITY: 'DIMENSION',
  LIGHT_MOUNTING_TYPE: 'OPTION',
  FURNITURE_SKU: 'SKU_SELECTION',
  FURNITURE_QUANTITY: 'DIMENSION',
  FURNITURE_POSITION_X: 'DIMENSION',
  FURNITURE_POSITION_Y: 'DIMENSION',
  FURNITURE_ORIENTATION: 'OPTION',
  TRIM_SKU: 'SKU_SELECTION',
};

/** project_measurement columns that carry an adaptable wall measurement. */
export type MeasurementColumn =
  | 'wall_width_mm'
  | 'wall_height_mm'
  | 'segment_a_width_mm'
  | 'segment_b_width_mm';

/** Keys inside snapshot_data.wall_geometry that hold the frozen designer defaults. */
export type WallGeometryDefaultKey =
  | 'base_width_mm'
  | 'base_height_mm'
  | 'segment_a_width_mm'
  | 'segment_b_width_mm';

export interface MeasurementMapping {
  permissionKey: PermissionParameterKey;
  measurementColumn: MeasurementColumn;
  wallGeometryKey: WallGeometryDefaultKey;
  label: string;
}

/**
 * permission key -> project_measurement column -> wall_geometry default key.
 * This is the canonical table referenced by MeasurementPanel and the
 * PermanentMeasurement projection.
 */
export const MEASUREMENT_MAPPINGS: readonly MeasurementMapping[] = [
  {
    permissionKey: 'WALL_WIDTH',
    measurementColumn: 'wall_width_mm',
    wallGeometryKey: 'base_width_mm',
    label: 'Wall Width',
  },
  {
    permissionKey: 'WALL_HEIGHT',
    measurementColumn: 'wall_height_mm',
    wallGeometryKey: 'base_height_mm',
    label: 'Wall Height',
  },
  {
    permissionKey: 'SEGMENT_A_WIDTH',
    measurementColumn: 'segment_a_width_mm',
    wallGeometryKey: 'segment_a_width_mm',
    label: 'Segment A Width',
  },
  {
    permissionKey: 'SEGMENT_B_WIDTH',
    measurementColumn: 'segment_b_width_mm',
    wallGeometryKey: 'segment_b_width_mm',
    label: 'Segment B Width',
  },
] as const;

const BY_COLUMN = new Map<string, MeasurementMapping>(
  MEASUREMENT_MAPPINGS.map((m) => [m.measurementColumn, m]),
);

const BY_KEY = new Map<string, MeasurementMapping>(
  MEASUREMENT_MAPPINGS.map((m) => [m.permissionKey, m]),
);

/** Resolve a project_measurement column to its canonical UPPERCASE permission key. */
export function toPermissionKey(column: string): PermissionParameterKey | null {
  return BY_COLUMN.get(column)?.permissionKey ?? null;
}

/** Resolve a canonical permission key to its project_measurement column. */
export function toMeasurementColumn(
  permissionKey: string,
): MeasurementColumn | null {
  return BY_KEY.get(permissionKey)?.measurementColumn ?? null;
}

/** Lookup the full mapping row by either vocabulary. */
export function getMeasurementMapping(
  columnOrKey: string,
): MeasurementMapping | null {
  return BY_COLUMN.get(columnOrKey) ?? BY_KEY.get(columnOrKey) ?? null;
}

export function isPermissionParameterKey(
  value: string,
): value is PermissionParameterKey {
  return (PERMISSION_PARAMETER_KEYS as readonly string[]).includes(value);
}
