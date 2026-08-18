import { describe, it, expect } from 'vitest';
import { readSnapshot, getSnapshotVersion } from '../snapshotReader';

const v2Snapshot = {
  snapshot_version: 2,
  template: {
    template_id: 'tpl-1',
    name: 'Frozen Template',
    status: 'ACTIVE',
    waste_factor: 0.05,
  },
  wall_geometry: { type: 'L_CORNER', base_width_mm: 3000, base_height_mm: 2400 },
  base_dimensions: { width_mm: 3000, height_mm: 2400 },
  zones: [
    {
      zone_id: 'zone-1',
      template_id: 'tpl-1',
      created_at: '2026-01-01T00:00:00Z',
      segment: 'SEGMENT_A',
      x_mm: 0,
      y_mm: 0,
      width_mm: 600,
      height_mm: 2400,
      width_strategy: 'PROPORTIONAL',
      height_strategy: 'DERIVED_FROM_WALL',
      position_strategy: 'FIXED',
      primary_sku: { sku_id: 'sku-1', sku_code: 'PRIMARY' },
      alternatives: [
        { alternative_id: 'alt-1', display_order: 1, reason: null, sku: { sku_id: 'sku-2', sku_code: 'ALT' } },
      ],
    },
  ],
  lighting: [{ lighting_id: 'lt-1' }],
  furniture: [{ furniture_id: 'fn-1' }],
  trims: [{ trim_id: 'tr-1' }],
  hidden_components: [{ hidden_component_id: 'hc-1', is_mandatory: true }],
  consultant_permissions: [{ permission_id: 'perm-1', parameter_key: 'ZONE_WIDTH', edit_mode: 'RESTRICTED' }],
  template_wall_configuration: { panel_width_mm: 600 },
  sku_compatibility: [{ compatibility_id: 'cmp-1' }],
  rule_set: { rule_set_id: 'rs-1', rule_set_code: 'RS-2026-001', version: '1.0.0', constants: { ZONE_MIN_WIDTH: 200 } },
  calculation_parameters: { waste_factor: 0.05 },
};

const v1Snapshot = {
  wall_geometry: { type: 'STRAIGHT', base_width_mm: 2400, base_height_mm: 2400 },
  base_dimensions: { width_mm: 2400, height_mm: 2400 },
  zones: [
    {
      zone_id: 'zone-legacy',
      x_mm: 10,
      y_mm: 20,
      width_mm: 500,
      height_mm: 2000,
      width_strategy: 'FIXED',
      height_strategy: 'FIXED',
      position_strategy: 'FIXED',
      primary_sku: { sku_id: 'sku-legacy', sku_code: 'LEGACY' },
      alternatives: [],
    },
  ],
  lighting: [],
  furniture: [],
  trims: [],
  hidden_components: [],
  calculation_parameters: {},
  consultant_permissions: { wall_width: 'EDITABLE' },
  project_metadata: { customer_reference: 'CUST-1', site_reference: 'SITE-1' },
};

describe('snapshotReader', () => {
  it('detects the snapshot generation, defaulting a missing version to legacy v1', () => {
    expect(getSnapshotVersion(v2Snapshot)).toBe(2);
    expect(getSnapshotVersion(v1Snapshot)).toBe(1);
    expect(getSnapshotVersion(null)).toBe(1);
  });

  it('hydrates a v2 snapshot including alternatives, permissions and rule set', () => {
    const hydrated = readSnapshot(v2Snapshot);

    expect(hydrated.version).toBe(2);
    expect(hydrated.template?.name).toBe('Frozen Template');
    expect(hydrated.wallGeometry.type).toBe('L_CORNER');
    expect(hydrated.zones).toHaveLength(1);
    expect(hydrated.zones[0]).toMatchObject({
      zone_id: 'zone-1',
      template_id: 'tpl-1',
      segment: 'SEGMENT_A',
      width_mm: 600,
    });
    expect(hydrated.zoneSku.get('zone-1')?.sku_code).toBe('PRIMARY');
    expect(hydrated.zoneAlternatives.get('zone-1')).toHaveLength(1);
    expect(hydrated.zoneAlternatives.get('zone-1')?.[0].sku.sku_code).toBe('ALT');
    expect(hydrated.consultantPermissions[0].parameter_key).toBe('ZONE_WIDTH');
    expect(hydrated.hiddenComponents).toHaveLength(1);
    expect(hydrated.skuCompatibility).toHaveLength(1);
    expect(hydrated.ruleSet?.rule_set_code).toBe('RS-2026-001');
    expect(hydrated.calculationParameters).toEqual({ waste_factor: 0.05 });
    expect(hydrated.templateWallConfiguration).toEqual({ panel_width_mm: 600 });
  });

  it('hydrates a legacy v1 snapshot without inventing v2 data', () => {
    const hydrated = readSnapshot(v1Snapshot, 'tpl-legacy');

    expect(hydrated.version).toBe(1);
    expect(hydrated.zones[0]).toMatchObject({
      zone_id: 'zone-legacy',
      template_id: 'tpl-legacy',
      segment: null,
      x_mm: 10,
      created_at: '',
    });
    expect(hydrated.zoneSku.get('zone-legacy')?.sku_code).toBe('LEGACY');
    expect(hydrated.zoneAlternatives.size).toBe(0);
    expect(hydrated.consultantPermissions).toEqual([]);
    expect(hydrated.wallPermissions).toEqual({ wall_width: 'EDITABLE' });
    expect(hydrated.ruleSet).toBeNull();
  });

  it('reconstructs a geometry-carrying template for legacy projects', () => {
    // currentTemplate drives the canvas wall size, zone validation bounds and
    // the zone properties panel; a null here silently degrades legacy projects.
    const hydrated = readSnapshot(v1Snapshot, 'tpl-legacy');

    expect(hydrated.template).not.toBeNull();
    expect(hydrated.template?.template_id).toBe('tpl-legacy');
    expect(hydrated.template?.wall_geometry).toMatchObject({
      type: 'STRAIGHT',
      base_width_mm: 2400,
      base_height_mm: 2400,
    });
  });

  it('tolerates an empty or malformed snapshot', () => {
    const hydrated = readSnapshot({});
    expect(hydrated.zones).toEqual([]);
    expect(hydrated.wallGeometry).toEqual({ type: 'STRAIGHT', base_width_mm: 0, base_height_mm: 0 });
  });
});
