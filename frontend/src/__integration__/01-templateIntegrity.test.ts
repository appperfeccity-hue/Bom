/**
 * Integration Test Area 1: Template Integrity
 *
 * Validates that:
 * - SnapshotData type can represent v1 and v2 snapshot formats
 * - sortKeysDeep produces deterministic JSON for canonical hashing
 * - Snapshot zone structure preserves template zone dimensions
 *
 * Note: Snapshot building is now server-side (v1.1.8). These tests validate
 * the frontend read types and canonical sorting utility used for verification.
 */

import { describe, it, expect } from 'vitest';
import { sortKeysDeep } from '@/lib/snapshotBuilder';
import type { SnapshotData, SnapshotZone } from '@/lib/snapshotBuilder';

describe('Integration Area 1: Template Integrity', () => {
  describe('Snapshot data structure immutability', () => {
    it('sortKeysDeep produces identical output for same inputs regardless of key order', () => {
      const obj1 = { zones: [{ width_mm: 1500, zone_id: 'z-1' }], wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000 } };
      const obj2 = { wall_geometry: { base_width_mm: 3000, type: 'STRAIGHT' }, zones: [{ zone_id: 'z-1', width_mm: 1500 }] };

      const canonical1 = JSON.stringify(sortKeysDeep(obj1));
      const canonical2 = JSON.stringify(sortKeysDeep(obj2));

      expect(canonical1).toBe(canonical2);
    });

    it('sortKeysDeep preserves zone data without mutation', () => {
      const zones = [
        { zone_id: 'zone-a', x_mm: 0, y_mm: 0, width_mm: 1500, height_mm: 2400 },
        { zone_id: 'zone-b', x_mm: 1500, y_mm: 0, width_mm: 1500, height_mm: 2400 },
      ];

      const sorted = sortKeysDeep(zones) as typeof zones;

      expect(sorted).toHaveLength(2);
      expect(sorted[0].zone_id).toBe('zone-a');
      expect(sorted[0].x_mm).toBe(0);
      expect(sorted[0].width_mm).toBe(1500);
      expect(sorted[0].height_mm).toBe(2400);
      expect(sorted[1].zone_id).toBe('zone-b');
      expect(sorted[1].x_mm).toBe(1500);
    });
  });

  describe('Snapshot hash determinism via sortKeysDeep', () => {
    it('sortKeysDeep produces same canonical form for identical snapshot data', () => {
      const snapshot1: SnapshotData = {
        snapshot_version: 2,
        wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2400 },
        base_dimensions: { width_mm: 3000, height_mm: 2400 },
        zones: [{
          zone_id: 'zone-a',
          x_mm: 0, y_mm: 0, width_mm: 1500, height_mm: 2400,
          width_strategy: 'PROPORTIONAL', height_strategy: 'DERIVED_FROM_WALL',
          position_strategy: 'FIXED', primary_sku: null, alternatives: [],
        }],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: { waste_factor: 0.05 },
        template_wall_configuration: null,
        consultant_permissions: null,
        site_obstructions: [],
        sku_compatibility: [],
        rule_set: { rule_set_id: 'rs-1', rule_set_code: 'STD', version: 1, constants: {} },
      };

      // Create same data with different property insertion order
      const snapshot2: SnapshotData = {
        zones: [{
          zone_id: 'zone-a',
          width_strategy: 'PROPORTIONAL', height_strategy: 'DERIVED_FROM_WALL',
          position_strategy: 'FIXED', primary_sku: null, alternatives: [],
          x_mm: 0, y_mm: 0, width_mm: 1500, height_mm: 2400,
        }],
        snapshot_version: 2,
        base_dimensions: { height_mm: 2400, width_mm: 3000 },
        wall_geometry: { base_height_mm: 2400, type: 'STRAIGHT', base_width_mm: 3000 },
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: { waste_factor: 0.05 },
        template_wall_configuration: null,
        consultant_permissions: null,
        site_obstructions: [],
        sku_compatibility: [],
        rule_set: { rule_set_id: 'rs-1', rule_set_code: 'STD', version: 1, constants: {} },
      };

      const canonical1 = JSON.stringify(sortKeysDeep(snapshot1));
      const canonical2 = JSON.stringify(sortKeysDeep(snapshot2));

      expect(canonical1).toBe(canonical2);
    });

    it('sortKeysDeep produces different canonical form when zone dimensions differ', () => {
      const makeSnapshot = (width: number): SnapshotData => ({
        wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2400 },
        base_dimensions: { width_mm: 3000, height_mm: 2400 },
        zones: [{
          zone_id: 'zone-a', x_mm: 0, y_mm: 0,
          width_mm: width, height_mm: 2400,
          width_strategy: 'PROPORTIONAL', height_strategy: 'DERIVED_FROM_WALL',
          position_strategy: 'FIXED', primary_sku: null, alternatives: [],
        }],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
        template_wall_configuration: null,
        consultant_permissions: null,
        site_obstructions: [],
      });

      const canonical1 = JSON.stringify(sortKeysDeep(makeSnapshot(1500)));
      const canonical2 = JSON.stringify(sortKeysDeep(makeSnapshot(1600)));

      expect(canonical1).not.toBe(canonical2);
    });
  });

  describe('Dimension propagation', () => {
    it('SnapshotZone type correctly represents zone dimensions', () => {
      const zone: SnapshotZone = {
        zone_id: 'zone-a',
        x_mm: 0,
        y_mm: 0,
        width_mm: 1500,
        height_mm: 2400,
        width_strategy: 'PROPORTIONAL',
        height_strategy: 'DERIVED_FROM_WALL',
        position_strategy: 'FIXED',
        primary_sku: null,
        alternatives: [],
      };

      expect(zone.x_mm).toBe(0);
      expect(zone.width_mm).toBe(1500);
      expect(zone.height_mm).toBe(2400);
    });

    it('SnapshotData base_dimensions should match wall_geometry dimensions', () => {
      const snapshot: SnapshotData = {
        wall_geometry: { type: 'L_CORNER', base_width_mm: 5000, base_height_mm: 3000, segment_a_width_mm: 2500, segment_b_width_mm: 2500 },
        base_dimensions: { width_mm: 5000, height_mm: 3000 },
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

      expect(snapshot.base_dimensions.width_mm).toBe(snapshot.wall_geometry.base_width_mm);
      expect(snapshot.base_dimensions.height_mm).toBe(snapshot.wall_geometry.base_height_mm);
    });
  });
});
