import { describe, it, expect } from 'vitest';
import {
  validatePermissions,
  checkCompatibility,
  validateGeometry,
  validateConstruction,
  validateBom,
} from '../validationEngine';
import { ErrorCode, ErrorSeverity } from '../errorCatalogue';

describe('validationEngine', () => {
  describe('validatePermissions', () => {
    it('should pass when no actions violate permissions', () => {
      const result = validatePermissions(
        [{ parameter: 'color', locked: false }],
        [{ parameter: 'color', value: 'blue', actionType: 'SET_VALUE' }]
      );
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when modifying a locked parameter', () => {
      const result = validatePermissions(
        [{ parameter: 'material', locked: true }],
        [{ parameter: 'material', value: 'wood', actionType: 'SET_VALUE' }]
      );
      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(ErrorCode.PERM_LOCKED_PARAMETER);
    });

    it('should fail when value is below minimum', () => {
      const result = validatePermissions(
        [{ parameter: 'width', locked: false, minValue: 100, maxValue: 500 }],
        [{ parameter: 'width', value: 50, actionType: 'SET_VALUE' }]
      );
      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(ErrorCode.PERM_VALUE_OUT_OF_RANGE);
    });

    it('should fail when value is above maximum', () => {
      const result = validatePermissions(
        [{ parameter: 'height', locked: false, minValue: 100, maxValue: 500 }],
        [{ parameter: 'height', value: 600, actionType: 'SET_VALUE' }]
      );
      expect(result.passed).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.PERM_VALUE_OUT_OF_RANGE);
    });

    it('should fail when selecting a disallowed SKU', () => {
      const result = validatePermissions(
        [
          {
            parameter: 'panel_sku',
            locked: false,
            allowedSkus: ['sku-a', 'sku-b'],
          },
        ],
        [{ parameter: 'panel_sku', value: 'sku-c', actionType: 'SELECT_SKU' }]
      );
      expect(result.passed).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.PERM_INVALID_SKU_SELECTION);
    });

    it('should pass when selecting an allowed SKU', () => {
      const result = validatePermissions(
        [
          {
            parameter: 'panel_sku',
            locked: false,
            allowedSkus: ['sku-a', 'sku-b'],
          },
        ],
        [{ parameter: 'panel_sku', value: 'sku-a', actionType: 'SELECT_SKU' }]
      );
      expect(result.passed).toBe(true);
    });

    it('should pass when no permission rule exists for the action', () => {
      const result = validatePermissions(
        [{ parameter: 'other', locked: true }],
        [{ parameter: 'color', value: 'red', actionType: 'SET_VALUE' }]
      );
      expect(result.passed).toBe(true);
    });

    it('should accumulate multiple errors', () => {
      const result = validatePermissions(
        [
          { parameter: 'a', locked: true },
          { parameter: 'b', locked: true },
        ],
        [
          { parameter: 'a', value: 1, actionType: 'SET_VALUE' },
          { parameter: 'b', value: 2, actionType: 'SET_VALUE' },
        ]
      );
      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('checkCompatibility', () => {
    it('should pass when no incompatible pairs exist', () => {
      const result = checkCompatibility(
        [{ sourceSkuId: 'sku-1', targetSkuId: 'sku-2' }],
        [
          {
            sourceSkuId: 'sku-1',
            targetSkuId: 'sku-2',
            relationshipType: 'COMPATIBLE_WITH',
            isMandatory: false,
          },
        ]
      );
      expect(result.passed).toBe(true);
    });

    it('should fail when a mandatory required SKU is missing', () => {
      const result = checkCompatibility(
        [{ sourceSkuId: 'sku-1', targetSkuId: 'sku-3' }],
        [
          {
            sourceSkuId: 'sku-1',
            targetSkuId: 'sku-2',
            relationshipType: 'REQUIRES',
            isMandatory: true,
          },
        ]
      );
      expect(result.passed).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.COMPAT_MISSING_REQUIRED);
    });

    it('should pass when a mandatory required SKU is present', () => {
      const result = checkCompatibility(
        [{ sourceSkuId: 'sku-1', targetSkuId: 'sku-2' }],
        [
          {
            sourceSkuId: 'sku-1',
            targetSkuId: 'sku-2',
            relationshipType: 'REQUIRES',
            isMandatory: true,
          },
        ]
      );
      expect(result.passed).toBe(true);
    });

    it('should fail when alternative SKUs are both present', () => {
      const result = checkCompatibility(
        [{ sourceSkuId: 'sku-1', targetSkuId: 'sku-2' }],
        [
          {
            sourceSkuId: 'sku-1',
            targetSkuId: 'sku-2',
            relationshipType: 'ALTERNATIVE_TO',
            isMandatory: false,
          },
        ]
      );
      expect(result.passed).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.COMPAT_INCOMPATIBLE_SKUS);
    });

    it('should pass with empty pairs and rules', () => {
      const result = checkCompatibility([], []);
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateGeometry', () => {
    const validWall = { width: 3000, height: 2700 };

    it('should pass with valid zones within wall', () => {
      const result = validateGeometry(
        [{ zoneId: 'z1', x: 0, y: 0, width: 1000, height: 1000 }],
        validWall
      );
      expect(result.passed).toBe(true);
    });

    it('should fail when wall dimensions are invalid', () => {
      const result = validateGeometry(
        [{ zoneId: 'z1', x: 0, y: 0, width: 1000, height: 1000 }],
        { width: 0, height: 2700 }
      );
      expect(result.passed).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.GEO_WALL_DIMENSION_INVALID);
    });

    it('should fail when zone has negative dimensions', () => {
      const result = validateGeometry(
        [{ zoneId: 'z1', x: 0, y: 0, width: -100, height: 1000 }],
        validWall
      );
      expect(result.passed).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.GEO_ZONE_NEGATIVE_DIMENSION);
    });

    it('should fail when zone has invalid position', () => {
      const result = validateGeometry(
        [{ zoneId: 'z1', x: -10, y: 0, width: 500, height: 500 }],
        validWall
      );
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.code === ErrorCode.GEO_ZONE_INVALID_POSITION)).toBe(true);
    });

    it('should fail when zone exceeds wall boundary', () => {
      const result = validateGeometry(
        [{ zoneId: 'z1', x: 2500, y: 0, width: 600, height: 500 }],
        validWall
      );
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.code === ErrorCode.GEO_ZONE_EXCEEDS_WALL)).toBe(true);
    });

    it('should fail when zone is outside wall', () => {
      const result = validateGeometry(
        [{ zoneId: 'z1', x: 4000, y: 0, width: 500, height: 500 }],
        validWall
      );
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.code === ErrorCode.GEO_ZONE_OUTSIDE_WALL)).toBe(true);
    });

    it('should fail when zones overlap', () => {
      const result = validateGeometry(
        [
          { zoneId: 'z1', x: 0, y: 0, width: 600, height: 600 },
          { zoneId: 'z2', x: 500, y: 500, width: 600, height: 600 },
        ],
        validWall
      );
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.code === ErrorCode.GEO_ZONE_OVERLAP)).toBe(true);
    });

    it('should fail when zone count exceeds max', () => {
      const zones = Array.from({ length: 5 }, (_, i) => ({
        zoneId: `z${i}`,
        x: i * 200,
        y: 0,
        width: 150,
        height: 500,
      }));
      const result = validateGeometry(zones, {
        ...validWall,
        maxZoneCount: 3,
      });
      expect(result.passed).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.GEO_ZONE_COUNT_EXCEEDED);
    });

    it('should produce warning for extreme aspect ratio', () => {
      const result = validateGeometry(
        [{ zoneId: 'z1', x: 0, y: 0, width: 200, height: 2500 }],
        { ...validWall, maxAspectRatio: 10 }
      );
      // Aspect ratio 12.5 > 10
      expect(result.warnings.some((w) => w.code === ErrorCode.GEO_ZONE_ASPECT_RATIO)).toBe(true);
    });

    it('should fail when zone is below minimum dimension', () => {
      const result = validateGeometry(
        [{ zoneId: 'z1', x: 0, y: 0, width: 50, height: 500 }],
        { ...validWall, minZoneDimension: 100 }
      );
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.code === ErrorCode.GEO_ZONE_MIN_DIMENSION)).toBe(true);
    });
  });

  describe('validateConstruction', () => {
    it('should pass when all mandatory components are present', () => {
      const result = validateConstruction(
        [
          { componentId: 'c1', skuId: 'sku-1', isPresent: true, isMandatory: true },
        ],
        [{ componentId: 'c1', isMandatory: true }]
      );
      expect(result.passed).toBe(true);
    });

    it('should fail when a mandatory component is missing', () => {
      const result = validateConstruction(
        [],
        [{ componentId: 'c1', isMandatory: true }]
      );
      expect(result.passed).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.CONST_MISSING_REQUIRED_COMPONENT);
    });

    it('should fail when mounting type is invalid', () => {
      const result = validateConstruction(
        [
          {
            componentId: 'c1',
            skuId: 'sku-1',
            mountingType: 'CEILING',
            isPresent: true,
          },
        ],
        [{ componentId: 'c1', validMountingTypes: ['WALL', 'FLOOR'] }]
      );
      expect(result.passed).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.CONST_INVALID_MOUNTING);
    });

    it('should fail when structure is required but not present', () => {
      const result = validateConstruction(
        [
          {
            componentId: 'c1',
            skuId: 'sku-1',
            hasStructure: false,
            isPresent: true,
          },
        ],
        [{ componentId: 'c1', requiresStructure: true }]
      );
      expect(result.passed).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.CONST_STRUCTURE_REQUIRED);
    });

    it('should pass with empty rules', () => {
      const result = validateConstruction(
        [{ componentId: 'c1', skuId: 'sku-1', isPresent: true }],
        []
      );
      expect(result.passed).toBe(true);
    });
  });

  describe('validateBom', () => {
    it('should pass when all lines have positive quantities', () => {
      const result = validateBom([
        { lineId: 'l1', skuId: 'sku-1', quantity: 5, requiredQuantity: 4 },
        { lineId: 'l2', skuId: 'sku-2', quantity: 3, requiredQuantity: 3 },
      ]);
      expect(result.passed).toBe(true);
    });

    it('should fail when a line has zero quantity', () => {
      const result = validateBom([
        { lineId: 'l1', skuId: 'sku-1', quantity: 0, requiredQuantity: 0 },
      ]);
      expect(result.passed).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.QTY_PANEL_NO_VALID_ARRANGEMENT);
    });

    it('should fail when a line has negative quantity', () => {
      const result = validateBom([
        { lineId: 'l1', skuId: 'sku-1', quantity: -1, requiredQuantity: 0 },
      ]);
      expect(result.passed).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.QTY_PANEL_NO_VALID_ARRANGEMENT);
    });

    it('should pass with empty lines', () => {
      const result = validateBom([]);
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report all lines with invalid quantities', () => {
      const result = validateBom([
        { lineId: 'l1', skuId: 'sku-1', quantity: 0, requiredQuantity: 0 },
        { lineId: 'l2', skuId: 'sku-2', quantity: -2, requiredQuantity: 0 },
      ]);
      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it('should produce BLOCKING severity for invalid quantities', () => {
      const result = validateBom([
        { lineId: 'l1', skuId: 'sku-1', quantity: 0, requiredQuantity: 0 },
      ]);
      expect(result.errors[0].severity).toBe(ErrorSeverity.BLOCKING);
    });
  });
});
