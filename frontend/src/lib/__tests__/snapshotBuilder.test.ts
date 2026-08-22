import { describe, it, expect } from 'vitest';
import { sortKeysDeep } from '../snapshotBuilder';
import type { SnapshotData, SnapshotZone } from '../snapshotBuilder';
import type { WallConfigInput } from '@/engines/types';

describe('snapshotBuilder', () => {
  describe('sortKeysDeep', () => {
    it('sorts top-level object keys alphabetically', () => {
      const input = { b: 2, a: 1, c: 3 };
      const result = sortKeysDeep(input) as Record<string, unknown>;
      expect(Object.keys(result)).toEqual(['a', 'b', 'c']);
    });

    it('sorts nested object keys recursively', () => {
      const input = { z: { b: 2, a: 1 }, a: { d: 4, c: 3 } };
      const result = sortKeysDeep(input) as Record<string, Record<string, unknown>>;
      expect(Object.keys(result)).toEqual(['a', 'z']);
      expect(Object.keys(result.a)).toEqual(['c', 'd']);
      expect(Object.keys(result.z)).toEqual(['a', 'b']);
    });

    it('preserves array order while sorting objects within arrays', () => {
      const input = [{ b: 2, a: 1 }, { d: 4, c: 3 }];
      const result = sortKeysDeep(input) as Array<Record<string, unknown>>;
      expect(result).toHaveLength(2);
      expect(Object.keys(result[0])).toEqual(['a', 'b']);
      expect(Object.keys(result[1])).toEqual(['c', 'd']);
    });

    it('handles null values without error', () => {
      expect(sortKeysDeep(null)).toBeNull();
    });

    it('handles undefined values without error', () => {
      expect(sortKeysDeep(undefined)).toBeUndefined();
    });

    it('returns primitives unchanged', () => {
      expect(sortKeysDeep(42)).toBe(42);
      expect(sortKeysDeep('hello')).toBe('hello');
      expect(sortKeysDeep(true)).toBe(true);
    });

    it('handles empty objects', () => {
      expect(sortKeysDeep({})).toEqual({});
    });

    it('handles empty arrays', () => {
      expect(sortKeysDeep([])).toEqual([]);
    });

    it('handles deeply nested structures', () => {
      const input = {
        z: {
          y: {
            x: { b: 2, a: 1 },
          },
        },
      };
      const result = sortKeysDeep(input) as Record<string, unknown>;
      const json = JSON.stringify(result);
      expect(json).toBe('{"z":{"y":{"x":{"a":1,"b":2}}}}');
    });

    it('produces deterministic JSON.stringify output', () => {
      const obj1 = { b: 2, a: 1, c: { z: 26, a: 1 } };
      const obj2 = { c: { a: 1, z: 26 }, a: 1, b: 2 };

      const str1 = JSON.stringify(sortKeysDeep(obj1));
      const str2 = JSON.stringify(sortKeysDeep(obj2));

      expect(str1).toBe(str2);
    });

    it('handles mixed arrays and objects', () => {
      const input = { items: [{ b: 2, a: 1 }, 'string', null, 42] };
      const result = sortKeysDeep(input) as { items: unknown[] };
      expect(result.items[0]).toEqual({ a: 1, b: 2 });
      expect(result.items[1]).toBe('string');
      expect(result.items[2]).toBeNull();
      expect(result.items[3]).toBe(42);
    });
  });

  describe('SnapshotData type', () => {
    it('can be constructed with v2 fields', () => {
      const snapshot: SnapshotData = {
        snapshot_version: 2,
        template: {
          template_id: 'tpl-1',
          name: 'Test',
          wall_application: null,
          adaptation_strategy: 'PROPORTIONAL',
          priority_zone_id: null,
          waste_factor: null,
          metadata: null,
        },
        wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2700 },
        base_dimensions: { width_mm: 3000, height_mm: 2700 },
        zones: [],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: { waste_factor: 0.05, engine_version: '1.1.8' },
        template_wall_configuration: null,
        consultant_permissions: [
          {
            permission_id: 'perm-1',
            parameter_key: 'WALL_WIDTH',
            parameter_type: 'DIMENSION',
            edit_mode: 'RESTRICTED',
            min_value: 1000,
            max_value: 5000,
            allowed_values: null,
            source_component_id: null,
          },
        ],
        site_obstructions: [],
        sku_compatibility: [],
        rule_set: {
          rule_set_id: 'rs-1',
          rule_set_code: 'STANDARD',
          version: 1,
          constants: { panel_gap_mm: 3 },
        },
      };

      expect(snapshot.snapshot_version).toBe(2);
      expect(snapshot.template?.template_id).toBe('tpl-1');
      expect(snapshot.consultant_permissions).toHaveLength(1);
      expect(snapshot.rule_set?.rule_set_code).toBe('STANDARD');
    });

    it('is backwards compatible with v1 (no snapshot_version)', () => {
      const v1Snapshot: SnapshotData = {
        wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2700 },
        base_dimensions: { width_mm: 3000, height_mm: 2700 },
        zones: [],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
        template_wall_configuration: null,
        consultant_permissions: null,
        site_obstructions: [],
      };

      expect(v1Snapshot.snapshot_version).toBeUndefined();
      expect(v1Snapshot.template).toBeUndefined();
    });
  });

  describe('SnapshotZone type', () => {
    it('has required fields for zone data', () => {
      const zone: SnapshotZone = {
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
      };

      expect(zone.zone_id).toBe('zone-1');
      expect(zone.primary_sku).toBeNull();
      expect(zone.alternatives).toEqual([]);
    });
  });

  describe('installation area freezing', () => {
    it('freezes the installation area with the wall configuration', () => {
      const wallConfiguration: WallConfigInput = {
        wall_type: 'L_SHAPE',
        total_width_mm: 3500,
        total_height_mm: 2400,
        rows: 2,
        columns: 4,
        panel_gap_mm: 3,
        fit_algorithm: 'EQUAL',
        fit_intensity_percent: 0,
        mounting_type: 'DIRECT',
        obstructions: [],
        segment_a_width_mm: 2000,
        segment_b_width_mm: 1500,
        installation_area: {
          coverage: 'PARTIAL',
          outerEdge: { x_mm: 100, y_mm: 200, width_mm: 3000, height_mm: 2000 },
        },
      };

      const frozen = sortKeysDeep(wallConfiguration) as WallConfigInput;
      expect(frozen.installation_area).toEqual(wallConfiguration.installation_area);
      expect(frozen.segment_a_width_mm).toBe(2000);
      expect(frozen.wall_type).toBe('L_SHAPE');
    });
  });
});
