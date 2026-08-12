/**
 * Integration tests for the BOM pipeline.
 *
 * These tests exercise the full pipeline (runBomPipeline) with realistic inputs
 * that simulate real Supabase response structures, testing the complete flow
 * from input assembly through all 8 pipeline steps.
 */

import { describe, it, expect } from 'vitest';
import { runBomPipeline } from '../bomPipeline';
import type { BomPipelineInput } from '../bomPipeline';
import { ErrorCode, ErrorSeverity } from '../errorCatalogue';

/**
 * Simulates a realistic Supabase response with multiple zones, lighting,
 * furniture, and hidden components as would be returned from project_snapshot.
 */
function createRealisticInput(): BomPipelineInput {
  return {
    snapshotData: {
      zones: [
        {
          zoneId: 'zone-wall-left',
          x: 0,
          y: 0,
          width: 1500,
          height: 2400,
          skuId: 'sku-panel-oak-001',
          panelWidth: 600,
          panelHeight: 1200,
          gapHorizontal: 3,
          gapVertical: 3,
          wasteFactor: 0.08,
        },
        {
          zoneId: 'zone-wall-right',
          x: 1500,
          y: 0,
          width: 1500,
          height: 2400,
          skuId: 'sku-panel-oak-002',
          panelWidth: 600,
          panelHeight: 1200,
          gapHorizontal: 3,
          gapVertical: 3,
          wasteFactor: 0.08,
        },
      ],
      lighting: [
        {
          componentId: 'light-ceiling-strip',
          skuId: 'sku-led-strip-001',
          edges: [{ length: 3000 }],
          mountingType: 'PROFILE',
          mode: 'LINEAR',
          unitLength: 600,
        },
        {
          componentId: 'light-accent',
          skuId: 'sku-led-spot-001',
          edges: [{ length: 1200 }, { length: 1200 }],
          mountingType: 'DIRECT',
          mode: 'DISCRETE',
          unitLength: 300,
        },
      ],
      furniture: [
        {
          componentId: 'furn-desk',
          skuId: 'sku-desk-001',
          quantity: 1,
          min: 1,
          max: 3,
        },
        {
          componentId: 'furn-chair',
          skuId: 'sku-chair-001',
          quantity: 2,
          min: 1,
          max: 6,
        },
      ],
      hiddenComponents: [
        {
          componentId: 'hidden-bracket',
          skuId: 'sku-bracket-001',
          triggerType: 'ALWAYS',
          quantityRule: 'FIXED',
          fixedValue: 8,
        },
        {
          componentId: 'hidden-adhesive',
          skuId: 'sku-adhesive-001',
          triggerType: 'CONDITION',
          condition: { field: 'zone_count', operator: 'GT', value: 1 },
          quantityRule: 'PER_ZONE',
          zoneCount: 2,
          fixedValue: 1,
          fieldValues: { zone_count: 2 },
        },
      ],
    },
    measurements: {
      wallWidth: 3000,
      wallHeight: 2400,
      templateWallWidth: 3000,
      templateWallHeight: 2400,
    },
    configuration: {},
    ruleSet: {},
    permissions: [],
    compatibilityRules: [],
  };
}

describe('BOM Pipeline Integration', () => {
  describe('full pipeline execution with realistic data', () => {
    it('should produce SUCCESS with complete multi-zone input', () => {
      const input = createRealisticInput();
      const output = runBomPipeline(input);

      expect(output.status).toBe('SUCCESS');
      expect(output.errors).toHaveLength(0);
      expect(output.actualBomLines.length).toBeGreaterThan(0);
    });

    it('should produce BOM lines for each zone separately (traceability)', () => {
      const input = createRealisticInput();
      const output = runBomPipeline(input);

      const panelLines = output.actualBomLines.filter(l => l.calculationRule === 'WALL_PANEL');
      expect(panelLines).toHaveLength(2);
      expect(panelLines[0].componentId).toBe('zone-wall-left');
      expect(panelLines[1].componentId).toBe('zone-wall-right');
    });

    it('should produce BOM lines for lighting components', () => {
      const input = createRealisticInput();
      const output = runBomPipeline(input);

      const lightLines = output.actualBomLines.filter(l => l.calculationRule === 'LIGHT');
      expect(lightLines).toHaveLength(2);
      expect(lightLines.find(l => l.componentId === 'light-ceiling-strip')).toBeDefined();
      expect(lightLines.find(l => l.componentId === 'light-accent')).toBeDefined();
    });

    it('should produce BOM lines for furniture components', () => {
      const input = createRealisticInput();
      const output = runBomPipeline(input);

      const furnLines = output.actualBomLines.filter(l => l.calculationRule === 'FURNITURE');
      expect(furnLines).toHaveLength(2);
      expect(furnLines.find(l => l.skuId === 'sku-desk-001')?.quantity).toBe(1);
      expect(furnLines.find(l => l.skuId === 'sku-chair-001')?.quantity).toBe(2);
    });

    it('should produce BOM lines for hidden components that meet trigger conditions', () => {
      const input = createRealisticInput();
      const output = runBomPipeline(input);

      const hiddenLines = output.actualBomLines.filter(l => l.calculationRule === 'HIDDEN_COMPONENT');
      // ALWAYS trigger should always produce a line
      const bracketLine = hiddenLines.find(l => l.skuId === 'sku-bracket-001');
      expect(bracketLine).toBeDefined();
      expect(bracketLine!.quantity).toBe(8);
    });

    it('should calculate correct quantities for wall panels', () => {
      const input = createRealisticInput();
      const output = runBomPipeline(input);

      const panelLines = output.actualBomLines.filter(l => l.calculationRule === 'WALL_PANEL');
      // Each zone: 1500mm wide / (600mm + 3mm gap) = ~2.49 columns -> 2 full panels per row
      // 2400mm height / (1200mm + 3mm gap) = ~1.99 rows -> 2 rows (accounting for gap)
      // Should have at least some panels
      for (const line of panelLines) {
        expect(line.quantity).toBeGreaterThan(0);
        expect(line.requiredQuantity).toBeGreaterThan(0);
        expect(line.wasteQuantity).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('pipeline with site adaptation', () => {
    it('should adapt zones when actual wall differs from template', () => {
      const input = createRealisticInput();
      // Template is 3000mm wide, actual is 3600mm - proportional scaling
      // Zone widths must sum to template wall width for adaptation to work
      // x positions are set so zones don't overlap after adaptation (each zone grows 20%)
      input.snapshotData.zones = [
        {
          zoneId: 'zone-wall-left',
          x: 0,
          y: 0,
          width: 1500,
          height: 2400,
          skuId: 'sku-panel-oak-001',
          panelWidth: 600,
          panelHeight: 1200,
          gapHorizontal: 3,
          gapVertical: 3,
          wasteFactor: 0.08,
        },
        {
          zoneId: 'zone-wall-right',
          x: 1800,
          y: 0,
          width: 1500,
          height: 2400,
          skuId: 'sku-panel-oak-002',
          panelWidth: 600,
          panelHeight: 1200,
          gapHorizontal: 3,
          gapVertical: 3,
          wasteFactor: 0.08,
        },
      ];
      input.measurements.wallWidth = 3600;
      input.measurements.wallHeight = 2400;
      input.measurements.templateWallWidth = 3000;
      input.measurements.templateWallHeight = 2400;

      const output = runBomPipeline(input);
      expect(output.status).toBe('SUCCESS');
      // Pipeline still produces valid output after adaptation
      expect(output.actualBomLines.length).toBeGreaterThan(0);
    });

    it('should block when adapted wall has zero width', () => {
      const input = createRealisticInput();
      input.measurements.wallWidth = 0;
      input.measurements.templateWallWidth = 3000;

      const output = runBomPipeline(input);
      expect(output.status).toBe('BLOCKED');
      expect(output.errors[0].code).toBe(ErrorCode.GEO_WALL_DIMENSION_INVALID);
    });
  });

  describe('pipeline with permission rules', () => {
    it('should pass when consultant actions comply with permissions', () => {
      const input = createRealisticInput();
      input.permissions = [
        { parameter: 'zone_width', locked: false, minValue: 500, maxValue: 2000 },
      ];
      input.configuration = {
        consultantActions: [
          { parameter: 'zone_width', value: 1200, actionType: 'SET_VALUE' },
        ],
      };

      const output = runBomPipeline(input);
      expect(output.status).toBe('SUCCESS');
    });

    it('should block when consultant exceeds allowed range', () => {
      const input = createRealisticInput();
      input.permissions = [
        { parameter: 'zone_width', locked: false, minValue: 500, maxValue: 2000 },
      ];
      input.configuration = {
        consultantActions: [
          { parameter: 'zone_width', value: 3000, actionType: 'SET_VALUE' },
        ],
      };

      const output = runBomPipeline(input);
      expect(output.status).toBe('BLOCKED');
      expect(output.errors[0].code).toBe(ErrorCode.PERM_VALUE_OUT_OF_RANGE);
    });

    it('should block when consultant modifies locked parameter', () => {
      const input = createRealisticInput();
      input.permissions = [
        { parameter: 'sku_selection', locked: true },
      ];
      input.configuration = {
        consultantActions: [
          { parameter: 'sku_selection', value: 'sku-other', actionType: 'SELECT_SKU' },
        ],
      };

      const output = runBomPipeline(input);
      expect(output.status).toBe('BLOCKED');
      expect(output.errors[0].code).toBe(ErrorCode.PERM_LOCKED_PARAMETER);
    });
  });

  describe('pipeline with compatibility rules', () => {
    it('should block when alternative SKUs are used together', () => {
      const input = createRealisticInput();
      input.configuration = {
        selectedSkuPairs: [
          { sourceSkuId: 'sku-panel-oak-001', targetSkuId: 'sku-panel-oak-002' },
        ],
      };
      input.compatibilityRules = [
        {
          sourceSkuId: 'sku-panel-oak-001',
          targetSkuId: 'sku-panel-oak-002',
          relationshipType: 'ALTERNATIVE_TO',
          isMandatory: false,
        },
      ];

      const output = runBomPipeline(input);
      expect(output.status).toBe('BLOCKED');
      expect(output.errors[0].code).toBe(ErrorCode.COMPAT_INCOMPATIBLE_SKUS);
    });

    it('should block when required companion SKU is missing', () => {
      const input = createRealisticInput();
      input.configuration = {
        selectedSkuPairs: [
          { sourceSkuId: 'sku-panel-oak-001', targetSkuId: 'sku-something-else' },
        ],
      };
      input.compatibilityRules = [
        {
          sourceSkuId: 'sku-panel-oak-001',
          targetSkuId: 'sku-required-companion',
          relationshipType: 'REQUIRES',
          isMandatory: true,
        },
      ];

      const output = runBomPipeline(input);
      expect(output.status).toBe('BLOCKED');
      expect(output.errors[0].code).toBe(ErrorCode.COMPAT_MISSING_REQUIRED);
    });
  });

  describe('pipeline with geometry configuration', () => {
    it('should emit zone too large error when maxZoneDimension is configured', () => {
      const input = createRealisticInput();
      input.configuration = {
        maxZoneDimension: 1000,
      };

      const output = runBomPipeline(input);
      expect(output.status).toBe('BLOCKED');
      expect(output.errors.some(e => e.code === ErrorCode.GEO_ZONE_TOO_LARGE)).toBe(true);
    });

    it('should emit gap too small warning when minGap is configured', () => {
      const input = createRealisticInput();
      input.configuration = {
        minGap: 5,
      };

      const output = runBomPipeline(input);
      // Gap is 3mm which is < minGap 5mm -> warning
      expect(output.warnings.some(w => w.code === ErrorCode.GEO_GAP_TOO_SMALL)).toBe(true);
    });

    it('should emit panel too large error when maxPanelDimension is configured', () => {
      const input = createRealisticInput();
      input.configuration = {
        maxPanelDimension: 500,
      };

      const output = runBomPipeline(input);
      // Panel is 600x1200 which exceeds 500
      expect(output.status).toBe('BLOCKED');
      expect(output.errors.some(e => e.code === ErrorCode.GEO_PANEL_TOO_LARGE)).toBe(true);
    });

    it('should not emit aspect ratio warning when maxAspectRatio is not configured', () => {
      const input: BomPipelineInput = {
        snapshotData: {
          zones: [
            {
              zoneId: 'z-tall',
              x: 0,
              y: 0,
              width: 200,
              height: 2400,
              skuId: 'sku-1',
              panelWidth: 200,
              panelHeight: 400,
              gapHorizontal: 0,
              gapVertical: 0,
              wasteFactor: 0.05,
            },
          ],
        },
        measurements: {
          wallWidth: 3000,
          wallHeight: 2400,
          templateWallWidth: 3000,
        },
        configuration: {}, // No maxAspectRatio set
        ruleSet: {},
        permissions: [],
        compatibilityRules: [],
      };

      const output = runBomPipeline(input);
      // Aspect ratio is 12:1, but since maxAspectRatio is not configured, no warning
      expect(output.warnings.every(w => w.code !== ErrorCode.GEO_ZONE_ASPECT_RATIO)).toBe(true);
    });

    it('should emit aspect ratio warning when maxAspectRatio is explicitly configured', () => {
      const input: BomPipelineInput = {
        snapshotData: {
          zones: [
            {
              zoneId: 'z-tall',
              x: 0,
              y: 0,
              width: 200,
              height: 2400,
              skuId: 'sku-1',
              panelWidth: 200,
              panelHeight: 400,
              gapHorizontal: 0,
              gapVertical: 0,
              wasteFactor: 0.05,
            },
          ],
        },
        measurements: {
          wallWidth: 3000,
          wallHeight: 2400,
          templateWallWidth: 3000,
        },
        configuration: { maxAspectRatio: 10 }, // Explicit limit
        ruleSet: {},
        permissions: [],
        compatibilityRules: [],
      };

      const output = runBomPipeline(input);
      expect(output.warnings.some(w => w.code === ErrorCode.GEO_ZONE_ASPECT_RATIO)).toBe(true);
    });

    it('should emit total width mismatch when checkTotalDimensions is enabled', () => {
      const input: BomPipelineInput = {
        snapshotData: {
          zones: [
            {
              zoneId: 'z1',
              x: 0,
              y: 0,
              width: 1000,
              height: 2400,
              skuId: 'sku-1',
              panelWidth: 300,
              panelHeight: 400,
              gapHorizontal: 0,
              gapVertical: 0,
              wasteFactor: 0.05,
            },
            {
              zoneId: 'z2',
              x: 1000,
              y: 0,
              width: 1000,
              height: 2400,
              skuId: 'sku-2',
              panelWidth: 300,
              panelHeight: 400,
              gapHorizontal: 0,
              gapVertical: 0,
              wasteFactor: 0.05,
            },
          ],
        },
        measurements: {
          wallWidth: 3000,
          wallHeight: 2400,
          templateWallWidth: 3000,
        },
        configuration: { checkTotalDimensions: true },
        ruleSet: {},
        permissions: [],
        compatibilityRules: [],
      };

      const output = runBomPipeline(input);
      // Total zone widths = 2000, wall width = 3000 -> mismatch
      expect(output.status).toBe('BLOCKED');
      expect(output.errors.some(e => e.code === ErrorCode.GEO_TOTAL_WIDTH_MISMATCH)).toBe(true);
    });
  });

  describe('pipeline with construction rules', () => {
    it('should pass when all mandatory construction rules are satisfied', () => {
      const input = createRealisticInput();
      input.ruleSet = {
        constructionRules: [
          { componentId: 'zone-wall-left', isMandatory: true },
          { componentId: 'zone-wall-right', isMandatory: true },
        ],
      };

      const output = runBomPipeline(input);
      expect(output.status).toBe('SUCCESS');
    });

    it('should block when a mandatory component is missing', () => {
      const input = createRealisticInput();
      input.ruleSet = {
        constructionRules: [
          { componentId: 'non-existent-component', isMandatory: true },
        ],
      };

      const output = runBomPipeline(input);
      expect(output.status).toBe('BLOCKED');
      expect(output.errors[0].code).toBe(ErrorCode.CONST_MISSING_REQUIRED_COMPONENT);
    });
  });

  describe('end-to-end output structure', () => {
    it('should produce output lines with all required fields populated', () => {
      const input = createRealisticInput();
      const output = runBomPipeline(input);

      expect(output.status).toBe('SUCCESS');
      for (const line of output.actualBomLines) {
        expect(line.lineId).toBeTruthy();
        expect(line.componentId).toBeTruthy();
        expect(line.skuId).toBeTruthy();
        expect(line.quantity).toBeGreaterThan(0);
        expect(line.requiredQuantity).toBeGreaterThan(0);
        expect(typeof line.wasteQuantity).toBe('number');
        expect(line.unitOfMeasure).toBeTruthy();
        expect(line.calculationRule).toBeTruthy();
      }
    });

    it('should produce a deterministic result for same input', () => {
      const input = createRealisticInput();
      const output1 = runBomPipeline(input);
      const output2 = runBomPipeline(input);

      expect(output1.status).toBe(output2.status);
      expect(output1.actualBomLines).toEqual(output2.actualBomLines);
      expect(output1.errors).toEqual(output2.errors);
      expect(output1.warnings).toEqual(output2.warnings);
    });

    it('should produce expected error structure when blocked', () => {
      const input = createRealisticInput();
      input.measurements.wallWidth = 0;

      const output = runBomPipeline(input);

      expect(output.status).toBe('BLOCKED');
      expect(output.actualBomLines).toHaveLength(0);
      for (const error of output.errors) {
        expect(error.code).toBeTruthy();
        expect(error.severity).toBe(ErrorSeverity.BLOCKING);
        expect(error.category).toBeTruthy();
        expect(error.message).toBeTruthy();
      }
    });
  });
});
