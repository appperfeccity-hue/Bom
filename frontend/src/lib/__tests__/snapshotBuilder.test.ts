import { describe, it, expect } from 'vitest';
import { buildSnapshotData, computeSnapshotHash } from '../snapshotBuilder';
import type { SnapshotData } from '../snapshotBuilder';
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
  id: 'tpl-1',
  name: 'Test Template',
  description: null,
  status: TemplateStatus.ACTIVE,
  wall_geometry: 'STRAIGHT',
  base_width_mm: 3000,
  base_height_mm: 2700,
  adaptation_strategy: AdaptationStrategy.SCALE,
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  version: 1,
  ...overrides,
});

const makeZone = (overrides: Partial<TemplateZone> = {}): TemplateZone => ({
  id: 'zone-1',
  template_id: 'tpl-1',
  name: 'Zone A',
  x_mm: 100,
  y_mm: 200,
  width_mm: 1000,
  height_mm: 800,
  width_strategy: 'FIXED' as TemplateZone['width_strategy'],
  height_strategy: 'FIXED' as TemplateZone['height_strategy'],
  position_strategy: 'ABSOLUTE' as TemplateZone['position_strategy'],
  z_index: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
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
  id: 'light-1',
  template_id: 'tpl-1',
  name: 'Spotlight A',
  type: 'SPOT',
  x_mm: 500,
  y_mm: 100,
  width_mm: 50,
  height_mm: 50,
  configuration: { brightness: 80 },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeFurniture = (overrides: Partial<TemplateFurniture> = {}): TemplateFurniture => ({
  id: 'furn-1',
  template_id: 'tpl-1',
  name: 'Chair A',
  type: 'CHAIR',
  x_mm: 200,
  y_mm: 300,
  width_mm: 400,
  height_mm: 400,
  rotation_deg: 0,
  configuration: {},
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeTrim = (overrides: Partial<TemplateTrim> = {}): TemplateTrim => ({
  id: 'trim-1',
  template_id: 'tpl-1',
  name: 'Base Trim',
  type: 'BASE',
  path_mm: [{ x: 0, y: 0 }, { x: 3000, y: 0 }],
  configuration: {},
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
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

      expect(result.wall_geometry).toBe('STRAIGHT');
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
      const zone = makeZone({ id: 'zone-2', name: 'Zone B', x_mm: 50, y_mm: 75, width_mm: 500, height_mm: 600, z_index: 3 });
      const zoneSku = new Map<string, SkuMaster>();

      const result = buildSnapshotData(template, [zone], [], [], [], zoneSku);

      expect(result.zones[0]).toEqual({
        id: 'zone-2',
        name: 'Zone B',
        x_mm: 50,
        y_mm: 75,
        width_mm: 500,
        height_mm: 600,
        width_strategy: 'FIXED',
        height_strategy: 'FIXED',
        position_strategy: 'ABSOLUTE',
        z_index: 3,
        primary_sku: null,
        alternatives: [],
      });
    });

    it('includes zone SKU freeze data when zoneSku map has entries', () => {
      const template = makeTemplate();
      const zone1 = makeZone({ id: 'zone-1' });
      const zone2 = makeZone({ id: 'zone-2', name: 'Zone B' });
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
      const zone = makeZone({ id: 'zone-1' });
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
      const template = makeTemplate({ wall_geometry: 'L_CORNER', base_width_mm: 5000, base_height_mm: 3000 });
      const zoneSku = new Map<string, SkuMaster>();

      const result = buildSnapshotData(template, [], [], [], [], zoneSku);

      expect(result.wall_geometry).toBe('L_CORNER');
      expect(result.base_dimensions).toEqual({ width_mm: 5000, height_mm: 3000 });
    });
  });

  describe('computeSnapshotHash', () => {
    it('returns a consistent hex string for the same input', async () => {
      const snapshotData: SnapshotData = {
        wall_geometry: 'STRAIGHT',
        base_dimensions: { width_mm: 3000, height_mm: 2700 },
        zones: [],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
      };

      const hash1 = await computeSnapshotHash(snapshotData);
      const hash2 = await computeSnapshotHash(snapshotData);

      expect(hash1).toBe(hash2);
      // SHA-256 produces 64 hex chars
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('returns different values for different inputs', async () => {
      const data1: SnapshotData = {
        wall_geometry: 'STRAIGHT',
        base_dimensions: { width_mm: 3000, height_mm: 2700 },
        zones: [],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
      };

      const data2: SnapshotData = {
        wall_geometry: 'L_CORNER',
        base_dimensions: { width_mm: 5000, height_mm: 3000 },
        zones: [],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
      };

      const hash1 = await computeSnapshotHash(data1);
      const hash2 = await computeSnapshotHash(data2);

      expect(hash1).not.toBe(hash2);
    });

    it('returns different hash when zones are added', async () => {
      const baseData: SnapshotData = {
        wall_geometry: 'STRAIGHT',
        base_dimensions: { width_mm: 3000, height_mm: 2700 },
        zones: [],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
      };

      const dataWithZone: SnapshotData = {
        ...baseData,
        zones: [{
          id: 'zone-1',
          name: 'Zone A',
          x_mm: 0,
          y_mm: 0,
          width_mm: 1000,
          height_mm: 800,
          width_strategy: 'FIXED',
          height_strategy: 'FIXED',
          position_strategy: 'ABSOLUTE',
          z_index: 1,
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
        wall_geometry: 'STRAIGHT',
        base_dimensions: { width_mm: 3000, height_mm: 2700 },
        zones: [{
          id: 'zone-1',
          name: 'Zone A',
          x_mm: 0,
          y_mm: 0,
          width_mm: 1000,
          height_mm: 800,
          width_strategy: 'FIXED',
          height_strategy: 'FIXED',
          position_strategy: 'ABSOLUTE',
          z_index: 1,
          primary_sku: null,
          alternatives: [],
        }],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
      };

      const data2: SnapshotData = {
        wall_geometry: 'STRAIGHT',
        base_dimensions: { width_mm: 3000, height_mm: 2700 },
        zones: [{
          id: 'zone-1',
          name: 'Zone A',
          x_mm: 0,
          y_mm: 0,
          width_mm: 2000,
          height_mm: 800,
          width_strategy: 'FIXED',
          height_strategy: 'FIXED',
          position_strategy: 'ABSOLUTE',
          z_index: 1,
          primary_sku: null,
          alternatives: [],
        }],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
      };

      const hash1 = await computeSnapshotHash(data1);
      const hash2 = await computeSnapshotHash(data2);

      expect(hash1).not.toBe(hash2);
    });

    it('includes nested base_dimensions properties in hash', async () => {
      const data1: SnapshotData = {
        wall_geometry: 'STRAIGHT',
        base_dimensions: { width_mm: 3000, height_mm: 2700 },
        zones: [],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
      };

      const data2: SnapshotData = {
        wall_geometry: 'STRAIGHT',
        base_dimensions: { width_mm: 3000, height_mm: 3000 },
        zones: [],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
      };

      const hash1 = await computeSnapshotHash(data1);
      const hash2 = await computeSnapshotHash(data2);

      expect(hash1).not.toBe(hash2);
    });
  });
});
