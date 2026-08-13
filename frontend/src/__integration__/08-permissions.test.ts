/**
 * Integration Test Area 8: Permissions
 *
 * Validates that:
 * - Designer mode (no consultant actions) passes permissions step
 * - Consultant trying to modify LOCKED parameter blocks with PERM_LOCKED_PARAMETER
 * - Consultant setting value outside permitted range blocks with PERM_VALUE_OUT_OF_RANGE
 * - No bypass: providing empty permissions array still allows valid actions
 */

import { describe, it, expect } from 'vitest';
import { runBomPipeline } from '@/engines/bomPipeline';
import { validatePermissions } from '@/engines/validationEngine';
import { ErrorCode } from '@/engines/errorCatalogue';
import {
  createStraightWallPipelineInput,
  createConsultantModeInput,
} from './helpers/fixtures';

describe('Integration Area 8: Permissions', () => {
  describe('Designer mode passes permissions step', () => {
    it('no consultant actions means pipeline skips permission check entirely', () => {
      const input = createStraightWallPipelineInput();
      // No consultantActions set
      input.permissions = [
        { parameter: 'zone_width', locked: true },
        { parameter: 'sku_selection', locked: true },
      ];

      const output = runBomPipeline(input);

      // Pipeline should succeed since permission check is skipped when no actions
      expect(output.status).toBe('SUCCESS');
    });

    it('empty consultantActions array skips permission check', () => {
      const input = createStraightWallPipelineInput();
      input.configuration = { consultantActions: [] };
      input.permissions = [
        { parameter: 'anything', locked: true },
      ];

      const output = runBomPipeline(input);

      expect(output.status).toBe('SUCCESS');
    });

    it('designer with valid permissions passes full pipeline', () => {
      const input = createConsultantModeInput();
      const output = runBomPipeline(input);

      expect(output.status).toBe('SUCCESS');
      expect(output.errors).toHaveLength(0);
    });
  });

  describe('Consultant modifying LOCKED parameter is blocked', () => {
    it('PERM_LOCKED_PARAMETER error when modifying locked parameter', () => {
      const input = createStraightWallPipelineInput();
      input.permissions = [
        { parameter: 'sku_selection', locked: true },
      ];
      input.configuration = {
        consultantActions: [
          { parameter: 'sku_selection', value: 'sku-new', actionType: 'SELECT_SKU' },
        ],
      };

      const output = runBomPipeline(input);

      expect(output.status).toBe('BLOCKED');
      expect(output.errors[0].code).toBe(ErrorCode.PERM_LOCKED_PARAMETER);
    });

    it('multiple locked parameters each trigger their own error', () => {
      const permissions = [
        { parameter: 'param_a', locked: true },
        { parameter: 'param_b', locked: true },
      ];
      const actions = [
        { parameter: 'param_a', value: 'x' as string | number, actionType: 'SET_VALUE' as const },
        { parameter: 'param_b', value: 'y' as string | number, actionType: 'SET_VALUE' as const },
      ];

      const result = validatePermissions(permissions, actions);

      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors.every(e => e.code === ErrorCode.PERM_LOCKED_PARAMETER)).toBe(true);
    });
  });

  describe('Consultant value outside permitted range is blocked', () => {
    it('PERM_VALUE_OUT_OF_RANGE when value exceeds maxValue', () => {
      const input = createStraightWallPipelineInput();
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

    it('PERM_VALUE_OUT_OF_RANGE when value is below minValue', () => {
      const input = createStraightWallPipelineInput();
      input.permissions = [
        { parameter: 'zone_height', locked: false, minValue: 1000, maxValue: 2700 },
      ];
      input.configuration = {
        consultantActions: [
          { parameter: 'zone_height', value: 500, actionType: 'SET_VALUE' },
        ],
      };

      const output = runBomPipeline(input);

      expect(output.status).toBe('BLOCKED');
      expect(output.errors[0].code).toBe(ErrorCode.PERM_VALUE_OUT_OF_RANGE);
    });

    it('value at exact boundary passes (minValue)', () => {
      const input = createStraightWallPipelineInput();
      input.permissions = [
        { parameter: 'zone_width', locked: false, minValue: 500, maxValue: 2000 },
      ];
      input.configuration = {
        consultantActions: [
          { parameter: 'zone_width', value: 500, actionType: 'SET_VALUE' },
        ],
      };

      const output = runBomPipeline(input);

      expect(output.status).toBe('SUCCESS');
    });

    it('value at exact boundary passes (maxValue)', () => {
      const input = createStraightWallPipelineInput();
      input.permissions = [
        { parameter: 'zone_width', locked: false, minValue: 500, maxValue: 2000 },
      ];
      input.configuration = {
        consultantActions: [
          { parameter: 'zone_width', value: 2000, actionType: 'SET_VALUE' },
        ],
      };

      const output = runBomPipeline(input);

      expect(output.status).toBe('SUCCESS');
    });
  });

  describe('No bypass with empty permissions', () => {
    it('empty permissions array allows any valid action to proceed', () => {
      const input = createStraightWallPipelineInput();
      input.permissions = [];
      input.configuration = {
        consultantActions: [
          { parameter: 'zone_width', value: 9999, actionType: 'SET_VALUE' },
        ],
      };

      const output = runBomPipeline(input);

      // Empty permissions means no rules to violate - passes permission step
      expect(output.status).toBe('SUCCESS');
    });

    it('action without matching permission rule passes (no rule = no restriction)', () => {
      const permissions = [
        { parameter: 'other_param', locked: true },
      ];
      const actions = [
        { parameter: 'unrelated_param', value: 999 as string | number, actionType: 'SET_VALUE' as const },
      ];

      const result = validatePermissions(permissions, actions);

      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
