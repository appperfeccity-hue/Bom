import type {
  Template,
  TemplateZone,
  TemplateLighting,
  TemplateFurniture,
  TemplateTrim,
  SkuMaster,
  WallGeometry,
} from '@/types/database';
import { AdaptationStrategy, TemplateStatus } from '@/types/database';

/**
 * Reads a frozen project snapshot back into the shapes the consultant UI works
 * with. Snapshots are never rewritten, so both generations stay readable:
 *
 *   version 2 — built by create_project() server-side; carries the template
 *               record, zone alternatives, permissions, compatibility and the
 *               resolved rule set.
 *   version 1 — legacy, browser-built; only geometry, zones with a primary SKU
 *               and the lighting/furniture/trim rows. A missing
 *               snapshot_version is treated as version 1. Since no template
 *               record was frozen, a minimal one is reconstructed from the
 *               snapshot geometry — the canvas, zone validation and the zone
 *               properties panel all key off `currentTemplate`, and a null
 *               there would silently give legacy projects a default-sized wall
 *               and read-only zones.
 */

export interface SnapshotAlternative {
  alternative_id: string;
  display_order: number;
  reason: string | null;
  sku: SkuMaster;
}

export interface SnapshotConsultantPermission {
  permission_id: string;
  parameter_key: string;
  parameter_type: string;
  edit_mode: string;
  min_value: number | null;
  max_value: number | null;
  allowed_values: unknown;
  source_component_id: string | null;
}

export interface SnapshotRuleSet {
  rule_set_id: string;
  rule_set_code: string;
  version: string;
  constants: Record<string, unknown>;
}

export interface HydratedSnapshot {
  version: 1 | 2;
  template: Template | null;
  wallGeometry: WallGeometry;
  zones: TemplateZone[];
  zoneSku: Map<string, SkuMaster>;
  zoneAlternatives: Map<string, SnapshotAlternative[]>;
  lighting: TemplateLighting[];
  furniture: TemplateFurniture[];
  trims: TemplateTrim[];
  hiddenComponents: unknown[];
  consultantPermissions: SnapshotConsultantPermission[];
  /** Legacy v1 snapshots stored wall permissions as a single object here. */
  wallPermissions: unknown;
  templateWallConfiguration: unknown;
  skuCompatibility: unknown[];
  ruleSet: SnapshotRuleSet | null;
  calculationParameters: Record<string, unknown>;
}

const DEFAULT_WALL_GEOMETRY: WallGeometry = {
  type: 'STRAIGHT',
  base_width_mm: 0,
  base_height_mm: 0,
};

type Json = Record<string, unknown>;

function asObject(value: unknown): Json {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * A v1 snapshot froze no template row, so rebuild just enough of one for the
 * geometry-dependent UI. Fields the legacy format never carried stay empty
 * rather than being invented, and nothing is read back from the live template.
 */
function legacyTemplate(data: Json, wallGeometry: WallGeometry, templateId: string): Template | null {
  if (!templateId) return null;
  const base = asObject(data.base_dimensions);
  const metadata = asObject(data.project_metadata);
  return {
    template_id: templateId,
    name: (metadata.template_name as string | undefined) ?? '',
    description: null,
    design_family_id: null,
    design_subfamily_id: null,
    wall_application: null,
    wall_geometry: {
      ...wallGeometry,
      base_width_mm: Number(base.width_mm ?? wallGeometry.base_width_mm ?? 0),
      base_height_mm: Number(base.height_mm ?? wallGeometry.base_height_mm ?? 0),
    },
    adaptation_strategy:
      (data.adaptation_strategy as AdaptationStrategy | undefined) ?? AdaptationStrategy.PROPORTIONAL,
    priority_zone_id: (data.priority_zone_id as string | undefined) ?? null,
    waste_factor: (asObject(data.calculation_parameters).waste_factor as number | undefined) ?? null,
    metadata: null,
    status: TemplateStatus.ACTIVE,
    created_by: '',
    created_at: '',
    updated_at: '',
  };
}

export function getSnapshotVersion(snapshotData: unknown): 1 | 2 {
  const raw = asObject(snapshotData).snapshot_version;
  return Number(raw) === 2 ? 2 : 1;
}

export function readSnapshot(snapshotData: unknown, templateId?: string): HydratedSnapshot {
  const data = asObject(snapshotData);
  const version = getSnapshotVersion(data);
  const wallGeometry = (data.wall_geometry as WallGeometry | undefined) ?? DEFAULT_WALL_GEOMETRY;
  const template =
    version === 2
      ? (asObject(data.template) as unknown as Template)
      : legacyTemplate(data, wallGeometry, templateId ?? '');
  const resolvedTemplateId = template?.template_id ?? templateId ?? '';

  const zones: TemplateZone[] = [];
  const zoneSku = new Map<string, SkuMaster>();
  const zoneAlternatives = new Map<string, SnapshotAlternative[]>();

  for (const raw of asArray(data.zones)) {
    const zone = asObject(raw);
    const zoneId = String(zone.zone_id ?? '');
    zones.push({
      zone_id: zoneId,
      template_id: (zone.template_id as string | undefined) ?? resolvedTemplateId,
      segment: (zone.segment as TemplateZone['segment']) ?? null,
      x_mm: Number(zone.x_mm ?? 0),
      y_mm: Number(zone.y_mm ?? 0),
      width_mm: Number(zone.width_mm ?? 0),
      height_mm: Number(zone.height_mm ?? 0),
      width_strategy: zone.width_strategy as TemplateZone['width_strategy'],
      height_strategy: zone.height_strategy as TemplateZone['height_strategy'],
      position_strategy: zone.position_strategy as TemplateZone['position_strategy'],
      created_at: (zone.created_at as string | undefined) ?? '',
    });

    if (zone.primary_sku) {
      zoneSku.set(zoneId, zone.primary_sku as SkuMaster);
    }
    const alternatives = asArray(zone.alternatives).filter(
      (alt): alt is SnapshotAlternative => Boolean(asObject(alt).sku),
    );
    if (alternatives.length > 0) {
      zoneAlternatives.set(zoneId, alternatives);
    }
  }

  return {
    version,
    template,
    wallGeometry,
    zones,
    zoneSku,
    zoneAlternatives,
    lighting: asArray(data.lighting) as TemplateLighting[],
    furniture: asArray(data.furniture) as TemplateFurniture[],
    trims: asArray(data.trims) as TemplateTrim[],
    hiddenComponents: asArray(data.hidden_components),
    consultantPermissions: asArray(data.consultant_permissions) as SnapshotConsultantPermission[],
    wallPermissions: Array.isArray(data.consultant_permissions) ? null : (data.consultant_permissions ?? null),
    templateWallConfiguration: data.template_wall_configuration ?? null,
    skuCompatibility: asArray(data.sku_compatibility),
    ruleSet: (data.rule_set as SnapshotRuleSet | undefined) ?? null,
    calculationParameters: asObject(data.calculation_parameters),
  };
}
