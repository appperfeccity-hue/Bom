import type {
  Template,
  TemplateZone,
  TemplateLighting,
  TemplateFurniture,
  TemplateTrim,
  SkuMaster,
  WallGeometry,
} from '@/types/database';
import type { WallConfigInput, PanelFrame, Obstruction } from '@/engines/types';
import type { ConsultantWallPermissions } from '@/stores/wallConfigStore';

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

export interface SnapshotPanelFrameData {
  frame_id: string;
  row_index: number;
  col_index: number;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  segment: string | null;
  is_edge_panel: boolean;
}

export interface SnapshotData {
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
  /** Template-level wall configuration (Amendment 001) */
  template_wall_configuration: WallConfigInput | null;
  /** Consultant permissions for wall parameters (Amendment 001) */
  consultant_permissions: ConsultantWallPermissions | null;
  /** Project-level wall configuration with possible consultant overrides (Amendment 001) */
  project_wall_configuration: WallConfigInput | null;
  /** Site obstructions (Amendment 001) */
  site_obstructions: Obstruction[];
  /** Generated panel frames from wallConfigEngine (Amendment 001) */
  generated_panel_frames: SnapshotPanelFrameData[];
}

/**
 * Optional wall configuration data for snapshot building (Amendment 001).
 */
export interface WallConfigSnapshotInput {
  templateWallConfig?: WallConfigInput | null;
  consultantPermissions?: ConsultantWallPermissions | null;
  projectWallConfig?: WallConfigInput | null;
  siteObstructions?: Obstruction[];
  generatedPanelFrames?: PanelFrame[];
}

/**
 * Assembles the complete frozen JSONB snapshot for a project creation.
 * Includes wall_geometry, base_dimensions, zones with frozen SKU data,
 * lighting, furniture, trims, hidden_components, calculation_parameters,
 * and Amendment 001 wall configuration fields.
 */
export function buildSnapshotData(
  template: Template,
  zones: TemplateZone[],
  lighting: TemplateLighting[],
  furniture: TemplateFurniture[],
  trims: TemplateTrim[],
  zoneSku: Map<string, SkuMaster>,
  wallConfigInput?: WallConfigSnapshotInput,
): SnapshotData {
  const snapshotZones: SnapshotZone[] = zones.map((zone) => ({
    zone_id: zone.zone_id,
    x_mm: zone.x_mm,
    y_mm: zone.y_mm,
    width_mm: zone.width_mm,
    height_mm: zone.height_mm,
    width_strategy: zone.width_strategy,
    height_strategy: zone.height_strategy,
    position_strategy: zone.position_strategy,
    primary_sku: zoneSku.get(zone.zone_id) ?? null,
    alternatives: [],
  }));

  const panelFrameSnapshots: SnapshotPanelFrameData[] = (wallConfigInput?.generatedPanelFrames ?? []).map(
    (frame) => ({
      frame_id: frame.frame_id,
      row_index: frame.row_index,
      col_index: frame.col_index,
      x_mm: frame.x_mm,
      y_mm: frame.y_mm,
      width_mm: frame.width_mm,
      height_mm: frame.height_mm,
      segment: frame.segment,
      is_edge_panel: frame.is_edge_panel,
    }),
  );

  return {
    wall_geometry: template.wall_geometry,
    base_dimensions: {
      width_mm: template.wall_geometry.base_width_mm,
      height_mm: template.wall_geometry.base_height_mm,
    },
    zones: snapshotZones,
    lighting,
    furniture,
    trims,
    hidden_components: [],
    calculation_parameters: {},
    template_wall_configuration: wallConfigInput?.templateWallConfig ?? null,
    consultant_permissions: wallConfigInput?.consultantPermissions ?? null,
    project_wall_configuration: wallConfigInput?.projectWallConfig ?? null,
    site_obstructions: wallConfigInput?.siteObstructions ?? [],
    generated_panel_frames: panelFrameSnapshots,
  };
}

/**
 * Recursively sorts object keys to produce a deterministic JSON string.
 * Arrays preserve their order; objects have keys sorted alphabetically at every level.
 */
function sortKeysDeep(value: unknown): unknown {
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

/**
 * Computes a SHA-256 hex digest of the canonical JSON representation
 * of the snapshot data (keys sorted deterministically at all nesting levels).
 */
export async function computeSnapshotHash(snapshotData: SnapshotData): Promise<string> {
  const canonical = JSON.stringify(sortKeysDeep(snapshotData));
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
