/**
 * Integration Test Area 7: Validation/Error Handling
 *
 * Validates that:
 * - Invalid geometry (zone outside wall) blocks pipeline with GEO_ZONE_EXCEEDS_WALL
 * - Invalid SKU compatibility blocks with COMPAT_INCOMPATIBLE_SKUS
 * - 50mm minimum retained width enforced (calculateWallPanels throws EngineError)
 * - Errors are deterministic (same invalid input always produces same error code)
 */

import { describe, it, expect } from 'vitest';
import { runBomPipeline } from '@/engines/bomPipeline';
import { calculateWallPanels } from '@/engines/wallPanelEngine';
import { EngineError } from '@/engines/types';
import { ErrorCode } from '@/engines/errorCatalogue';
import { createStraightWallPipelineInput } from './helpers/fixtures';

describe('Integration Area 7: Validation/Error Handling', () => {
  describe('Invalid geometry blocks pipeline', () => {
    it('zone exceeding wall bounds blocks with GEO_ZONE_EXCEEDS_WALL', () => {
      const input = createStraightWallPipelineInput();
      // Place zone that extends beyond wall width
      input.snapshotData.zones = [
        {
          zoneId: 'zone-overflow',
          x: 2800,
          y: 0,
          width: 500,
          height: 2400,
          skuId: 'sku-panel-001',
          panelWidth: 250,
          panelHeight: 1200,
          gapHorizontal: 3,
          gapVertical: 3,
          wasteFactor: 0.05,
        },
      ];

      const output = runBomPipeline(input);

      expect(output.status).toBe('BLOCKED');
      expect(output.errors.some(e => e.code === ErrorCode.GEO_ZONE_EXCEEDS_WALL)).toBe(true);
    });

    it('zone with zero wall width blocks with GEO_WALL_DIMENSION_INVALID', () => {
      const input = createStraightWallPipelineInput();
      input.measurements.wallWidth = 0;

      const output = runBomPipeline(input);

      expect(output.status).toBe('BLOCKED');
      expect(output.errors[0].code).toBe(ErrorCode.GEO_WALL_DIMENSION_INVALID);
    });

    it('overlapping zones block pipeline with GEO_ZONE_OVERLAP', () => {
      const input = createStraightWallPipelineInput();
      input.snapshotData.zones = [
        {
          zoneId: 'z-a',
          x: 0,
          y: 0,
          width: 1600,
          height: 2400,
          skuId: 'sku-1',
          panelWidth: 600,
          panelHeight: 1200,
          gapHorizontal: 3,
          gapVertical: 3,
          wasteFactor: 0.05,
        },
        {
          zoneId: 'z-b',
          x: 1500,
          y: 0,
          width: 1500,
          height: 2400,
          skuId: 'sku-2',
          panelWidth: 600,
          panelHeight: 1200,
          gapHorizontal: 3,
          gapVertical: 3,
          wasteFactor: 0.05,
        },
      ];

      const output = runBomPipeline(input);

      expect(output.status).toBe('BLOCKED');
      expect(output.errors.some(e => e.code === ErrorCode.GEO_ZONE_OVERLAP)).toBe(true);
    });
  });

  describe('Invalid SKU compatibility blocks pipeline', () => {
    it('ALTERNATIVE_TO relationship blocks with COMPAT_INCOMPATIBLE_SKUS', () => {
      const input = createStraightWallPipelineInput();
      input.configuration = {
        selectedSkuPairs: [
          { sourceSkuId: 'sku-a', targetSkuId: 'sku-b' },
        ],
      };
      input.compatibilityRules = [
        {
          sourceSkuId: 'sku-a',
          targetSkuId: 'sku-b',
          relationshipType: 'ALTERNATIVE_TO',
          isMandatory: false,
        },
      ];

      const output = runBomPipeline(input);

      expect(output.status).toBe('BLOCKED');
      expect(output.errors[0].code).toBe(ErrorCode.COMPAT_INCOMPATIBLE_SKUS);
    });

    it('missing required companion blocks with COMPAT_MISSING_REQUIRED', () => {
      const input = createStraightWallPipelineInput();
      input.configuration = {
        selectedSkuPairs: [
          { sourceSkuId: 'sku-main', targetSkuId: 'sku-wrong' },
        ],
      };
      input.compatibilityRules = [
        {
          sourceSkuId: 'sku-main',
          targetSkuId: 'sku-required-companion',
          relationshipType: 'REQUIRES',
          isMandatory: true,
        },
      ];

      const output = runBomPipeline(input);

      expect(output.status).toBe('BLOCKED');
      expect(output.errors.some(e => e.code === ErrorCode.COMPAT_MISSING_REQUIRED)).toBe(true);
    });
  });

  describe('50mm minimum retained width enforced', () => {
    it('calculateWallPanels throws EngineError when retained < 50mm', () => {
      // Construct input where retained width would be below 50mm
      // Zone 610mm wide, panels 600mm + 0mm gap = 2 panels needed
      // total_span = 2*600 + 1*0 = 1200, trim_per_side = (1200-610)/2 = 295
      // retained = 600 - 295 = 305mm (this is fine)

      // For retained < 50: zone 1150mm wide, panels 600mm + 0mm gap
      // N=2: 2*600 + 1*0 = 1200 >= 1150, trim = (1200-1150)/2 = 25, retained = 600-25 = 575 (fine)

      // Try: zone 595mm wide, panel 600mm + gap 0
      // N=1: 600 >= 595, single panel: trim = 600-595 = 5, retained = 595 >= 50 (fine)

      // For below 50: zone = 30mm wide, panel = 600mm
      // N=1: single panel, trim = 600-30 = 570, retained = 30 < 50 -> ERROR
      expect(() =>
        calculateWallPanels({
          W: 30,
          H: 1200,
          w: 600,
          h: 1200,
          gh: 0,
          gv: 0,
          wasteFactor: 0.05,
        }),
      ).toThrow(EngineError);
    });

    it('calculateWallPanels succeeds when retained is exactly 50mm', () => {
      // Zone = 50mm wide, panel = 600mm
      // N=1: single panel, retained = 50, which equals MIN_RETAINED
      const result = calculateWallPanels({
        W: 50,
        H: 1200,
        w: 600,
        h: 1200,
        gh: 0,
        gv: 0,
        wasteFactor: 0.05,
      });

      expect(result.retainedWidth).toBe(50);
      expect(result.requiredQuantity).toBeGreaterThan(0);
    });

    it('calculateWallPanels succeeds when retained is above 50mm', () => {
      const result = calculateWallPanels({
        W: 100,
        H: 1200,
        w: 600,
        h: 1200,
        gh: 0,
        gv: 0,
        wasteFactor: 0.05,
      });

      expect(result.retainedWidth).toBe(100);
    });

    it('pipeline blocks when retained width would be below 50mm', () => {
      const input = createStraightWallPipelineInput();
      // Use a zone width that passes min dimension check (>= 100) but where
      // retained panel width < 50mm after trimming.
      // Zone 1150mm wide, panel 600mm + gap 0:
      // N=2: span=1200, trim=(1200-1150)/2=25, retained=600-25=575 (fine)
      // Try: zone 1185mm, panel 600mm, gap 0:
      // N=2: span=1200, trim=(1200-1185)/2=7.5, retained=592.5 (fine)
      // For N=2 to give retained<50: trim_per_side > 550 -> totalSpan-zoneSize > 1100
      // span = 2*600 + 1*0 = 1200. We need 1200 - zone < 100 (so trim per side > 550)
      // That's zone < 100 -- below min dimension.
      //
      // Different approach: use a large panel with multi-panel scenario
      // Zone = 510mm, panel = 500mm, gap = 100mm:
      // N: 1*500 + 0*100 = 500 < 510, N=2: 2*500 + 1*100 = 1100 >= 510
      // trim = (1100-510)/2 = 295, retained = 500-295 = 205 (fine)
      //
      // For retained < 50: We need panelSize - trimPerSide < 50
      // i.e., trimPerSide > panelSize - 50
      // Zone = 110mm, panel = 100mm, gap = 0:
      // N=1: 100 < 110, N=2: 200 >= 110
      // trim = (200-110)/2 = 45, retained = 100-45 = 55 (still fine)
      // Zone = 110mm, panel = 100mm, gap = 10:
      // N=1: 100 < 110, N=2: 2*100 + 10 = 210 >= 110
      // trim = (210-110)/2 = 50, retained = 100-50 = 50 (exactly at limit)
      // Zone = 110mm, panel = 100mm, gap = 12:
      // N=2: 2*100 + 12 = 212 >= 110
      // trim = (212-110)/2 = 51, retained = 100-51 = 49 < 50 -> ERROR!
      input.snapshotData.zones = [
        {
          zoneId: 'z-retained-fail',
          x: 0,
          y: 0,
          width: 110,
          height: 2400,
          skuId: 'sku-1',
          panelWidth: 100,
          panelHeight: 1200,
          gapHorizontal: 12,
          gapVertical: 0,
          wasteFactor: 0.05,
        },
      ];
      input.measurements.wallWidth = 3000;

      const output = runBomPipeline(input);

      // Pipeline catches the EngineError from calculateWallPanels
      expect(output.status).toBe('BLOCKED');
      expect(output.errors[0].code).toBe(ErrorCode.QTY_PANEL_NO_VALID_ARRANGEMENT);
    });
  });

  describe('Errors are deterministic', () => {
    it('same invalid input always produces same error code', () => {
      const input = createStraightWallPipelineInput();
      input.snapshotData.zones = [
        {
          zoneId: 'z-out',
          x: 2800,
          y: 0,
          width: 500,
          height: 2400,
          skuId: 'sku-1',
          panelWidth: 250,
          panelHeight: 1200,
          gapHorizontal: 3,
          gapVertical: 3,
          wasteFactor: 0.05,
        },
      ];

      const output1 = runBomPipeline(input);
      const output2 = runBomPipeline(input);
      const output3 = runBomPipeline(input);

      expect(output1.status).toBe('BLOCKED');
      expect(output1.errors).toEqual(output2.errors);
      expect(output2.errors).toEqual(output3.errors);
    });

    it('same permission violation always produces same error', () => {
      const input = createStraightWallPipelineInput();
      input.permissions = [{ parameter: 'locked_param', locked: true }];
      input.configuration = {
        consultantActions: [
          { parameter: 'locked_param', value: 'any', actionType: 'SET_VALUE' },
        ],
      };

      const output1 = runBomPipeline(input);
      const output2 = runBomPipeline(input);

      expect(output1.status).toBe('BLOCKED');
      expect(output1.errors).toEqual(output2.errors);
      expect(output1.errors[0].code).toBe(ErrorCode.PERM_LOCKED_PARAMETER);
    });
  });
});
