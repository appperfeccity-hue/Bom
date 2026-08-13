import { describe, it, expect } from 'vitest';
import { buildSnapshotData, computeSnapshotHash } from '../snapshotBuilder';
import type { SnapshotData } from '../snapshotBuilder';

/** Amendment 001 fields with defaults for test SnapshotData literals */
const AMENDMENT_DEFAULTS = {
  template_wall_configuration: null,
  consultant_permissions: null,
  project_wall_configuration: null,
  site_obstructions: [] as never[],
  generated_panel_frames: [] as never[],
} as const;
import {
  TemplateStatus,
  AdaptationStrategy,
  SkuStatus,
  ProductType,
} from '@/types/database';
import type {
  Template,
  TemplateZone,
  TemplateLighting,
  TemplateFurniture,
  TemplateTrim,
  SkuMaster,
} from '@/types/database';

const makeTemplate = (overrides: Partial<Template> = {}): Template => ({
  template_id: 'tpl-1',
  name: 'Test Template',
  description: null,
  wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2700 },
  status: TemplateStatus.ACTIVE,
  adaptation_strategy: AdaptationStrategy.PROPORTIONAL,
  design_family_id: null,
  design_subfamily_id: null,
  wall_application: null,
  priority_zone_id: null,
  waste_factor: null,
  metadata: null,
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeZone = (overrides: Partial<TemplateZone> = {}): TemplateZone => ({
  zone_id: 'zone-1',
  template_id: 'tpl-1',
  x_mm: 100,
  y_mm: 200,
  width_mm: 1000,
  height_mm: 800,
  width_strategy: 'FIXED' as TemplateZone['width_strategy'],
  height_strategy: 'FIXED' as TemplateZone['height_strategy'],
  position_strategy: 'FIXED' as TemplateZone['position_strategy'],
  segment: null,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeSku = (overrides: Partial<SkuMaster> = {}): SkuMaster => ({
  sku_id: 'sku-1',
  sku_code: 'WP-001',
  product_type: ProductType.WALL_PANEL,
  family_id: 'fam-1',
  category_id: 'cat-1',
  width_mm: 600,
  height_mm: 2400,
  thickness_mm: 18,
  depth_mm: null,
  unit_length_mm: null,
  material: 'Oak',
  colour: 'Natural',
  finish: 'Matte',
  pattern_identity: null,
  gh_mm: 0,
  gv_mm: 0,
  quantity_mode: null,
  commercial_attributes: {},
  status: SkuStatus.ACTIVE,
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeLighting = (overrides: Partial<TemplateLighting> = {}): TemplateLighting => ({
  lighting_id: 'light-1',
  template_id: 'tpl-1',
  sku_id: 'sku-light-1',
  edge_selection: null,
  mounting_type: 'DIRECT',
  quantity_rule: null,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeFurniture = (overrides: Partial<TemplateFurniture> = {}): TemplateFurniture => ({
  furniture_id: 'furn-1',
  template_id: 'tpl-1',
  sku_id: 'sku-furn-1',
  position_x_mm: 200,
  position_y_mm: 300,
  orientation: 'HORIZONTAL',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeTrim = (overrides: Partial<TemplateTrim> = {}): TemplateTrim => ({
  trim_id: 'trim-1',
  template_id: 'tpl-1',
  sku_id: 'sku-trim-1',
  trim_type: 'PHYSICAL',
  quantity_rule: 'TRIM_BY_ZONE_PERIMETER',
  fixed_quantity: null,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('snapshotBuilder', () => {
  describe('buildSnapshotData', () => {
    it('returns correctly structured object with all frozen fields', () => {
      const template = makeTemplate();
      const zones = [makeZone()];
      const lighting = [makeLighting()];
      const furniture = [makeFurniture()];
      const trims = [makeTrim()];
      const zoneSku = new Map<string, SkuMaster>();

      const result = buildSnapshotData(template, zones, lighting, furniture, trims, zoneSku);

      expect(result.wall_geometry).toEqual({ type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2700 });
      expect(result.base_dimensions).toEqual({ width_mm: 3000, height_mm: 2700 });
      expect(result.zones).toHaveLength(1);
      expect(result.lighting).toEqual(lighting);
      expect(result.furniture).toEqual(furniture);
      expect(result.trims).toEqual(trims);
      expect(result.hidden_components).toEqual([]);
      expect(result.calculation_parameters).toEqual({});
    });

    it('maps zones with correct properties', () => {
      const template = makeTemplate();
      const zone = makeZone({ zone_id: 'zone-2', x_mm: 50, y_mm: 75, width_mm: 500, height_mm: 600 });
      const zoneSku = new Map<string, SkuMaster>();

      const result = buildSnapshotData(template, [zone], [], [], [], zoneSku);

      expect(result.zones[0]).toEqual({
        zone_id: 'zone-2',
        x_mm: 50,
        y_mm: 75,
        width_mm: 500,
        height_mm: 600,
        width_strategy: 'FIXED',
        height_strategy: 'FIXED',
        position_strategy: 'FIXED',
        primary_sku: null,
        alternatives: [],
      });
    });

    it('includes zone SKU freeze data when zoneSku map has entries', () => {
      const template = makeTemplate();
      const zone1 = makeZone({ zone_id: 'zone-1' });
      const zone2 = makeZone({ zone_id: 'zone-2' });
      const sku1 = makeSku({ sku_id: 'sku-1', sku_code: 'WP-001' });
      const sku2 = makeSku({ sku_id: 'sku-2', sku_code: 'WP-002', material: 'Walnut' });

      const zoneSku = new Map<string, SkuMaster>();
      zoneSku.set('zone-1', sku1);
      zoneSku.set('zone-2', sku2);

      const result = buildSnapshotData(template, [zone1, zone2], [], [], [], zoneSku);

      expect(result.zones[0].primary_sku).toEqual(sku1);
      expect(result.zones[1].primary_sku).toEqual(sku2);
    });

    it('sets primary_sku to null for zones without SKU mapping', () => {
      const template = makeTemplate();
      const zone = makeZone({ zone_id: 'zone-1' });
      const zoneSku = new Map<string, SkuMaster>();
      // No entry for zone-1

      const result = buildSnapshotData(template, [zone], [], [], [], zoneSku);

      expect(result.zones[0].primary_sku).toBeNull();
    });

    it('handles empty arrays gracefully', () => {
      const template = makeTemplate();
      const zoneSku = new Map<string, SkuMaster>();

      const result = buildSnapshotData(template, [], [], [], [], zoneSku);

      expect(result.zones).toEqual([]);
      expect(result.lighting).toEqual([]);
      expect(result.furniture).toEqual([]);
      expect(result.trims).toEqual([]);
    });

    it('uses template wall_geometry and base dimensions', () => {
      const template = makeTemplate({
        wall_geometry: { type: 'L_CORNER', base_width_mm: 5000, base_height_mm: 3000 },
      });
      const zoneSku = new Map<string, SkuMaster>();

      const result = buildSnapshotData(template, [], [], [], [], zoneSku);

      expect(result.wall_geometry).toEqual({ type: 'L_CORNER', base_width_mm: 5000, base_height_mm: 3000 });
      expect(result.base_dimensions).toEqual({ width_mm: 5000, height_mm: 3000 });
    });
  });

  describe('computeSnapshotHash', () => {
    it('returns a consistent hex string for the same input', async () => {
      const snapshotData: SnapshotData = {
        wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2700 },
        base_dimensions: { width_mm: 3000, height_mm: 2700 },
        zones: [],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
        ...AMENDMENT_DEFAULTS,
        ...AMENDMENT_DEFAULTS,
      };

      const hash1 = await computeSnapshotHash(snapshotData);
      const hash2 = await computeSnapshotHash(snapshotData);

      expect(hash1).toBe(hash2);
      // SHA-256 produces 64 hex chars
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('returns different values for different inputs', async () => {
      const data1: SnapshotData = {
        wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2700 },
        base_dimensions: { width_mm: 3000, height_mm: 2700 },
        zones: [],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
        ...AMENDMENT_DEFAULTS,
      };

      const data2: SnapshotData = {
        wall_geometry: { type: 'STRAIGHT', base_width_mm: 5000, base_height_mm: 3000 },
        base_dimensions: { width_mm: 5000, height_mm: 3000 },
        zones: [],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
        ...AMENDMENT_DEFAULTS,
        ...AMENDMENT_DEFAULTS,
      };

      const hash1 = await computeSnapshotHash(data1);
      const hash2 = await computeSnapshotHash(data2);

      expect(hash1).not.toBe(hash2);
    });

    it('returns different hash when zones are added', async () => {
      const baseData: SnapshotData = {
        wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2700 },
        base_dimensions: { width_mm: 3000, height_mm: 2700 },
        zones: [],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
        ...AMENDMENT_DEFAULTS,
      };

      const dataWithZone: SnapshotData = {
        ...baseData,
        zones: [{
          zone_id: 'zone-1',
          x_mm: 0,
          y_mm: 0,
          width_mm: 1000,
          height_mm: 800,
          width_strategy: 'FIXED',
          height_strategy: 'FIXED',
          position_strategy: 'FIXED',
          primary_sku: null,
          alternatives: [],
        }],
      };

      const hash1 = await computeSnapshotHash(baseData);
      const hash2 = await computeSnapshotHash(dataWithZone);

      expect(hash1).not.toBe(hash2);
    });

    it('returns different hash when nested zone properties differ', async () => {
      const data1: SnapshotData = {
        wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2700 },
        base_dimensions: { width_mm: 3000, height_mm: 2700 },
        zones: [{
          zone_id: 'zone-1',
          x_mm: 0,
          y_mm: 0,
          width_mm: 1000,
          height_mm: 800,
          width_strategy: 'FIXED',
          height_strategy: 'FIXED',
          position_strategy: 'FIXED',
          primary_sku: null,
          alternatives: [],
        }],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
        ...AMENDMENT_DEFAULTS,
      };

      const data2: SnapshotData = {
        wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2700 },
        base_dimensions: { width_mm: 3000, height_mm: 2700 },
        zones: [{
          zone_id: 'zone-1',
          x_mm: 0,
          y_mm: 0,
          width_mm: 2000,
          height_mm: 800,
          width_strategy: 'FIXED',
          height_strategy: 'FIXED',
          position_strategy: 'FIXED',
          primary_sku: null,
          alternatives: [],
        }],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
        ...AMENDMENT_DEFAULTS,
      };

      const hash1 = await computeSnapshotHash(data1);
      const hash2 = await computeSnapshotHash(data2);

      expect(hash1).not.toBe(hash2);
    });

    it('includes nested base_dimensions properties in hash', async () => {
      const data1: SnapshotData = {
        wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2700 },
        base_dimensions: { width_mm: 3000, height_mm: 2700 },
        zones: [],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
        ...AMENDMENT_DEFAULTS,
      };

      const data2: SnapshotData = {
        wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 3000 },
        base_dimensions: { width_mm: 3000, height_mm: 3000 },
        zones: [],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
        ...AMENDMENT_DEFAULTS,
      };

      const hash1 = await computeSnapshotHash(data1);
      const hash2 = await computeSnapshotHash(data2);

      expect(hash1).not.toBe(hash2);
    });
  });
});
