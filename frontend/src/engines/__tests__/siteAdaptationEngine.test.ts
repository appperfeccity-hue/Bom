import { describe, it, expect } from 'vitest';
import { adaptZonesToSite } from '../siteAdaptationEngine';
import { EngineError } from '../types';
import type { SiteAdaptationInput } from '../types';

describe('siteAdaptationEngine', () => {
  describe('PROPORTIONAL strategy', () => {
    it('golden test: template 3000, zones [1000,1000,1000], actual 3200 -> [1066,1067,1067]', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3200,
        zones: [
          { zone_id: 1, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 3, width_mm: 1000, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PROPORTIONAL',
      };

      const result = adaptZonesToSite(input);

      // ratio = 3200/3000 = 1.0667
      // Each zone: Math.round(1000 * 1.0667) = 1067
      // Sum = 3201, actual = 3200, excess = 1
      // Subtract 1 from lowest zone_id (1) -> [1066, 1067, 1067]
      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 1066 },
        { zone_id: 2, adapted_width_mm: 1067 },
        { zone_id: 3, adapted_width_mm: 1067 },
      ]);
    });

    it('exact fit with no remainder', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 2000,
        actual_wall_width: 4000,
        zones: [
          { zone_id: 1, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1000, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PROPORTIONAL',
      };

      const result = adaptZonesToSite(input);

      // ratio = 2.0, each zone = 2000, sum = 4000 = actual
      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 2000 },
        { zone_id: 2, adapted_width_mm: 2000 },
      ]);
    });

    it('scales down proportionally when actual is smaller than template', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 4000,
        actual_wall_width: 3000,
        zones: [
          { zone_id: 1, width_mm: 2000, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 2000, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PROPORTIONAL',
      };

      const result = adaptZonesToSite(input);

      // ratio = 0.75, each zone = 1500, sum = 3000 = actual
      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 1500 },
        { zone_id: 2, adapted_width_mm: 1500 },
      ]);
    });

    it('distributes positive remainder to lowest zone_ids first', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3002,
        zones: [
          { zone_id: 1, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 3, width_mm: 1000, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PROPORTIONAL',
      };

      const result = adaptZonesToSite(input);

      // ratio = 3002/3000 = 1.000667
      // Each: Math.round(1000 * 1.000667) = Math.round(1000.667) = 1001
      // Sum = 3003, actual = 3002, excess = 1
      // Subtract 1 from zone_id 1 -> [1000, 1001, 1001]
      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 1000 },
        { zone_id: 2, adapted_width_mm: 1001 },
        { zone_id: 3, adapted_width_mm: 1001 },
      ]);
    });

    it('handles unequal zone widths proportionally', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 6000,
        zones: [
          { zone_id: 1, width_mm: 500, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1500, width_strategy: 'RESIZABLE' },
          { zone_id: 3, width_mm: 1000, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PROPORTIONAL',
      };

      const result = adaptZonesToSite(input);

      // ratio = 2.0
      // zone 1: 1000, zone 2: 3000, zone 3: 2000, sum = 6000 = actual
      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 1000 },
        { zone_id: 2, adapted_width_mm: 3000 },
        { zone_id: 3, adapted_width_mm: 2000 },
      ]);
    });
  });

  describe('PRIORITY_ZONE strategy', () => {
    it('absorbs positive delta in the priority zone', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3500,
        zones: [
          { zone_id: 1, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 3, width_mm: 1000, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PRIORITY_ZONE',
        priority_zone_id: 2,
      };

      const result = adaptZonesToSite(input);

      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 1000 },
        { zone_id: 2, adapted_width_mm: 1500 },
        { zone_id: 3, adapted_width_mm: 1000 },
      ]);
    });

    it('absorbs negative delta in the priority zone', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 2700,
        zones: [
          { zone_id: 1, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 3, width_mm: 1000, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PRIORITY_ZONE',
        priority_zone_id: 3,
      };

      const result = adaptZonesToSite(input);

      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 1000 },
        { zone_id: 2, adapted_width_mm: 1000 },
        { zone_id: 3, adapted_width_mm: 700 },
      ]);
    });

    it('keeps all zones unchanged when delta is zero', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 2000,
        actual_wall_width: 2000,
        zones: [
          { zone_id: 1, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1000, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PRIORITY_ZONE',
        priority_zone_id: 1,
      };

      const result = adaptZonesToSite(input);

      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 1000 },
        { zone_id: 2, adapted_width_mm: 1000 },
      ]);
    });
  });

  describe('EQUAL_DISTRIBUTION strategy', () => {
    it('splits delta equally among resizable zones', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3300,
        zones: [
          { zone_id: 1, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 3, width_mm: 1000, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'EQUAL_DISTRIBUTION',
      };

      const result = adaptZonesToSite(input);

      // delta = 300, 3 resizable zones, each gets 100
      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 1100 },
        { zone_id: 2, adapted_width_mm: 1100 },
        { zone_id: 3, adapted_width_mm: 1100 },
      ]);
    });

    it('excludes LOCKED zones from distribution', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3200,
        zones: [
          { zone_id: 1, width_mm: 1000, width_strategy: 'LOCKED' },
          { zone_id: 2, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 3, width_mm: 1000, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'EQUAL_DISTRIBUTION',
      };

      const result = adaptZonesToSite(input);

      // delta = 200, 2 resizable zones, each gets 100
      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 1000 },
        { zone_id: 2, adapted_width_mm: 1100 },
        { zone_id: 3, adapted_width_mm: 1100 },
      ]);
    });

    it('distributes remainder by zone_id ASC among resizable zones', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3500,
        actual_wall_width: 3700,
        zones: [
          { zone_id: 1, width_mm: 1000, width_strategy: 'LOCKED' },
          { zone_id: 2, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 3, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 4, width_mm: 500, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'EQUAL_DISTRIBUTION',
      };

      const result = adaptZonesToSite(input);

      // delta = 200, 3 resizable zones
      // perZone = trunc(200/3) = 66
      // remainder = 200 - 66*3 = 2
      // Add 1 to zone_id 2 and zone_id 3 (lowest resizable zone_ids)
      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 1000 },
        { zone_id: 2, adapted_width_mm: 1067 },
        { zone_id: 3, adapted_width_mm: 1067 },
        { zone_id: 4, adapted_width_mm: 566 },
      ]);
    });

    it('handles negative delta distributed equally', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 2700,
        zones: [
          { zone_id: 1, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 3, width_mm: 1000, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'EQUAL_DISTRIBUTION',
      };

      const result = adaptZonesToSite(input);

      // delta = -300, 3 resizable zones, each gets -100
      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 900 },
        { zone_id: 2, adapted_width_mm: 900 },
        { zone_id: 3, adapted_width_mm: 900 },
      ]);
    });

    it('throws EngineError when no resizable zones exist', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3200,
        zones: [
          { zone_id: 1, width_mm: 1000, width_strategy: 'LOCKED' },
          { zone_id: 2, width_mm: 1000, width_strategy: 'LOCKED' },
          { zone_id: 3, width_mm: 1000, width_strategy: 'LOCKED' },
        ],
        strategy: 'EQUAL_DISTRIBUTION',
      };

      expect(() => adaptZonesToSite(input)).toThrow(EngineError);
      expect(() => adaptZonesToSite(input)).toThrow(
        'EQUAL_DISTRIBUTION requires at least one resizable zone',
      );
    });
  });

  describe('FIXED strategy', () => {
    it('passes when |delta| <= 5mm', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3005,
        zones: [
          { zone_id: 1, width_mm: 1500, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1500, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'FIXED',
      };

      const result = adaptZonesToSite(input);

      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 1500 },
        { zone_id: 2, adapted_width_mm: 1500 },
      ]);
    });

    it('passes when actual equals template exactly', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3000,
        zones: [
          { zone_id: 1, width_mm: 1500, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1500, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'FIXED',
      };

      const result = adaptZonesToSite(input);

      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 1500 },
        { zone_id: 2, adapted_width_mm: 1500 },
      ]);
    });

    it('throws EngineError when |delta| > 5mm (positive)', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3006,
        zones: [
          { zone_id: 1, width_mm: 1500, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1500, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'FIXED',
      };

      expect(() => adaptZonesToSite(input)).toThrow(EngineError);
      expect(() => adaptZonesToSite(input)).toThrow('FIXED strategy');
    });

    it('throws EngineError when |delta| > 5mm (negative)', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 2994,
        zones: [
          { zone_id: 1, width_mm: 1500, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1500, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'FIXED',
      };

      expect(() => adaptZonesToSite(input)).toThrow(EngineError);
    });
  });

  describe('Height adaptation', () => {
    it('DERIVED_FROM_WALL: scales height by wall height ratio', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3000,
        template_wall_height: 2400,
        actual_wall_height: 2600,
        zones: [
          {
            zone_id: 1,
            width_mm: 1500,
            width_strategy: 'RESIZABLE',
            height_mm: 2400,
            height_mode: 'DERIVED_FROM_WALL',
          },
          {
            zone_id: 2,
            width_mm: 1500,
            width_strategy: 'RESIZABLE',
            height_mm: 1200,
            height_mode: 'DERIVED_FROM_WALL',
          },
        ],
        strategy: 'PROPORTIONAL',
      };

      const result = adaptZonesToSite(input);

      // Height ratio = 2600/2400 = 1.0833
      // Zone 1: Math.round(2400 * 1.0833) = Math.round(2600) = 2600
      // Zone 2: Math.round(1200 * 1.0833) = Math.round(1300) = 1300
      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 1500, adapted_height_mm: 2600 },
        { zone_id: 2, adapted_width_mm: 1500, adapted_height_mm: 1300 },
      ]);
    });

    it('FIXED height mode: height unchanged', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3000,
        template_wall_height: 2400,
        actual_wall_height: 2700,
        zones: [
          {
            zone_id: 1,
            width_mm: 1500,
            width_strategy: 'RESIZABLE',
            height_mm: 2400,
            height_mode: 'FIXED',
          },
          {
            zone_id: 2,
            width_mm: 1500,
            width_strategy: 'RESIZABLE',
            height_mm: 1200,
            height_mode: 'FIXED',
          },
        ],
        strategy: 'PROPORTIONAL',
      };

      const result = adaptZonesToSite(input);

      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 1500, adapted_height_mm: 2400 },
        { zone_id: 2, adapted_width_mm: 1500, adapted_height_mm: 1200 },
      ]);
    });

    it('RESIZABLE height mode: proportional scaling', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3000,
        template_wall_height: 2000,
        actual_wall_height: 2400,
        zones: [
          {
            zone_id: 1,
            width_mm: 1500,
            width_strategy: 'RESIZABLE',
            height_mm: 1000,
            height_mode: 'RESIZABLE',
          },
          {
            zone_id: 2,
            width_mm: 1500,
            width_strategy: 'RESIZABLE',
            height_mm: 1000,
            height_mode: 'RESIZABLE',
          },
        ],
        strategy: 'PROPORTIONAL',
      };

      const result = adaptZonesToSite(input);

      // ratio = 2400/2000 = 1.2, height = Math.round(1000 * 1.2) = 1200
      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 1500, adapted_height_mm: 1200 },
        { zone_id: 2, adapted_width_mm: 1500, adapted_height_mm: 1200 },
      ]);
    });

    it('mixed height modes', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3000,
        template_wall_height: 2000,
        actual_wall_height: 2400,
        zones: [
          {
            zone_id: 1,
            width_mm: 1000,
            width_strategy: 'RESIZABLE',
            height_mm: 1000,
            height_mode: 'DERIVED_FROM_WALL',
          },
          {
            zone_id: 2,
            width_mm: 1000,
            width_strategy: 'RESIZABLE',
            height_mm: 1000,
            height_mode: 'FIXED',
          },
          {
            zone_id: 3,
            width_mm: 1000,
            width_strategy: 'RESIZABLE',
            height_mm: 1000,
            height_mode: 'RESIZABLE',
          },
        ],
        strategy: 'PROPORTIONAL',
      };

      const result = adaptZonesToSite(input);

      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 1000, adapted_height_mm: 1200 },
        { zone_id: 2, adapted_width_mm: 1000, adapted_height_mm: 1000 },
        { zone_id: 3, adapted_width_mm: 1000, adapted_height_mm: 1200 },
      ]);
    });

    it('no height output when height_mm is not provided', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3000,
        template_wall_height: 2400,
        actual_wall_height: 2700,
        zones: [
          { zone_id: 1, width_mm: 1500, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1500, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PROPORTIONAL',
      };

      const result = adaptZonesToSite(input);

      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 1500 },
        { zone_id: 2, adapted_width_mm: 1500 },
      ]);
    });
  });

  describe('Constraint violations', () => {
    it('throws EngineError when adapted width is below minimum (200mm)', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 500,
        zones: [
          { zone_id: 1, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 3, width_mm: 1000, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PROPORTIONAL',
      };

      // ratio = 500/3000 = 0.1667 -> zones ~167mm each < 200mm
      expect(() => adaptZonesToSite(input)).toThrow(EngineError);
      expect(() => adaptZonesToSite(input)).toThrow('below minimum');
    });

    it('throws EngineError when adapted width exceeds maximum (3000mm)', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 6000,
        zones: [
          { zone_id: 1, width_mm: 2000, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1000, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PRIORITY_ZONE',
        priority_zone_id: 1,
      };

      // Zone 1: 2000 + 3000 = 5000 > 3000
      expect(() => adaptZonesToSite(input)).toThrow(EngineError);
      expect(() => adaptZonesToSite(input)).toThrow('exceeds maximum');
    });

    it('throws EngineError when adapted height is below minimum (200mm)', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3000,
        template_wall_height: 2400,
        actual_wall_height: 190,
        zones: [
          {
            zone_id: 1,
            width_mm: 1500,
            width_strategy: 'RESIZABLE',
            height_mm: 2400,
            height_mode: 'DERIVED_FROM_WALL',
          },
          {
            zone_id: 2,
            width_mm: 1500,
            width_strategy: 'RESIZABLE',
            height_mm: 2400,
            height_mode: 'DERIVED_FROM_WALL',
          },
        ],
        strategy: 'PROPORTIONAL',
      };

      // Height ratio = 190/2400 = 0.0792, height = Math.round(2400 * 0.0792) = 190 < 200
      expect(() => adaptZonesToSite(input)).toThrow(EngineError);
      expect(() => adaptZonesToSite(input)).toThrow('height');
    });

    it('throws EngineError when adapted height exceeds maximum (2700mm)', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3000,
        template_wall_height: 2000,
        actual_wall_height: 4000,
        zones: [
          {
            zone_id: 1,
            width_mm: 1500,
            width_strategy: 'RESIZABLE',
            height_mm: 2000,
            height_mode: 'RESIZABLE',
          },
          {
            zone_id: 2,
            width_mm: 1500,
            width_strategy: 'RESIZABLE',
            height_mm: 2000,
            height_mode: 'RESIZABLE',
          },
        ],
        strategy: 'PROPORTIONAL',
      };

      // Height ratio = 2.0, height = 4000 > 2700
      expect(() => adaptZonesToSite(input)).toThrow(EngineError);
      expect(() => adaptZonesToSite(input)).toThrow('exceeds maximum');
    });

    it('respects custom min_width and max_width per zone', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3000,
        zones: [
          {
            zone_id: 1,
            width_mm: 1000,
            width_strategy: 'RESIZABLE',
            min_width: 500,
            max_width: 900,
          },
          { zone_id: 2, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 3, width_mm: 1000, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PROPORTIONAL',
      };

      // Zone 1 would be 1000mm but max is 900
      expect(() => adaptZonesToSite(input)).toThrow(EngineError);
      expect(() => adaptZonesToSite(input)).toThrow('exceeds maximum');
    });
  });

  describe('Input validation', () => {
    it('throws EngineError for empty zones array', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3200,
        zones: [],
        strategy: 'PROPORTIONAL',
      };

      expect(() => adaptZonesToSite(input)).toThrow(EngineError);
      expect(() => adaptZonesToSite(input)).toThrow('zones array must not be empty');
    });

    it('throws EngineError for non-positive template_wall_width', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 0,
        actual_wall_width: 3200,
        zones: [{ zone_id: 1, width_mm: 1000, width_strategy: 'RESIZABLE' }],
        strategy: 'PROPORTIONAL',
      };

      expect(() => adaptZonesToSite(input)).toThrow(EngineError);
      expect(() => adaptZonesToSite(input)).toThrow('template_wall_width must be positive');
    });

    it('throws EngineError for non-positive actual_wall_width', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: -1,
        zones: [{ zone_id: 1, width_mm: 1000, width_strategy: 'RESIZABLE' }],
        strategy: 'PROPORTIONAL',
      };

      expect(() => adaptZonesToSite(input)).toThrow(EngineError);
      expect(() => adaptZonesToSite(input)).toThrow('actual_wall_width must be positive');
    });

    it('throws EngineError for non-positive zone width_mm', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3200,
        zones: [{ zone_id: 1, width_mm: 0, width_strategy: 'RESIZABLE' }],
        strategy: 'PROPORTIONAL',
      };

      expect(() => adaptZonesToSite(input)).toThrow(EngineError);
      expect(() => adaptZonesToSite(input)).toThrow('width_mm must be positive');
    });

    it('throws EngineError when priority_zone_id is missing for PRIORITY_ZONE strategy', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3200,
        zones: [{ zone_id: 1, width_mm: 1000, width_strategy: 'RESIZABLE' }],
        strategy: 'PRIORITY_ZONE',
      };

      expect(() => adaptZonesToSite(input)).toThrow(EngineError);
      expect(() => adaptZonesToSite(input)).toThrow(
        'priority_zone_id is required for PRIORITY_ZONE strategy',
      );
    });

    it('throws EngineError when priority_zone_id does not exist in zones', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3200,
        zones: [{ zone_id: 1, width_mm: 1000, width_strategy: 'RESIZABLE' }],
        strategy: 'PRIORITY_ZONE',
        priority_zone_id: 99,
      };

      expect(() => adaptZonesToSite(input)).toThrow(EngineError);
      expect(() => adaptZonesToSite(input)).toThrow('not found in zones');
    });
  });

  describe('Determinism', () => {
    it('produces identical output for identical inputs on repeated calls', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3200,
        zones: [
          { zone_id: 1, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 3, width_mm: 1000, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PROPORTIONAL',
      };

      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(adaptZonesToSite(input));
      }

      // All results must be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(results[0]);
      }
    });

    it('output is deterministic regardless of internal processing order', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 5000,
        actual_wall_width: 5003,
        zones: [
          { zone_id: 5, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 3, width_mm: 1500, width_strategy: 'RESIZABLE' },
          { zone_id: 1, width_mm: 800, width_strategy: 'RESIZABLE' },
          { zone_id: 4, width_mm: 700, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1000, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PROPORTIONAL',
      };

      const result1 = adaptZonesToSite(input);
      const result2 = adaptZonesToSite(input);

      expect(result1).toEqual(result2);

      // Verify output is sorted by zone_id
      const zoneIds = result1.adapted_zones.map((z) => z.zone_id);
      expect(zoneIds).toEqual([1, 2, 3, 4, 5]);

      // Verify sum equals actual
      const sum = result1.adapted_zones.reduce(
        (acc, z) => acc + z.adapted_width_mm,
        0,
      );
      expect(sum).toBe(5003);
    });
  });

  describe('Review fixes validation', () => {
    it('throws EngineError for duplicate zone_ids', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3200,
        zones: [
          { zone_id: 1, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 1, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1000, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PROPORTIONAL',
      };

      expect(() => adaptZonesToSite(input)).toThrow(EngineError);
      expect(() => adaptZonesToSite(input)).toThrow('Duplicate zone_id');
    });

    it('throws EngineError when only template_wall_height is provided', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3000,
        template_wall_height: 2400,
        zones: [
          { zone_id: 1, width_mm: 1500, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1500, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PROPORTIONAL',
      };

      expect(() => adaptZonesToSite(input)).toThrow(EngineError);
      expect(() => adaptZonesToSite(input)).toThrow(
        'Both template_wall_height and actual_wall_height must be provided',
      );
    });

    it('throws EngineError when only actual_wall_height is provided', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3000,
        actual_wall_height: 2600,
        zones: [
          { zone_id: 1, width_mm: 1500, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1500, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PROPORTIONAL',
      };

      expect(() => adaptZonesToSite(input)).toThrow(EngineError);
      expect(() => adaptZonesToSite(input)).toThrow(
        'Both template_wall_height and actual_wall_height must be provided',
      );
    });

    it('throws EngineError when zone widths sum does not match template_wall_width', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3200,
        zones: [
          { zone_id: 1, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 3, width_mm: 500, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PROPORTIONAL',
      };

      // sum = 2500, template_wall_width = 3000, diff = 500 > 1mm
      expect(() => adaptZonesToSite(input)).toThrow(EngineError);
      expect(() => adaptZonesToSite(input)).toThrow(
        'Sum of zone widths',
      );
    });

    it('allows zone width sum within 1mm tolerance of template_wall_width', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3200,
        zones: [
          { zone_id: 1, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 2, width_mm: 1000, width_strategy: 'RESIZABLE' },
          { zone_id: 3, width_mm: 999, width_strategy: 'RESIZABLE' },
        ],
        strategy: 'PROPORTIONAL',
      };

      // sum = 2999, template_wall_width = 3000, diff = 1 <= tolerance
      const result = adaptZonesToSite(input);
      expect(result.adapted_zones).toHaveLength(3);
    });

    it('height adaptation works correctly when wall heights are zero', () => {
      const input: SiteAdaptationInput = {
        template_wall_width: 3000,
        actual_wall_width: 3000,
        template_wall_height: 0,
        actual_wall_height: 0,
        zones: [
          {
            zone_id: 1,
            width_mm: 1500,
            width_strategy: 'RESIZABLE',
            height_mm: 1000,
            height_mode: 'FIXED',
          },
          {
            zone_id: 2,
            width_mm: 1500,
            width_strategy: 'RESIZABLE',
            height_mm: 1000,
            height_mode: 'FIXED',
          },
        ],
        strategy: 'PROPORTIONAL',
      };

      // With truthy check this would silently skip height adaptation
      // With explicit null/undefined check, zero heights are treated as present
      const result = adaptZonesToSite(input);
      expect(result.adapted_zones).toEqual([
        { zone_id: 1, adapted_width_mm: 1500, adapted_height_mm: 1000 },
        { zone_id: 2, adapted_width_mm: 1500, adapted_height_mm: 1000 },
      ]);
    });
  });
});
