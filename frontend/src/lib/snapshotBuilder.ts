import type {
  SkuMaster,
  TemplateLighting,
  TemplateFurniture,
  TemplateTrim,
  WallGeometry,
} from '@/types/database';
import type { WallConfigInput } from '@/engines/types';

/**
 * Permission record from consultant_permissions in v2 snapshot.
 */
export interface SnapshotConsultantPermission {
  permission_id: string;
  parameter_key: string;
  parameter_type: string;
  edit_mode: string;
  min_value: number | null;
  max_value: number | null;
  allowed_values: unknown[] | null;
  source_component_id: string | null;
}

/**
 * Rule set subset frozen into the snapshot (v2).
 */
export interface SnapshotRuleSet {
  rule_set_id: string;
  rule_set_code: string;
  version: number;
  constants: Record<string, unknown>;
}

/**
 * Template metadata frozen into the snapshot (v2).
 */
export interface SnapshotTemplate {
  template_id: string;
  name: string;
  wall_application: string | null;
  adaptation_strategy: string;
  priority_zone_id: string | null;
  waste_factor: number | null;
  metadata: Record<string, unknown> | null;
}

export interface SnapshotZone {
  zone_id: string;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  width_strategy: string;
  height_strategy: string;
  position_strategy: string;
  primary_sku: SkuMaster | null;
  alternatives: unknown[];
}

export interface SnapshotData {
  /** Snapshot format version; absent = v1, present = v2 */
  snapshot_version?: number;
  /** Template metadata (v2) */
  template?: SnapshotTemplate;
  wall_geometry: WallGeometry;
  base_dimensions: {
    width_mm: number;
    height_mm: number;
  };
  zones: SnapshotZone[];
  lighting: TemplateLighting[];
  furniture: TemplateFurniture[];
  trims: TemplateTrim[];
  hidden_components: unknown[];
  calculation_parameters: Record<string, unknown>;
  /** Template-level wall configuration */
  template_wall_configuration: WallConfigInput | null;
  /** Consultant permissions (v2: array of permission records) */
  consultant_permissions: SnapshotConsultantPermission[] | null;
  /** Site obstructions */
  site_obstructions: unknown[];
  /** SKU compatibility rules frozen at snapshot time (v2) */
  sku_compatibility?: unknown[];
  /** Rule set frozen at snapshot time (v2) */
  rule_set?: SnapshotRuleSet | null;
}

/**
 * Recursively sorts object keys to produce a deterministic JSON string.
 * Arrays preserve their order; objects have keys sorted alphabetically at every level.
 */
export function sortKeysDeep(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}
