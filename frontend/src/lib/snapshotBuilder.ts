import type {
  Template,
  TemplateZone,
  TemplateLighting,
  TemplateFurniture,
  TemplateTrim,
  SkuMaster,
} from '@/types/database';

export interface SnapshotZone {
  id: string;
  name: string;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  width_strategy: string;
  height_strategy: string;
  position_strategy: string;
  z_index: number;
  primary_sku: SkuMaster | null;
  alternatives: unknown[];
}

export interface SnapshotData {
  wall_geometry: string;
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
}

/**
 * Assembles the complete frozen JSONB snapshot for a project creation.
 * Includes wall_geometry, base_dimensions, zones with frozen SKU data,
 * lighting, furniture, trims, hidden_components and calculation_parameters.
 */
export function buildSnapshotData(
  template: Template,
  zones: TemplateZone[],
  lighting: TemplateLighting[],
  furniture: TemplateFurniture[],
  trims: TemplateTrim[],
  zoneSku: Map<string, SkuMaster>,
): SnapshotData {
  const snapshotZones: SnapshotZone[] = zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    x_mm: zone.x_mm,
    y_mm: zone.y_mm,
    width_mm: zone.width_mm,
    height_mm: zone.height_mm,
    width_strategy: zone.width_strategy,
    height_strategy: zone.height_strategy,
    position_strategy: zone.position_strategy,
    z_index: zone.z_index,
    primary_sku: zoneSku.get(zone.id) ?? null,
    alternatives: [],
  }));

  return {
    wall_geometry: template.wall_geometry,
    base_dimensions: {
      width_mm: template.base_width_mm,
      height_mm: template.base_height_mm,
    },
    zones: snapshotZones,
    lighting,
    furniture,
    trims,
    hidden_components: [],
    calculation_parameters: {},
  };
}

/**
 * Computes a SHA-256 hex digest of the canonical JSON representation
 * of the snapshot data (keys sorted deterministically).
 */
export async function computeSnapshotHash(snapshotData: SnapshotData): Promise<string> {
  const canonical = JSON.stringify(snapshotData, Object.keys(snapshotData).sort());
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
