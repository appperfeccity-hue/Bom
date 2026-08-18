import { describe, it, expect } from 'vitest';
import {
  mapSnapshotToPipeline,
  mapPermissions,
  mapCompatibility,
  mapRuleSet,
  mapSnapshotV1ToPipeline,
  mapPermissionsV1,
  mapCompatibilityV1,
  mapRuleSetV1,
} from '../snapshotMapper';
import type { SnapshotData } from '@/lib/snapshotBuilder';
import type { SkuMaster } from '@/types/database';

// --- Test Fixtures ---

function makeSkuMaster(overrides: Partial<SkuMaster> = {}): SkuMaster {
  return {
    sku_id: 'sku-001',
    sku_code: 'PNL-001',
    product_type: 'WALL_PANEL' as SkuMaster['product_type'],
    family_id: 'fam-1',
    category_id: 'cat-1',
    width_mm: 600,
    height_mm: 1200,
    thickness_mm: 18,
    depth_mm: null,
    unit_length_mm: null,
    material: 'MDF',
    colour: 'White',
    finish: 'Matte',
    pattern_identity: null,
    gh_mm: 3,
    gv_mm: 5,
    quantity_mode: null,
    commercial_attributes: {},
    status: 'ACTIVE' as SkuMaster['status'],
    created_by: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeSnapshotData(overrides: Partial<SnapshotData> = {}): SnapshotData {
  return {
    snapshot_version: 2,
    template: {
      template_id: 'tpl-1',
      name: 'Test Template',
      wall_application: 'FEATURE_WALL',
      adaptation_strategy: 'PROPORTIONAL',
      priority_zone_id: null,
      waste_factor: 0.05,
      metadata: null,
    },
    wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2400 },
    base_dimensions: { width_mm: 3000, height_mm: 2400 },
    zones: [
      {
        zone_id: 'zone-1',
        x_mm: 0,
        y_mm: 0,
        width_mm: 1500,
        height_mm: 2400,
        width_strategy: 'PROPORTIONAL',
        height_strategy: 'DERIVED_FROM_WALL',
        position_strategy: 'FIXED',
        primary_sku: makeSkuMaster(),
        alternatives: [],
      },
    ],
    lighting: [],
    furniture: [],
    trims: [],
    hidden_components: [],
    calculation_parameters: {},
    template_wall_configuration: null,
    consultant_permissions: null,
    site_obstructions: [],
    sku_compatibility: [],
    rule_set: null,
    ...overrides,
  };
}

// --- Tests ---

describe('snapshotMapper', () => {
  describe('mapSnapshotToPipeline', () => {
    describe('zone field mapping', () => {
      it('should map zone_id to zoneId', () => {
        const snapshot = makeSnapshotData();
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.zones[0].zoneId).toBe('zone-1');
      });

      it('should map x_mm/y_mm to x/y', () => {
        const snapshot = makeSnapshotData({
          zones: [{
            zone_id: 'z1', x_mm: 100, y_mm: 200, width_mm: 500, height_mm: 1000,
            width_strategy: 'FIXED', height_strategy: 'FIXED', position_strategy: 'FIXED',
            primary_sku: null, alternatives: [],
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.zones[0].x).toBe(100);
        expect(result.zones[0].y).toBe(200);
      });

      it('should map width_mm/height_mm to width/height', () => {
        const snapshot = makeSnapshotData({
          zones: [{
            zone_id: 'z1', x_mm: 0, y_mm: 0, width_mm: 750, height_mm: 2400,
            width_strategy: 'FIXED', height_strategy: 'FIXED', position_strategy: 'FIXED',
            primary_sku: null, alternatives: [],
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.zones[0].width).toBe(750);
        expect(result.zones[0].height).toBe(2400);
      });

      it('should map primary_sku.sku_id to skuId', () => {
        const snapshot = makeSnapshotData();
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.zones[0].skuId).toBe('sku-001');
      });

      it('should map primary_sku.width_mm to panelWidth', () => {
        const snapshot = makeSnapshotData();
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.zones[0].panelWidth).toBe(600);
      });

      it('should map primary_sku.height_mm to panelHeight', () => {
        const snapshot = makeSnapshotData();
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.zones[0].panelHeight).toBe(1200);
      });

      it('should map primary_sku.gh_mm to gapHorizontal', () => {
        const snapshot = makeSnapshotData();
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.zones[0].gapHorizontal).toBe(3);
      });

      it('should map primary_sku.gv_mm to gapVertical', () => {
        const snapshot = makeSnapshotData();
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.zones[0].gapVertical).toBe(5);
      });

      it('should use template.waste_factor for zone wasteFactor', () => {
        const snapshot = makeSnapshotData();
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.zones[0].wasteFactor).toBe(0.05);
      });

      it('should handle null primary_sku gracefully', () => {
        const snapshot = makeSnapshotData({
          zones: [{
            zone_id: 'z-null', x_mm: 0, y_mm: 0, width_mm: 500, height_mm: 1000,
            width_strategy: 'FIXED', height_strategy: 'FIXED', position_strategy: 'FIXED',
            primary_sku: null, alternatives: [],
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.zones[0].skuId).toBe('');
        expect(result.zones[0].panelWidth).toBeUndefined();
        expect(result.zones[0].panelHeight).toBeUndefined();
        expect(result.zones[0].gapHorizontal).toBeUndefined();
        expect(result.zones[0].gapVertical).toBeUndefined();
      });
    });

    describe('width_strategy mapping', () => {
      it('should map FIXED to RESIZABLE', () => {
        const snapshot = makeSnapshotData({
          zones: [{
            zone_id: 'z1', x_mm: 0, y_mm: 0, width_mm: 500, height_mm: 1000,
            width_strategy: 'FIXED', height_strategy: 'FIXED', position_strategy: 'FIXED',
            primary_sku: null, alternatives: [],
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.zones[0].widthStrategy).toBe('RESIZABLE');
      });

      it('should map PROPORTIONAL to RESIZABLE', () => {
        const snapshot = makeSnapshotData({
          zones: [{
            zone_id: 'z1', x_mm: 0, y_mm: 0, width_mm: 500, height_mm: 1000,
            width_strategy: 'PROPORTIONAL', height_strategy: 'FIXED', position_strategy: 'FIXED',
            primary_sku: null, alternatives: [],
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.zones[0].widthStrategy).toBe('RESIZABLE');
      });

      it('should map LOCKED to LOCKED', () => {
        const snapshot = makeSnapshotData({
          zones: [{
            zone_id: 'z1', x_mm: 0, y_mm: 0, width_mm: 500, height_mm: 1000,
            width_strategy: 'LOCKED', height_strategy: 'FIXED', position_strategy: 'FIXED',
            primary_sku: null, alternatives: [],
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.zones[0].widthStrategy).toBe('LOCKED');
      });
    });

    describe('height_strategy mapping', () => {
      it('should map DERIVED_FROM_WALL to DERIVED_FROM_WALL', () => {
        const snapshot = makeSnapshotData();
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.zones[0].heightMode).toBe('DERIVED_FROM_WALL');
      });

      it('should map FIXED to FIXED', () => {
        const snapshot = makeSnapshotData({
          zones: [{
            zone_id: 'z1', x_mm: 0, y_mm: 0, width_mm: 500, height_mm: 1000,
            width_strategy: 'FIXED', height_strategy: 'FIXED', position_strategy: 'FIXED',
            primary_sku: null, alternatives: [],
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.zones[0].heightMode).toBe('FIXED');
      });

      it('should map RESIZABLE to RESIZABLE', () => {
        const snapshot = makeSnapshotData({
          zones: [{
            zone_id: 'z1', x_mm: 0, y_mm: 0, width_mm: 500, height_mm: 1000,
            width_strategy: 'FIXED', height_strategy: 'RESIZABLE', position_strategy: 'FIXED',
            primary_sku: null, alternatives: [],
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.zones[0].heightMode).toBe('RESIZABLE');
      });
    });

    describe('lighting mapping', () => {
      it('should map lighting_id to componentId', () => {
        const snapshot = makeSnapshotData({
          lighting: [{
            lighting_id: 'light-1',
            template_id: 'tpl-1',
            sku_id: 'sku-led-001',
            edge_selection: JSON.stringify([{ length: 2000 }]),
            mounting_type: 'DIRECT',
            quantity_rule: null,
            created_at: '2024-01-01T00:00:00Z',
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.lighting).toBeDefined();
        expect(result.lighting![0].componentId).toBe('light-1');
      });

      it('should map sku_id to skuId', () => {
        const snapshot = makeSnapshotData({
          lighting: [{
            lighting_id: 'light-1',
            template_id: 'tpl-1',
            sku_id: 'sku-led-001',
            edge_selection: JSON.stringify([{ length: 2000 }]),
            mounting_type: 'PROFILE',
            quantity_rule: null,
            created_at: '2024-01-01T00:00:00Z',
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.lighting![0].skuId).toBe('sku-led-001');
      });

      it('should map mounting_type to mountingType', () => {
        const snapshot = makeSnapshotData({
          lighting: [{
            lighting_id: 'light-1',
            template_id: 'tpl-1',
            sku_id: 'sku-led-001',
            edge_selection: JSON.stringify([{ length: 2000 }]),
            mounting_type: 'COVE',
            quantity_rule: null,
            created_at: '2024-01-01T00:00:00Z',
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.lighting![0].mountingType).toBe('COVE');
      });

      it('should parse edge_selection JSON to edges array', () => {
        const snapshot = makeSnapshotData({
          lighting: [{
            lighting_id: 'light-1',
            template_id: 'tpl-1',
            sku_id: 'sku-led-001',
            edge_selection: JSON.stringify([{ length: 1500 }, { length: 2000 }]),
            mounting_type: 'DIRECT',
            quantity_rule: null,
            created_at: '2024-01-01T00:00:00Z',
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.lighting![0].edges).toEqual([{ length: 1500 }, { length: 2000 }]);
      });

      it('should handle null edge_selection', () => {
        const snapshot = makeSnapshotData({
          lighting: [{
            lighting_id: 'light-1',
            template_id: 'tpl-1',
            sku_id: 'sku-led-001',
            edge_selection: null,
            mounting_type: 'DIRECT',
            quantity_rule: null,
            created_at: '2024-01-01T00:00:00Z',
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.lighting![0].edges).toEqual([{ length: 0 }]);
      });

      it('should return undefined lighting when array is empty', () => {
        const snapshot = makeSnapshotData({ lighting: [] });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.lighting).toBeUndefined();
      });
    });

    describe('furniture mapping', () => {
      it('should map furniture_id to componentId', () => {
        const snapshot = makeSnapshotData({
          furniture: [{
            furniture_id: 'furn-1',
            template_id: 'tpl-1',
            sku_id: 'sku-desk-001',
            position_x_mm: 100,
            position_y_mm: 200,
            orientation: 'HORIZONTAL',
            created_at: '2024-01-01T00:00:00Z',
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.furniture).toBeDefined();
        expect(result.furniture![0].componentId).toBe('furn-1');
      });

      it('should map sku_id to skuId', () => {
        const snapshot = makeSnapshotData({
          furniture: [{
            furniture_id: 'furn-1',
            template_id: 'tpl-1',
            sku_id: 'sku-desk-001',
            position_x_mm: 100,
            position_y_mm: 200,
            orientation: 'HORIZONTAL',
            created_at: '2024-01-01T00:00:00Z',
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.furniture![0].skuId).toBe('sku-desk-001');
      });

      it('should return undefined furniture when array is empty', () => {
        const snapshot = makeSnapshotData({ furniture: [] });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.furniture).toBeUndefined();
      });
    });

    describe('hidden_components mapping', () => {
      it('should map hidden_component_id to componentId', () => {
        const snapshot = makeSnapshotData({
          hidden_components: [{
            hidden_component_id: 'hc-1',
            sku_id: 'sku-bracket-001',
            trigger_type: 'ALWAYS',
            trigger_condition: null,
            quantity_rule: 'FIXED',
            fixed_value: 4,
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.hiddenComponents).toBeDefined();
        expect(result.hiddenComponents![0].componentId).toBe('hc-1');
      });

      it('should map trigger_type to triggerType', () => {
        const snapshot = makeSnapshotData({
          hidden_components: [{
            hidden_component_id: 'hc-1',
            sku_id: 'sku-bracket-001',
            trigger_type: 'CONDITION',
            trigger_condition: { field: 'zone_count', operator: 'GT', value: 2 },
            quantity_rule: 'PER_ZONE',
            fixed_value: null,
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.hiddenComponents![0].triggerType).toBe('CONDITION');
      });

      it('should map trigger_condition to condition', () => {
        const snapshot = makeSnapshotData({
          hidden_components: [{
            hidden_component_id: 'hc-1',
            sku_id: 'sku-bracket-001',
            trigger_type: 'CONDITION',
            trigger_condition: { field: 'zone_count', operator: 'GT', value: 2 },
            quantity_rule: 'PER_ZONE',
            fixed_value: null,
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.hiddenComponents![0].condition).toEqual({
          field: 'zone_count',
          operator: 'GT',
          value: 2,
        });
      });

      it('should map quantity_rule to quantityRule', () => {
        const snapshot = makeSnapshotData({
          hidden_components: [{
            hidden_component_id: 'hc-1',
            sku_id: 'sku-bracket-001',
            trigger_type: 'ALWAYS',
            trigger_condition: null,
            quantity_rule: 'PER_PANEL',
            fixed_value: null,
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.hiddenComponents![0].quantityRule).toBe('PER_PANEL');
      });

      it('should map fixed_value to fixedValue', () => {
        const snapshot = makeSnapshotData({
          hidden_components: [{
            hidden_component_id: 'hc-1',
            sku_id: 'sku-bracket-001',
            trigger_type: 'ALWAYS',
            trigger_condition: null,
            quantity_rule: 'FIXED',
            fixed_value: 8,
          }],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.hiddenComponents![0].fixedValue).toBe(8);
      });

      it('should return undefined hiddenComponents when array is empty', () => {
        const snapshot = makeSnapshotData({ hidden_components: [] });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.hiddenComponents).toBeUndefined();
      });
    });

    describe('multiple zones', () => {
      it('should map all zones in order', () => {
        const snapshot = makeSnapshotData({
          zones: [
            {
              zone_id: 'z-a', x_mm: 0, y_mm: 0, width_mm: 1000, height_mm: 2400,
              width_strategy: 'PROPORTIONAL', height_strategy: 'DERIVED_FROM_WALL', position_strategy: 'FIXED',
              primary_sku: makeSkuMaster({ sku_id: 'sku-a' }), alternatives: [],
            },
            {
              zone_id: 'z-b', x_mm: 1000, y_mm: 0, width_mm: 2000, height_mm: 2400,
              width_strategy: 'LOCKED', height_strategy: 'FIXED', position_strategy: 'FIXED',
              primary_sku: makeSkuMaster({ sku_id: 'sku-b', width_mm: 800, height_mm: 1600 }), alternatives: [],
            },
          ],
        });
        const result = mapSnapshotToPipeline(snapshot);
        expect(result.zones).toHaveLength(2);
        expect(result.zones[0].zoneId).toBe('z-a');
        expect(result.zones[0].skuId).toBe('sku-a');
        expect(result.zones[1].zoneId).toBe('z-b');
        expect(result.zones[1].skuId).toBe('sku-b');
        expect(result.zones[1].panelWidth).toBe(800);
        expect(result.zones[1].panelHeight).toBe(1600);
        expect(result.zones[1].widthStrategy).toBe('LOCKED');
        expect(result.zones[1].heightMode).toBe('FIXED');
      });
    });
  });

  describe('mapPermissions', () => {
    it('should return empty array when consultant_permissions is null', () => {
      const snapshot = makeSnapshotData({ consultant_permissions: null });
      const result = mapPermissions(snapshot);
      expect(result).toEqual([]);
    });

    it('should map parameter_key to parameter', () => {
      const snapshot = makeSnapshotData({
        consultant_permissions: [{
          permission_id: 'perm-1',
          parameter_key: 'zone_width',
          parameter_type: 'NUMBER',
          edit_mode: 'ALLOWED',
          min_value: 100,
          max_value: 5000,
          allowed_values: null,
          source_component_id: null,
        }],
      });
      const result = mapPermissions(snapshot);
      expect(result[0].parameter).toBe('zone_width');
    });

    it('should set locked=true when edit_mode is LOCKED', () => {
      const snapshot = makeSnapshotData({
        consultant_permissions: [{
          permission_id: 'perm-1',
          parameter_key: 'sku_selection',
          parameter_type: 'SKU',
          edit_mode: 'LOCKED',
          min_value: null,
          max_value: null,
          allowed_values: null,
          source_component_id: null,
        }],
      });
      const result = mapPermissions(snapshot);
      expect(result[0].locked).toBe(true);
    });

    it('should set locked=false when edit_mode is ALLOWED', () => {
      const snapshot = makeSnapshotData({
        consultant_permissions: [{
          permission_id: 'perm-1',
          parameter_key: 'zone_width',
          parameter_type: 'NUMBER',
          edit_mode: 'ALLOWED',
          min_value: 100,
          max_value: 5000,
          allowed_values: null,
          source_component_id: null,
        }],
      });
      const result = mapPermissions(snapshot);
      expect(result[0].locked).toBe(false);
    });

    it('should map min_value/max_value to minValue/maxValue', () => {
      const snapshot = makeSnapshotData({
        consultant_permissions: [{
          permission_id: 'perm-1',
          parameter_key: 'zone_width',
          parameter_type: 'NUMBER',
          edit_mode: 'ALLOWED',
          min_value: 200,
          max_value: 4000,
          allowed_values: null,
          source_component_id: null,
        }],
      });
      const result = mapPermissions(snapshot);
      expect(result[0].minValue).toBe(200);
      expect(result[0].maxValue).toBe(4000);
    });

    it('should map allowed_values to allowedSkus (string values)', () => {
      const snapshot = makeSnapshotData({
        consultant_permissions: [{
          permission_id: 'perm-1',
          parameter_key: 'sku_selection',
          parameter_type: 'SKU',
          edit_mode: 'ALLOWED',
          min_value: null,
          max_value: null,
          allowed_values: ['sku-a', 'sku-b', 'sku-c'],
          source_component_id: null,
        }],
      });
      const result = mapPermissions(snapshot);
      expect(result[0].allowedSkus).toEqual(['sku-a', 'sku-b', 'sku-c']);
    });

    it('should handle multiple permissions', () => {
      const snapshot = makeSnapshotData({
        consultant_permissions: [
          {
            permission_id: 'perm-1',
            parameter_key: 'zone_width',
            parameter_type: 'NUMBER',
            edit_mode: 'ALLOWED',
            min_value: 100,
            max_value: 5000,
            allowed_values: null,
            source_component_id: null,
          },
          {
            permission_id: 'perm-2',
            parameter_key: 'sku_selection',
            parameter_type: 'SKU',
            edit_mode: 'LOCKED',
            min_value: null,
            max_value: null,
            allowed_values: null,
            source_component_id: null,
          },
        ],
      });
      const result = mapPermissions(snapshot);
      expect(result).toHaveLength(2);
      expect(result[0].parameter).toBe('zone_width');
      expect(result[1].parameter).toBe('sku_selection');
      expect(result[1].locked).toBe(true);
    });
  });

  describe('mapCompatibility', () => {
    it('should return empty array when sku_compatibility is undefined', () => {
      const snapshot = makeSnapshotData({ sku_compatibility: undefined });
      const result = mapCompatibility(snapshot);
      expect(result).toEqual([]);
    });

    it('should return empty array when sku_compatibility is empty', () => {
      const snapshot = makeSnapshotData({ sku_compatibility: [] });
      const result = mapCompatibility(snapshot);
      expect(result).toEqual([]);
    });

    it('should map source_sku_id to sourceSkuId', () => {
      const snapshot = makeSnapshotData({
        sku_compatibility: [{
          compatibility_id: 'comp-1',
          source_sku_id: 'sku-src',
          target_sku_id: 'sku-tgt',
          relationship_type: 'REQUIRES',
          directionality: 'UNIDIRECTIONAL',
          is_mandatory: true,
          status: 'ACTIVE',
          created_at: '2024-01-01T00:00:00Z',
        }],
      });
      const result = mapCompatibility(snapshot);
      expect(result[0].sourceSkuId).toBe('sku-src');
    });

    it('should map target_sku_id to targetSkuId', () => {
      const snapshot = makeSnapshotData({
        sku_compatibility: [{
          compatibility_id: 'comp-1',
          source_sku_id: 'sku-src',
          target_sku_id: 'sku-tgt',
          relationship_type: 'COMPATIBLE_WITH',
          directionality: 'BIDIRECTIONAL',
          is_mandatory: false,
          status: 'ACTIVE',
          created_at: '2024-01-01T00:00:00Z',
        }],
      });
      const result = mapCompatibility(snapshot);
      expect(result[0].targetSkuId).toBe('sku-tgt');
    });

    it('should map relationship_type to relationshipType', () => {
      const snapshot = makeSnapshotData({
        sku_compatibility: [{
          compatibility_id: 'comp-1',
          source_sku_id: 'sku-src',
          target_sku_id: 'sku-tgt',
          relationship_type: 'ALTERNATIVE_TO',
          directionality: 'BIDIRECTIONAL',
          is_mandatory: false,
          status: 'ACTIVE',
          created_at: '2024-01-01T00:00:00Z',
        }],
      });
      const result = mapCompatibility(snapshot);
      expect(result[0].relationshipType).toBe('ALTERNATIVE_TO');
    });

    it('should map is_mandatory to isMandatory', () => {
      const snapshot = makeSnapshotData({
        sku_compatibility: [{
          compatibility_id: 'comp-1',
          source_sku_id: 'sku-src',
          target_sku_id: 'sku-tgt',
          relationship_type: 'REQUIRES',
          directionality: 'UNIDIRECTIONAL',
          is_mandatory: true,
          status: 'ACTIVE',
          created_at: '2024-01-01T00:00:00Z',
        }],
      });
      const result = mapCompatibility(snapshot);
      expect(result[0].isMandatory).toBe(true);
    });

    it('should handle multiple compatibility rules', () => {
      const snapshot = makeSnapshotData({
        sku_compatibility: [
          {
            compatibility_id: 'comp-1',
            source_sku_id: 'sku-a',
            target_sku_id: 'sku-b',
            relationship_type: 'REQUIRES',
            directionality: 'UNIDIRECTIONAL',
            is_mandatory: true,
            status: 'ACTIVE',
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            compatibility_id: 'comp-2',
            source_sku_id: 'sku-c',
            target_sku_id: 'sku-d',
            relationship_type: 'COMPATIBLE_WITH',
            directionality: 'BIDIRECTIONAL',
            is_mandatory: false,
            status: 'ACTIVE',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });
      const result = mapCompatibility(snapshot);
      expect(result).toHaveLength(2);
      expect(result[0].sourceSkuId).toBe('sku-a');
      expect(result[1].sourceSkuId).toBe('sku-c');
    });
  });

  describe('mapRuleSet', () => {
    it('should return empty object when rule_set is null', () => {
      const snapshot = makeSnapshotData({ rule_set: null });
      const result = mapRuleSet(snapshot);
      expect(result).toEqual({});
    });

    it('should return empty object when rule_set is undefined', () => {
      const snapshot = makeSnapshotData({ rule_set: undefined });
      const result = mapRuleSet(snapshot);
      expect(result).toEqual({});
    });

    it('should map constants from rule_set', () => {
      const snapshot = makeSnapshotData({
        rule_set: {
          rule_set_id: 'rs-1',
          rule_set_code: 'DEFAULT',
          version: 1,
          constants: { MAX_PANELS: 100, MIN_GAP: 2 },
        },
      });
      const result = mapRuleSet(snapshot);
      expect(result.constants).toEqual({ MAX_PANELS: 100, MIN_GAP: 2 });
    });
  });

  describe('V1 legacy mapper', () => {
    describe('mapSnapshotV1ToPipeline', () => {
      it('should handle camelCase zone data (v1 client-built)', () => {
        const v1Data = {
          zones: [
            {
              zoneId: 'zone-v1',
              x: 0,
              y: 0,
              width: 1500,
              height: 2400,
              skuId: 'sku-001',
              panelWidth: 600,
              panelHeight: 1200,
              gapHorizontal: 3,
              gapVertical: 5,
              wasteFactor: 0.05,
              widthStrategy: 'RESIZABLE',
              heightMode: 'DERIVED_FROM_WALL',
            },
          ],
          lighting: [],
          furniture: [],
        };
        const result = mapSnapshotV1ToPipeline(v1Data);
        expect(result.zones[0].zoneId).toBe('zone-v1');
        expect(result.zones[0].x).toBe(0);
        expect(result.zones[0].width).toBe(1500);
        expect(result.zones[0].skuId).toBe('sku-001');
        expect(result.zones[0].panelWidth).toBe(600);
        expect(result.zones[0].gapHorizontal).toBe(3);
      });

      it('should handle mixed snake_case/camelCase for zones', () => {
        const v1Data = {
          zones: [
            {
              zone_id: 'zone-mixed',
              x_mm: 100,
              y_mm: 200,
              width_mm: 800,
              height_mm: 1600,
              sku_id: 'sku-mixed',
            },
          ],
        };
        const result = mapSnapshotV1ToPipeline(v1Data);
        expect(result.zones[0].zoneId).toBe('zone-mixed');
        expect(result.zones[0].x).toBe(100);
        expect(result.zones[0].y).toBe(200);
        expect(result.zones[0].width).toBe(800);
        expect(result.zones[0].height).toBe(1600);
        expect(result.zones[0].skuId).toBe('sku-mixed');
      });

      it('should return undefined hiddenComponents (v1 has none)', () => {
        const result = mapSnapshotV1ToPipeline({ zones: [] });
        expect(result.hiddenComponents).toBeUndefined();
      });

      it('should handle empty zones', () => {
        const result = mapSnapshotV1ToPipeline({ zones: [] });
        expect(result.zones).toEqual([]);
      });

      it('should handle missing zones property', () => {
        const result = mapSnapshotV1ToPipeline({});
        expect(result.zones).toEqual([]);
      });
    });

    describe('mapPermissionsV1', () => {
      it('should return empty array', () => {
        expect(mapPermissionsV1()).toEqual([]);
      });
    });

    describe('mapCompatibilityV1', () => {
      it('should return empty array', () => {
        expect(mapCompatibilityV1()).toEqual([]);
      });
    });

    describe('mapRuleSetV1', () => {
      it('should return empty object', () => {
        expect(mapRuleSetV1()).toEqual({});
      });
    });
  });

  describe('determinism', () => {
    it('should produce identical output for identical input across multiple calls', () => {
      const snapshot = makeSnapshotData({
        zones: [
          {
            zone_id: 'z1', x_mm: 0, y_mm: 0, width_mm: 1500, height_mm: 2400,
            width_strategy: 'PROPORTIONAL', height_strategy: 'DERIVED_FROM_WALL', position_strategy: 'FIXED',
            primary_sku: makeSkuMaster(), alternatives: [],
          },
          {
            zone_id: 'z2', x_mm: 1500, y_mm: 0, width_mm: 1500, height_mm: 2400,
            width_strategy: 'LOCKED', height_strategy: 'FIXED', position_strategy: 'FIXED',
            primary_sku: makeSkuMaster({ sku_id: 'sku-002' }), alternatives: [],
          },
        ],
        lighting: [{
          lighting_id: 'l1', template_id: 'tpl-1', sku_id: 'sku-led',
          edge_selection: JSON.stringify([{ length: 3000 }]),
          mounting_type: 'DIRECT', quantity_rule: null, created_at: '2024-01-01T00:00:00Z',
        }],
        hidden_components: [{
          hidden_component_id: 'hc-1', sku_id: 'sku-bracket',
          trigger_type: 'ALWAYS', trigger_condition: null,
          quantity_rule: 'FIXED', fixed_value: 4,
        }],
        consultant_permissions: [{
          permission_id: 'p1', parameter_key: 'zone_width',
          parameter_type: 'NUMBER', edit_mode: 'ALLOWED',
          min_value: 100, max_value: 5000, allowed_values: null, source_component_id: null,
        }],
        sku_compatibility: [{
          compatibility_id: 'c1', source_sku_id: 'sku-a', target_sku_id: 'sku-b',
          relationship_type: 'REQUIRES', directionality: 'UNIDIRECTIONAL',
          is_mandatory: true, status: 'ACTIVE', created_at: '2024-01-01T00:00:00Z',
        }],
      });

      const result1 = mapSnapshotToPipeline(snapshot);
      const result2 = mapSnapshotToPipeline(snapshot);
      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));

      const perms1 = mapPermissions(snapshot);
      const perms2 = mapPermissions(snapshot);
      expect(JSON.stringify(perms1)).toBe(JSON.stringify(perms2));

      const compat1 = mapCompatibility(snapshot);
      const compat2 = mapCompatibility(snapshot);
      expect(JSON.stringify(compat1)).toBe(JSON.stringify(compat2));
    });
  });
});
