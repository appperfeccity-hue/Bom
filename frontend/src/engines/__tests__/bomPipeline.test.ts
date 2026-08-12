import { describe, it, expect } from 'vitest';
import { runBomPipeline } from '../bomPipeline';
import type { BomPipelineInput } from '../bomPipeline';
import { ErrorCode } from '../errorCatalogue';

function createValidInput(overrides?: Partial<BomPipelineInput>): BomPipelineInput {
  return {
    snapshotData: {
      zones: [
        {
          zoneId: 'zone-1',
          x: 0,
          y: 0,
          width: 1000,
          height: 1000,
          skuId: 'sku-panel-1',
          panelWidth: 300,
          panelHeight: 400,
          gapHorizontal: 5,
          gapVertical: 5,
          wasteFactor: 0.05,
        },
      ],
      lighting: [
        {
          componentId: 'light-1',
          skuId: 'sku-light-1',
          edges: [{ length: 1000 }, { length: 800 }],
          mountingType: 'DIRECT',
          mode: 'DISCRETE',
          unitLength: 200,
        },
      ],
      furniture: [
        {
          componentId: 'furn-1',
          skuId: 'sku-furn-1',
          quantity: 2,
          min: 1,
          max: 5,
        },
      ],
      hiddenComponents: [
        {
          componentId: 'hidden-1',
          skuId: 'sku-hidden-1',
          triggerType: 'ALWAYS',
          quantityRule: 'FIXED',
          fixedValue: 4,
        },
      ],
    },
    measurements: {
      wallWidth: 3000,
      wallHeight: 2700,
      templateWallWidth: 3000,
    },
    configuration: {},
    ruleSet: {},
    permissions: [],
    compatibilityRules: [],
    ...overrides,
  };
}

describe('bomPipeline', () => {
  describe('happy path', () => {
    it('should produce SUCCESS with valid input', () => {
      const input = createValidInput();
      const output = runBomPipeline(input);
      expect(output.status).toBe('SUCCESS');
      expect(output.errors).toHaveLength(0);
      expect(output.actualBomLines.length).toBeGreaterThan(0);
    });

    it('should include panel BOM lines', () => {
      const input = createValidInput();
      const output = runBomPipeline(input);
      const panelLine = output.actualBomLines.find(
        (l) => l.calculationRule === 'WALL_PANEL'
      );
      expect(panelLine).toBeDefined();
      expect(panelLine!.quantity).toBeGreaterThan(0);
    });

    it('should include lighting BOM lines', () => {
      const input = createValidInput();
      const output = runBomPipeline(input);
      const lightLine = output.actualBomLines.find(
        (l) => l.calculationRule === 'LIGHT'
      );
      expect(lightLine).toBeDefined();
    });

    it('should include furniture BOM lines', () => {
      const input = createValidInput();
      const output = runBomPipeline(input);
      const furnLine = output.actualBomLines.find(
        (l) => l.calculationRule === 'FURNITURE'
      );
      expect(furnLine).toBeDefined();
      expect(furnLine!.quantity).toBe(2);
    });

    it('should include hidden component BOM lines', () => {
      const input = createValidInput();
      const output = runBomPipeline(input);
      const hiddenLine = output.actualBomLines.find(
        (l) => l.calculationRule === 'HIDDEN_COMPONENT'
      );
      expect(hiddenLine).toBeDefined();
      expect(hiddenLine!.quantity).toBe(4);
    });
  });

  describe('permission blocking', () => {
    it('should return BLOCKED when permission is violated', () => {
      const input = createValidInput({
        permissions: [{ parameter: 'width', locked: true }],
        configuration: {
          consultantActions: [
            { parameter: 'width', value: 500, actionType: 'SET_VALUE' },
          ],
        },
      });
      const output = runBomPipeline(input);
      expect(output.status).toBe('BLOCKED');
      expect(output.errors[0].code).toBe(ErrorCode.PERM_LOCKED_PARAMETER);
      expect(output.actualBomLines).toHaveLength(0);
    });

    it('should not execute further steps after permission block', () => {
      const input = createValidInput({
        permissions: [{ parameter: 'material', locked: true }],
        configuration: {
          consultantActions: [
            { parameter: 'material', value: 'wood', actionType: 'SET_VALUE' },
          ],
        },
        // Even with bad geometry, pipeline should stop at permissions
        snapshotData: {
          zones: [
            {
              zoneId: 'z1',
              x: -100,
              y: -100,
              width: -500,
              height: -500,
              skuId: 'sku-1',
            },
          ],
        },
      });
      const output = runBomPipeline(input);
      expect(output.status).toBe('BLOCKED');
      expect(output.errors).toHaveLength(1);
      expect(output.errors[0].code).toBe(ErrorCode.PERM_LOCKED_PARAMETER);
    });
  });

  describe('compatibility blocking', () => {
    it('should return BLOCKED when incompatible SKUs are selected', () => {
      const input = createValidInput({
        configuration: {
          selectedSkuPairs: [
            { sourceSkuId: 'sku-a', targetSkuId: 'sku-b' },
          ],
        },
        compatibilityRules: [
          {
            sourceSkuId: 'sku-a',
            targetSkuId: 'sku-b',
            relationshipType: 'ALTERNATIVE_TO',
            isMandatory: false,
          },
        ],
      });
      const output = runBomPipeline(input);
      expect(output.status).toBe('BLOCKED');
      expect(output.errors[0].code).toBe(ErrorCode.COMPAT_INCOMPATIBLE_SKUS);
    });
  });

  describe('geometry blocking', () => {
    it('should return BLOCKED when geometry validation fails', () => {
      const input = createValidInput({
        snapshotData: {
          zones: [
            {
              zoneId: 'z1',
              x: 0,
              y: 0,
              width: -100,
              height: 500,
              skuId: 'sku-1',
              panelWidth: 300,
              panelHeight: 400,
            },
          ],
        },
      });
      const output = runBomPipeline(input);
      expect(output.status).toBe('BLOCKED');
      expect(
        output.errors.some((e) => e.code === ErrorCode.GEO_ZONE_NEGATIVE_DIMENSION)
      ).toBe(true);
    });

    it('should return BLOCKED when wall dimensions are invalid', () => {
      const input = createValidInput({
        measurements: {
          wallWidth: 0,
          wallHeight: 2700,
          templateWallWidth: 3000,
        },
      });
      const output = runBomPipeline(input);
      expect(output.status).toBe('BLOCKED');
      expect(output.errors[0].code).toBe(ErrorCode.GEO_WALL_DIMENSION_INVALID);
    });
  });

  describe('construction blocking', () => {
    it('should return BLOCKED when mandatory component is missing', () => {
      const input = createValidInput({
        ruleSet: {
          constructionRules: [
            { componentId: 'missing-comp', isMandatory: true },
          ],
        },
      });
      const output = runBomPipeline(input);
      expect(output.status).toBe('BLOCKED');
      expect(output.errors[0].code).toBe(
        ErrorCode.CONST_MISSING_REQUIRED_COMPONENT
      );
    });
  });

  describe('warning accumulation', () => {
    it('should accumulate warnings from non-blocking steps', () => {
      const input = createValidInput({
        snapshotData: {
          zones: [
            {
              zoneId: 'z1',
              x: 0,
              y: 0,
              width: 200,
              height: 2500,
              skuId: 'sku-1',
              panelWidth: 300,
              panelHeight: 400,
              gapHorizontal: 5,
              gapVertical: 5,
              wasteFactor: 0.05,
            },
          ],
        },
        configuration: {
          maxAspectRatio: 10,
        },
      });
      const output = runBomPipeline(input);
      // Aspect ratio 12.5 > 10 produces a warning
      expect(output.warnings.some((w) => w.code === ErrorCode.GEO_ZONE_ASPECT_RATIO)).toBe(true);
    });
  });

  describe('pipeline chaining', () => {
    it('should skip adaptation when template and actual wall are same size', () => {
      const input = createValidInput({
        measurements: {
          wallWidth: 3000,
          wallHeight: 2700,
          templateWallWidth: 3000,
        },
      });
      const output = runBomPipeline(input);
      expect(output.status).toBe('SUCCESS');
    });

    it('should skip permission step when no consultant actions', () => {
      const input = createValidInput({
        permissions: [{ parameter: 'locked_param', locked: true }],
        configuration: {},
      });
      // No consultant actions, so locked param does not block
      const output = runBomPipeline(input);
      expect(output.status).toBe('SUCCESS');
    });

    it('should skip compatibility step when no selected sku pairs', () => {
      const input = createValidInput({
        compatibilityRules: [
          {
            sourceSkuId: 'sku-a',
            targetSkuId: 'sku-b',
            relationshipType: 'ALTERNATIVE_TO',
            isMandatory: false,
          },
        ],
        configuration: {},
      });
      // No selected pairs, so alternative_to rule is not triggered
      const output = runBomPipeline(input);
      expect(output.status).toBe('SUCCESS');
    });

    it('should produce empty BOM lines when no calculable components exist', () => {
      const input = createValidInput({
        snapshotData: {
          zones: [
            {
              zoneId: 'z1',
              x: 0,
              y: 0,
              width: 1000,
              height: 1000,
              skuId: 'sku-1',
              // No panelWidth/panelHeight, so panel calc is skipped
            },
          ],
        },
      });
      const output = runBomPipeline(input);
      // No panel calculations possible, but no blocking error either
      // (zones without panel dimensions simply don't produce lines)
      expect(output.status).toBe('SUCCESS');
      expect(output.actualBomLines).toHaveLength(0);
    });

    it('should keep BOM lines separate per zone for traceability', () => {
      const input = createValidInput({
        snapshotData: {
          zones: [
            {
              zoneId: 'z1',
              x: 0,
              y: 0,
              width: 1000,
              height: 1000,
              skuId: 'sku-same',
              panelWidth: 300,
              panelHeight: 400,
              gapHorizontal: 5,
              gapVertical: 5,
              wasteFactor: 0.05,
            },
            {
              zoneId: 'z2',
              x: 1000,
              y: 0,
              width: 1000,
              height: 1000,
              skuId: 'sku-same',
              panelWidth: 300,
              panelHeight: 400,
              gapHorizontal: 5,
              gapVertical: 5,
              wasteFactor: 0.05,
            },
          ],
        },
      });
      const output = runBomPipeline(input);
      expect(output.status).toBe('SUCCESS');
      // Same SKU + same calculation rule but different componentId keeps lines separate
      const panelLines = output.actualBomLines.filter(
        (l) => l.calculationRule === 'WALL_PANEL'
      );
      expect(panelLines).toHaveLength(2);
      expect(panelLines[0].componentId).toBe('z1');
      expect(panelLines[1].componentId).toBe('z2');
      // Each line has its own quantity
      expect(panelLines[0].quantity).toBeGreaterThan(0);
      expect(panelLines[1].quantity).toBeGreaterThan(0);
    });
  });
});
