/**
 * Integration Test Area 1: Template Integrity
 *
 * Validates that:
 * - Published template data is immutable (buildSnapshotData produces identical output for same inputs)
 * - computeSnapshotHash returns deterministic hashes
 * - Dimensions propagate correctly from template to snapshot zones
 */

import { describe, it, expect } from 'vitest';
import { buildSnapshotData, computeSnapshotHash } from '@/lib/snapshotBuilder';
import type { Template, TemplateZone, TemplateLighting, TemplateFurniture, TemplateTrim, SkuMaster } from '@/types/database';
import { TemplateStatus, AdaptationStrategy, ZoneWidthStrategy, ZoneHeightStrategy, ZonePositionStrategy, ProductType, SkuStatus, QuantityMode } from '@/types/database';

// --- Fixtures ---

function createTemplate(): Template {
  return {
    id: 'template-001',
    name: 'Test Straight Wall',
    description: 'A test template',
    status: TemplateStatus.ACTIVE,
    wall_geometry: 'STRAIGHT',
    base_width_mm: 3000,
    base_height_mm: 2400,
    adaptation_strategy: AdaptationStrategy.SCALE,
    created_by: 'designer-001',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    version: 1,
  };
}

function createTemplateZones(): TemplateZone[] {
  return [
    {
      id: 'zone-a',
      template_id: 'template-001',
      name: 'Left Zone',
      x_mm: 0,
      y_mm: 0,
      width_mm: 1500,
      height_mm: 2400,
      width_strategy: ZoneWidthStrategy.PROPORTIONAL,
      height_strategy: ZoneHeightStrategy.FILL,
      position_strategy: ZonePositionStrategy.ABSOLUTE,
      z_index: 0,
      segment: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'zone-b',
      template_id: 'template-001',
      name: 'Right Zone',
      x_mm: 1500,
      y_mm: 0,
      width_mm: 1500,
      height_mm: 2400,
      width_strategy: ZoneWidthStrategy.PROPORTIONAL,
      height_strategy: ZoneHeightStrategy.FILL,
      position_strategy: ZonePositionStrategy.ABSOLUTE,
      z_index: 1,
      segment: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];
}

function createSkuMaster(skuId: string): SkuMaster {
  return {
    sku_id: skuId,
    sku_code: `CODE-${skuId}`,
    product_type: ProductType.WALL_PANEL,
    family_id: 'family-001',
    category_id: 'category-001',
    width_mm: 600,
    height_mm: 1200,
    thickness_mm: 12,
    depth_mm: null,
    unit_length_mm: null,
    material: 'Oak',
    colour: 'Natural',
    finish: 'Matte',
    pattern_identity: null,
    gh_mm: 3,
    gv_mm: 3,
    quantity_mode: QuantityMode.DISCRETE,
    commercial_attributes: {},
    status: SkuStatus.ACTIVE,
    created_by: 'admin',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

describe('Integration Area 1: Template Integrity', () => {
  describe('Published template immutability', () => {
    it('buildSnapshotData produces identical output for same inputs', () => {
      const template = createTemplate();
      const zones = createTemplateZones();
      const lighting: TemplateLighting[] = [];
      const furniture: TemplateFurniture[] = [];
      const trims: TemplateTrim[] = [];
      const skuMap = new Map<string, SkuMaster>();
      skuMap.set('zone-a', createSkuMaster('sku-oak-001'));
      skuMap.set('zone-b', createSkuMaster('sku-oak-002'));

      const snapshot1 = buildSnapshotData(template, zones, lighting, furniture, trims, skuMap);
      const snapshot2 = buildSnapshotData(template, zones, lighting, furniture, trims, skuMap);

      expect(snapshot1).toEqual(snapshot2);
    });

    it('buildSnapshotData preserves all zone data without mutation', () => {
      const template = createTemplate();
      const zones = createTemplateZones();
      const lighting: TemplateLighting[] = [];
      const furniture: TemplateFurniture[] = [];
      const trims: TemplateTrim[] = [];
      const skuMap = new Map<string, SkuMaster>();
      skuMap.set('zone-a', createSkuMaster('sku-oak-001'));

      const snapshot = buildSnapshotData(template, zones, lighting, furniture, trims, skuMap);

      // Verify zone data preserved
      expect(snapshot.zones).toHaveLength(2);
      expect(snapshot.zones[0].id).toBe('zone-a');
      expect(snapshot.zones[0].x_mm).toBe(0);
      expect(snapshot.zones[0].width_mm).toBe(1500);
      expect(snapshot.zones[0].height_mm).toBe(2400);
      expect(snapshot.zones[1].id).toBe('zone-b');
      expect(snapshot.zones[1].x_mm).toBe(1500);
    });
  });

  describe('Snapshot hash determinism', () => {
    it('computeSnapshotHash returns same hash for identical data', async () => {
      const template = createTemplate();
      const zones = createTemplateZones();
      const lighting: TemplateLighting[] = [];
      const furniture: TemplateFurniture[] = [];
      const trims: TemplateTrim[] = [];
      const skuMap = new Map<string, SkuMaster>();
      skuMap.set('zone-a', createSkuMaster('sku-oak-001'));

      const snapshot1 = buildSnapshotData(template, zones, lighting, furniture, trims, skuMap);
      const snapshot2 = buildSnapshotData(template, zones, lighting, furniture, trims, skuMap);

      const hash1 = await computeSnapshotHash(snapshot1);
      const hash2 = await computeSnapshotHash(snapshot2);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
    });

    it('computeSnapshotHash produces different hash for different data', async () => {
      const template = createTemplate();
      const zones = createTemplateZones();
      const lighting: TemplateLighting[] = [];
      const furniture: TemplateFurniture[] = [];
      const trims: TemplateTrim[] = [];
      const skuMap = new Map<string, SkuMaster>();
      skuMap.set('zone-a', createSkuMaster('sku-oak-001'));

      const snapshot1 = buildSnapshotData(template, zones, lighting, furniture, trims, skuMap);

      // Modify one zone dimension
      const modifiedZones = [...zones];
      modifiedZones[0] = { ...modifiedZones[0], width_mm: 1600 };
      const snapshot2 = buildSnapshotData(template, modifiedZones, lighting, furniture, trims, skuMap);

      const hash1 = await computeSnapshotHash(snapshot1);
      const hash2 = await computeSnapshotHash(snapshot2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Dimension propagation', () => {
    it('snapshot zone dimensions match template zone dimensions exactly', () => {
      const template = createTemplate();
      const zones = createTemplateZones();
      const lighting: TemplateLighting[] = [];
      const furniture: TemplateFurniture[] = [];
      const trims: TemplateTrim[] = [];
      const skuMap = new Map<string, SkuMaster>();

      const snapshot = buildSnapshotData(template, zones, lighting, furniture, trims, skuMap);

      for (let i = 0; i < zones.length; i++) {
        expect(snapshot.zones[i].x_mm).toBe(zones[i].x_mm);
        expect(snapshot.zones[i].y_mm).toBe(zones[i].y_mm);
        expect(snapshot.zones[i].width_mm).toBe(zones[i].width_mm);
        expect(snapshot.zones[i].height_mm).toBe(zones[i].height_mm);
      }
    });

    it('snapshot base_dimensions match template dimensions', () => {
      const template = createTemplate();
      const zones = createTemplateZones();
      const lighting: TemplateLighting[] = [];
      const furniture: TemplateFurniture[] = [];
      const trims: TemplateTrim[] = [];
      const skuMap = new Map<string, SkuMaster>();

      const snapshot = buildSnapshotData(template, zones, lighting, furniture, trims, skuMap);

      expect(snapshot.base_dimensions.width_mm).toBe(template.base_width_mm);
      expect(snapshot.base_dimensions.height_mm).toBe(template.base_height_mm);
    });

    it('snapshot preserves wall_geometry from template', () => {
      const template = createTemplate();
      const zones = createTemplateZones();
      const lighting: TemplateLighting[] = [];
      const furniture: TemplateFurniture[] = [];
      const trims: TemplateTrim[] = [];
      const skuMap = new Map<string, SkuMaster>();

      const snapshot = buildSnapshotData(template, zones, lighting, furniture, trims, skuMap);

      expect(snapshot.wall_geometry).toBe(template.wall_geometry);
    });
  });
});
