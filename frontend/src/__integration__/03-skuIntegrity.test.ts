/**
 * Integration Test Area 3: SKU Integrity
 *
 * Validates that:
 * - checkCompatibility blocks incompatible SKU pairs (ALTERNATIVE_TO)
 * - checkCompatibility blocks when mandatory REQUIRES companion is missing
 * - Removing a required SKU from pairs correctly triggers COMPAT_MISSING_REQUIRED error
 * - Consultant restricted SKU selections blocked by validatePermissions
 */

import { describe, it, expect } from 'vitest';
import { checkCompatibility, validatePermissions } from '@/engines/validationEngine';
import type { SkuPair, CompatibilityRule, PermissionRule, ConsultantAction } from '@/engines/validationEngine';
import { ErrorCode } from '@/engines/errorCatalogue';
import { runBomPipeline } from '@/engines/bomPipeline';
import { createStraightWallPipelineInput } from './helpers/fixtures';

describe('Integration Area 3: SKU Integrity', () => {
  describe('checkCompatibility blocks incompatible pairs', () => {
    it('ALTERNATIVE_TO relationship blocks both SKUs being used together', () => {
      const selectedSkus: SkuPair[] = [
        { sourceSkuId: 'sku-oak-001', targetSkuId: 'sku-oak-002' },
      ];
      const rules: CompatibilityRule[] = [
        {
          sourceSkuId: 'sku-oak-001',
          targetSkuId: 'sku-oak-002',
          relationshipType: 'ALTERNATIVE_TO',
          isMandatory: false,
        },
      ];

      const result = checkCompatibility(selectedSkus, rules);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(ErrorCode.COMPAT_INCOMPATIBLE_SKUS);
    });

    it('ALTERNATIVE_TO blocks regardless of pair direction', () => {
      const selectedSkus: SkuPair[] = [
        { sourceSkuId: 'sku-oak-002', targetSkuId: 'sku-oak-001' },
      ];
      const rules: CompatibilityRule[] = [
        {
          sourceSkuId: 'sku-oak-001',
          targetSkuId: 'sku-oak-002',
          relationshipType: 'ALTERNATIVE_TO',
          isMandatory: false,
        },
      ];

      const result = checkCompatibility(selectedSkus, rules);

      expect(result.passed).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.COMPAT_INCOMPATIBLE_SKUS);
    });
  });

  describe('checkCompatibility blocks missing REQUIRES companion', () => {
    it('mandatory REQUIRES rule triggers error when companion is absent', () => {
      const selectedSkus: SkuPair[] = [
        { sourceSkuId: 'sku-panel-001', targetSkuId: 'sku-unrelated-001' },
      ];
      const rules: CompatibilityRule[] = [
        {
          sourceSkuId: 'sku-panel-001',
          targetSkuId: 'sku-companion-001',
          relationshipType: 'REQUIRES',
          isMandatory: true,
        },
      ];

      const result = checkCompatibility(selectedSkus, rules);

      expect(result.passed).toBe(false);
      expect(result.errors.some(e => e.code === ErrorCode.COMPAT_MISSING_REQUIRED)).toBe(true);
    });

    it('non-mandatory REQUIRES rule does not block when companion is absent', () => {
      const selectedSkus: SkuPair[] = [
        { sourceSkuId: 'sku-panel-001', targetSkuId: 'sku-unrelated-001' },
      ];
      const rules: CompatibilityRule[] = [
        {
          sourceSkuId: 'sku-panel-001',
          targetSkuId: 'sku-companion-001',
          relationshipType: 'REQUIRES',
          isMandatory: false,
        },
      ];

      const result = checkCompatibility(selectedSkus, rules);

      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Removing required SKU triggers COMPAT_MISSING_REQUIRED', () => {
    it('removing a required companion SKU from selected pairs causes error', () => {
      // First scenario: both present (should pass)
      const withCompanion: SkuPair[] = [
        { sourceSkuId: 'sku-panel-001', targetSkuId: 'sku-companion-001' },
      ];
      const rules: CompatibilityRule[] = [
        {
          sourceSkuId: 'sku-panel-001',
          targetSkuId: 'sku-companion-001',
          relationshipType: 'REQUIRES',
          isMandatory: true,
        },
      ];

      const resultWithCompanion = checkCompatibility(withCompanion, rules);
      expect(resultWithCompanion.passed).toBe(true);

      // Second scenario: companion removed (should fail)
      const withoutCompanion: SkuPair[] = [
        { sourceSkuId: 'sku-panel-001', targetSkuId: 'sku-other-001' },
      ];

      const resultWithoutCompanion = checkCompatibility(withoutCompanion, rules);
      expect(resultWithoutCompanion.passed).toBe(false);
      expect(resultWithoutCompanion.errors[0].code).toBe(ErrorCode.COMPAT_MISSING_REQUIRED);
    });
  });

  describe('Consultant restricted SKU selections blocked by validatePermissions', () => {
    it('consultant selecting SKU not in allowed list is blocked', () => {
      const permissions: PermissionRule[] = [
        {
          parameter: 'sku_selection',
          locked: false,
          allowedSkus: ['sku-approved-001', 'sku-approved-002'],
        },
      ];
      const actions: ConsultantAction[] = [
        { parameter: 'sku_selection', value: 'sku-unapproved-001', actionType: 'SELECT_SKU' },
      ];

      const result = validatePermissions(permissions, actions);

      expect(result.passed).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.PERM_INVALID_SKU_SELECTION);
    });

    it('consultant selecting SKU in allowed list passes', () => {
      const permissions: PermissionRule[] = [
        {
          parameter: 'sku_selection',
          locked: false,
          allowedSkus: ['sku-approved-001', 'sku-approved-002'],
        },
      ];
      const actions: ConsultantAction[] = [
        { parameter: 'sku_selection', value: 'sku-approved-001', actionType: 'SELECT_SKU' },
      ];

      const result = validatePermissions(permissions, actions);

      expect(result.passed).toBe(true);
    });

    it('full pipeline blocks when SKU compatibility fails', () => {
      const input = createStraightWallPipelineInput();
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
  });
});
