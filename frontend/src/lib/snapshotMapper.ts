/**
 * Snapshot Mapper
 *
 * Converts DB snake_case snapshot data (v1/v2) into the camelCase BomPipelineInput
 * format expected by the BOM pipeline engine.
 *
 * v2 mapper: full mapping of all frozen data in the snapshot.
 * v1 legacy mapper: handles old client-built snapshots that lack alternatives,
 * hidden_components, consultant_permissions, and frozen sku_compatibility.
 */

import type {
  SnapshotData as BomSnapshotData,
  SnapshotZone as BomSnapshotZone,
  SnapshotLighting as BomSnapshotLighting,
  SnapshotFurniture as BomSnapshotFurniture,
  SnapshotHiddenComponent as BomSnapshotHiddenComponent,
  BomRuleSet,
} from '@/engines/bomPipeline';
import type { PermissionRule, CompatibilityRule } from '@/engines/validationEngine';
import type {
  SkuDependencyRule,
  SkuDependencyType,
  SkuDependencyQuantityRule,
  SkuDependencyUnit,
  SkuPhysicalProductType,
} from '@/engines/skuDependencyEngine';
import type { SnapshotData, SnapshotConsultantPermission, SnapshotRuleSet } from '@/lib/snapshotBuilder';
import type { TemplateLighting, TemplateFurniture, SkuMaster } from '@/types/database';

// --- V2 Mapper ---

/**
 * Maps a v2 snapshot's zone data to the BOM pipeline's expected SnapshotZone format.
 */
function mapZone(
  zone: SnapshotData['zones'][number],
  templateWasteFactor: number | null | undefined,
): BomSnapshotZone {
  const sku = zone.primary_sku as SkuMaster | null;

  return {
    zoneId: zone.zone_id,
    x: zone.x_mm,
    y: zone.y_mm,
    width: zone.width_mm,
    height: zone.height_mm,
    skuId: sku?.sku_id ?? '',
    panelWidth: sku?.width_mm ?? undefined,
    panelHeight: sku?.height_mm ?? undefined,
    gapHorizontal: sku?.gh_mm ?? undefined,
    gapVertical: sku?.gv_mm ?? undefined,
    wasteFactor: templateWasteFactor ?? undefined,
    widthStrategy: mapWidthStrategy(zone.width_strategy),
    heightMode: mapHeightStrategy(zone.height_strategy),
  };
}

/**
 * Maps DB width_strategy to pipeline widthStrategy.
 * 'FIXED' | 'PROPORTIONAL' -> 'RESIZABLE', 'LOCKED' -> 'LOCKED'
 */
function mapWidthStrategy(strategy: string): 'RESIZABLE' | 'LOCKED' {
  if (strategy === 'LOCKED') return 'LOCKED';
  return 'RESIZABLE';
}

/**
 * Maps DB height_strategy to pipeline heightMode.
 */
function mapHeightStrategy(strategy: string): 'DERIVED_FROM_WALL' | 'FIXED' | 'RESIZABLE' {
  if (strategy === 'FIXED') return 'FIXED';
  if (strategy === 'RESIZABLE') return 'RESIZABLE';
  return 'DERIVED_FROM_WALL';
}

/**
 * Maps v2 snapshot lighting entries to pipeline SnapshotLighting format.
 */
function mapLighting(lighting: TemplateLighting[]): BomSnapshotLighting[] {
  return lighting.map((l) => ({
    componentId: l.lighting_id,
    skuId: l.sku_id,
    edges: l.edge_selection ? parseEdges(l.edge_selection) : [{ length: 0 }],
    mountingType: l.mounting_type,
    mode: 'LINEAR' as const,
    unitLength: 0,
  }));
}

/**
 * Parse edge_selection string into edge length array.
 * edge_selection may be a JSON string representing edges or a simple numeric value.
 */
function parseEdges(edgeSelection: string): Array<{ length: number }> {
  try {
    const parsed = JSON.parse(edgeSelection);
    if (Array.isArray(parsed)) {
      return parsed.map((e: unknown) => {
        if (typeof e === 'object' && e !== null && 'length' in e) {
          return { length: (e as { length: number }).length };
        }
        if (typeof e === 'number') {
          return { length: e };
        }
        return { length: 0 };
      });
    }
    if (typeof parsed === 'number') {
      return [{ length: parsed }];
    }
  } catch {
    // Not JSON - try to parse as a number
    const num = Number(edgeSelection);
    if (!isNaN(num)) {
      return [{ length: num }];
    }
  }
  return [{ length: 0 }];
}

/**
 * Maps v2 snapshot furniture entries to pipeline SnapshotFurniture format.
 */
function mapFurniture(furniture: TemplateFurniture[]): BomSnapshotFurniture[] {
  return furniture.map((f) => ({
    componentId: f.furniture_id,
    skuId: f.sku_id,
    quantity: 1,
    min: 0,
    max: 10,
  }));
}

/**
 * Maps v2 snapshot hidden_components entries to pipeline SnapshotHiddenComponent format.
 */
function mapHiddenComponents(components: unknown[]): BomSnapshotHiddenComponent[] {
  if (!components || !Array.isArray(components)) return [];
  return components.map((c: unknown) => {
    const comp = c as Record<string, unknown>;
    return {
      componentId: (comp.hidden_component_id as string) ?? (comp.componentId as string) ?? '',
      skuId: (comp.sku_id as string) ?? (comp.skuId as string) ?? '',
      triggerType: mapTriggerType((comp.trigger_type as string) ?? (comp.triggerType as string) ?? 'ALWAYS'),
      condition: mapCondition(comp.trigger_condition ?? comp.condition),
      quantityRule: mapQuantityRule((comp.quantity_rule as string) ?? (comp.quantityRule as string) ?? 'FIXED'),
      fixedValue: (comp.fixed_value as number) ?? (comp.fixedValue as number) ?? undefined,
    };
  });
}

function mapTriggerType(t: string): 'ALWAYS' | 'CONDITION' | 'DEPENDENCY' {
  if (t === 'CONDITION') return 'CONDITION';
  if (t === 'DEPENDENCY') return 'DEPENDENCY';
  return 'ALWAYS';
}

function mapQuantityRule(r: string): 'FIXED' | 'PER_ZONE' | 'PER_PANEL' | 'DERIVED_FROM_PARENT' {
  if (r === 'PER_ZONE') return 'PER_ZONE';
  if (r === 'PER_PANEL') return 'PER_PANEL';
  if (r === 'DERIVED_FROM_PARENT') return 'DERIVED_FROM_PARENT';
  return 'FIXED';
}

function mapCondition(cond: unknown): BomSnapshotHiddenComponent['condition'] | undefined {
  if (!cond || typeof cond !== 'object') return undefined;
  const c = cond as Record<string, unknown>;
  return {
    field: (c.field as string) ?? '',
    operator: (c.operator as 'EQ' | 'NEQ' | 'GT' | 'LT' | 'GTE' | 'LTE') ?? 'EQ',
    value: (c.value as number | string) ?? 0,
  };
}

const DEPENDENCY_TYPES: readonly SkuDependencyType[] = ['REQUIRED', 'CONDITIONAL', 'OPTIONAL'];
const DEPENDENCY_QUANTITY_RULES: readonly SkuDependencyQuantityRule[] = [
  'PER_PARENT',
  'PER_AREA',
  'PER_LENGTH',
  'PER_EDGE',
  'FIXED',
];
const DEPENDENCY_UNITS: readonly SkuDependencyUnit[] = ['PCS', 'M', 'M2'];
const PHYSICAL_PRODUCT_TYPES: readonly SkuPhysicalProductType[] = [
  'WALL_PANEL',
  'LIGHT',
  'FURNITURE',
  'HIDDEN_COMPONENT',
];

function pickEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/**
 * Maps frozen `sku_dependencies` rows (v1.2.6) to engine rules. Rows with an
 * unknown type/rule are dropped rather than guessed, so a malformed snapshot
 * can never silently generate BOM lines.
 */
export function mapSkuDependencies(rows: unknown[] | undefined): SkuDependencyRule[] {
  if (!rows || !Array.isArray(rows)) return [];
  const rules: SkuDependencyRule[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const childSku = (row.child_sku ?? null) as Partial<SkuMaster> | null;
    const dependencyType = pickEnum(row.dependency_type, DEPENDENCY_TYPES);
    const quantityRule = pickEnum(row.quantity_rule, DEPENDENCY_QUANTITY_RULES);
    const childProductType = pickEnum(childSku?.product_type, PHYSICAL_PRODUCT_TYPES);
    const factor = Number(row.quantity_factor ?? 1);
    if (
      typeof row.dependency_id !== 'string' ||
      typeof row.parent_sku_id !== 'string' ||
      typeof row.child_sku_id !== 'string' ||
      !dependencyType ||
      !quantityRule ||
      !childProductType ||
      !Number.isFinite(factor) ||
      factor <= 0
    ) {
      continue;
    }
    rules.push({
      dependencyId: row.dependency_id,
      parentSkuId: row.parent_sku_id,
      childSkuId: row.child_sku_id,
      dependencyType,
      condition: mapCondition(row.condition),
      quantityRule,
      quantityFactor: factor,
      unitOfMeasure: pickEnum(row.unit_of_measure, DEPENDENCY_UNITS) ?? 'PCS',
      childProductType,
    });
  }
  return rules;
}

// --- Public API ---

/**
 * Maps a v2 snapshot's data to the BOM pipeline's snapshotData input format.
 */
export function mapSnapshotToPipeline(s: SnapshotData): BomSnapshotData {
  const templateWasteFactor = s.template?.waste_factor ?? null;

  const zones = (s.zones ?? []).map((z) => mapZone(z, templateWasteFactor));
  const lighting = mapLighting(s.lighting ?? []);
  const furniture = mapFurniture(s.furniture ?? []);
  const hiddenComponents = mapHiddenComponents(s.hidden_components ?? []);
  const skuDependencies = mapSkuDependencies(s.sku_dependencies);

  return {
    zones,
    lighting: lighting.length > 0 ? lighting : undefined,
    furniture: furniture.length > 0 ? furniture : undefined,
    hiddenComponents: hiddenComponents.length > 0 ? hiddenComponents : undefined,
    skuDependencies: skuDependencies.length > 0 ? skuDependencies : undefined,
  };
}

/**
 * Maps v2 snapshot consultant_permissions to pipeline PermissionRule format.
 */
export function mapPermissions(s: SnapshotData): PermissionRule[] {
  if (!s.consultant_permissions || !Array.isArray(s.consultant_permissions)) {
    return [];
  }
  return s.consultant_permissions.map((p: SnapshotConsultantPermission) => ({
    parameter: p.parameter_key,
    locked: p.edit_mode === 'LOCKED',
    minValue: p.min_value ?? undefined,
    maxValue: p.max_value ?? undefined,
    allowedSkus: Array.isArray(p.allowed_values)
      ? p.allowed_values.filter((v): v is string => typeof v === 'string')
      : undefined,
  }));
}

/**
 * Maps v2 snapshot sku_compatibility to pipeline CompatibilityRule format.
 */
export function mapCompatibility(s: SnapshotData): CompatibilityRule[] {
  if (!s.sku_compatibility || !Array.isArray(s.sku_compatibility)) {
    return [];
  }
  return s.sku_compatibility.map((c: unknown) => {
    const rule = c as Record<string, unknown>;
    return {
      sourceSkuId: (rule.source_sku_id as string) ?? '',
      targetSkuId: (rule.target_sku_id as string) ?? '',
      relationshipType: mapRelationshipType((rule.relationship_type as string) ?? 'COMPATIBLE_WITH'),
      isMandatory: (rule.is_mandatory as boolean) ?? false,
    };
  });
}

function mapRelationshipType(r: string): 'REQUIRES' | 'COMPATIBLE_WITH' | 'ALTERNATIVE_TO' {
  if (r === 'REQUIRES') return 'REQUIRES';
  if (r === 'ALTERNATIVE_TO') return 'ALTERNATIVE_TO';
  return 'COMPATIBLE_WITH';
}

/**
 * Maps v2 snapshot rule_set to pipeline BomRuleSet format.
 */
export function mapRuleSet(s: SnapshotData): BomRuleSet {
  if (!s.rule_set) {
    return {};
  }
  const ruleSet = s.rule_set as SnapshotRuleSet;
  return {
    constants: ruleSet.constants ?? undefined,
  };
}

// --- V1 Legacy Mapper ---

/**
 * V1 legacy mapper for old client-built snapshots.
 * V1 snapshots lack: alternatives, hidden_components, consultant_permissions,
 * and frozen sku_compatibility. This mapper degrades explicitly, returning
 * empty arrays for missing data so legacy projects keep their exact frozen state.
 */
export function mapSnapshotV1ToPipeline(snapshotData: Record<string, unknown>): BomSnapshotData {
  // V1 snapshots may already be in camelCase format (built client-side)
  const rawZones = (snapshotData.zones as unknown[]) ?? [];

  const zones: BomSnapshotZone[] = rawZones.map((z: unknown) => {
    const zone = z as Record<string, unknown>;
    return {
      zoneId: (zone.zoneId as string) ?? (zone.zone_id as string) ?? '',
      x: (zone.x as number) ?? (zone.x_mm as number) ?? 0,
      y: (zone.y as number) ?? (zone.y_mm as number) ?? 0,
      width: (zone.width as number) ?? (zone.width_mm as number) ?? 0,
      height: (zone.height as number) ?? (zone.height_mm as number) ?? 0,
      skuId: (zone.skuId as string) ?? (zone.sku_id as string) ?? '',
      panelWidth: (zone.panelWidth as number) ?? undefined,
      panelHeight: (zone.panelHeight as number) ?? undefined,
      gapHorizontal: (zone.gapHorizontal as number) ?? undefined,
      gapVertical: (zone.gapVertical as number) ?? undefined,
      wasteFactor: (zone.wasteFactor as number) ?? undefined,
      widthStrategy: (zone.widthStrategy as 'LOCKED' | 'RESIZABLE') ?? undefined,
      heightMode: (zone.heightMode as 'DERIVED_FROM_WALL' | 'FIXED' | 'RESIZABLE') ?? undefined,
    };
  });

  // V1 may have lighting/furniture in camelCase already
  const rawLighting = (snapshotData.lighting as unknown[]) ?? [];
  const lighting: BomSnapshotLighting[] = rawLighting.map((l: unknown) => {
    const light = l as Record<string, unknown>;
    return {
      componentId: (light.componentId as string) ?? '',
      skuId: (light.skuId as string) ?? '',
      edges: (light.edges as Array<{ length: number }>) ?? [{ length: 0 }],
      mountingType: (light.mountingType as 'DIRECT' | 'PROFILE' | 'COVE') ?? 'DIRECT',
      mode: (light.mode as 'DISCRETE' | 'LINEAR') ?? 'LINEAR',
      unitLength: (light.unitLength as number) ?? 0,
    };
  });

  const rawFurniture = (snapshotData.furniture as unknown[]) ?? [];
  const furniture: BomSnapshotFurniture[] = rawFurniture.map((f: unknown) => {
    const item = f as Record<string, unknown>;
    return {
      componentId: (item.componentId as string) ?? '',
      skuId: (item.skuId as string) ?? '',
      quantity: (item.quantity as number) ?? 1,
      min: (item.min as number) ?? 0,
      max: (item.max as number) ?? 10,
    };
  });

  // V1 has no hidden_components
  return {
    zones,
    lighting: lighting.length > 0 ? lighting : undefined,
    furniture: furniture.length > 0 ? furniture : undefined,
    hiddenComponents: undefined,
  };
}

/**
 * V1 legacy mapper: no consultant_permissions exist.
 */
export function mapPermissionsV1(): PermissionRule[] {
  return [];
}

/**
 * V1 legacy mapper: no sku_compatibility frozen in snapshot.
 */
export function mapCompatibilityV1(): CompatibilityRule[] {
  return [];
}

/**
 * V1 legacy mapper: no rule_set frozen in snapshot.
 */
export function mapRuleSetV1(): BomRuleSet {
  return {};
}
