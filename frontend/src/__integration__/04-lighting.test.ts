/**
 * Integration Test Area 4: Lighting
 *
 * Validates that:
 * - PROFILE mounting adds 5mm offset per edge
 * - COVE mounting adds 10mm offset per edge
 * - COVE with frame requirement triggers CONST_STRUCTURE_REQUIRED if no structure
 * - LED/driver/wiring calculations are correct: driverCount = ceil(totalLength/5000), wireLength = totalLength + 2000
 * - DISCRETE mode quantity = ceil(totalLength/unitLength)
 */

import { describe, it, expect } from 'vitest';
import { calculateLights } from '@/engines/lightEngine';
import { validateConstruction } from '@/engines/validationEngine';
import { ErrorCode } from '@/engines/errorCatalogue';
import { runBomPipeline } from '@/engines/bomPipeline';
import type { BomPipelineInput } from '@/engines/bomPipeline';
import { createStraightWallPipelineInput } from './helpers/fixtures';

describe('Integration Area 4: Lighting', () => {
  describe('PROFILE mounting offset', () => {
    it('PROFILE mounting adds 5mm offset per edge', () => {
      const result = calculateLights({
        edges: [{ length: 1000 }, { length: 2000 }],
        mountingType: 'PROFILE',
        mode: 'LINEAR',
        unitLength: 500,
      });

      // totalLength = (1000 + 5) + (2000 + 5) = 3010
      expect(result.totalLength).toBe(3010);
    });

    it('single PROFILE edge adds exactly 5mm', () => {
      const result = calculateLights({
        edges: [{ length: 3000 }],
        mountingType: 'PROFILE',
        mode: 'LINEAR',
        unitLength: 600,
      });

      // totalLength = 3000 + 5 = 3005
      expect(result.totalLength).toBe(3005);
    });
  });

  describe('COVE mounting offset', () => {
    it('COVE mounting adds 10mm offset per edge', () => {
      const result = calculateLights({
        edges: [{ length: 1000 }, { length: 2000 }],
        mountingType: 'COVE',
        mode: 'LINEAR',
        unitLength: 500,
      });

      // totalLength = (1000 + 10) + (2000 + 10) = 3020
      expect(result.totalLength).toBe(3020);
    });

    it('three COVE edges each add 10mm', () => {
      const result = calculateLights({
        edges: [{ length: 500 }, { length: 500 }, { length: 500 }],
        mountingType: 'COVE',
        mode: 'LINEAR',
        unitLength: 500,
      });

      // totalLength = (500+10) + (500+10) + (500+10) = 1530
      expect(result.totalLength).toBe(1530);
    });
  });

  describe('DIRECT mounting offset', () => {
    it('DIRECT mounting adds 0mm offset per edge', () => {
      const result = calculateLights({
        edges: [{ length: 1000 }, { length: 2000 }],
        mountingType: 'DIRECT',
        mode: 'LINEAR',
        unitLength: 500,
      });

      // totalLength = (1000 + 0) + (2000 + 0) = 3000
      expect(result.totalLength).toBe(3000);
    });
  });

  describe('COVE with frame/structure requirement', () => {
    it('COVE mounting without structure triggers CONST_STRUCTURE_REQUIRED via construction validation', () => {
      const bomLines = [
        {
          componentId: 'light-cove-1',
          skuId: 'sku-led-cove-001',
          mountingType: 'COVE',
          hasStructure: false,
          isMandatory: true,
          isPresent: true,
        },
      ];
      const rules = [
        {
          componentId: 'light-cove-1',
          requiresStructure: true,
          validMountingTypes: ['COVE'],
          isMandatory: true,
        },
      ];

      const result = validateConstruction(bomLines, rules);

      expect(result.passed).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.CONST_STRUCTURE_REQUIRED);
    });

    it('COVE mounting with structure present passes construction validation', () => {
      const bomLines = [
        {
          componentId: 'light-cove-1',
          skuId: 'sku-led-cove-001',
          mountingType: 'COVE',
          hasStructure: true,
          isMandatory: true,
          isPresent: true,
        },
      ];
      const rules = [
        {
          componentId: 'light-cove-1',
          requiresStructure: true,
          validMountingTypes: ['COVE'],
          isMandatory: true,
        },
      ];

      const result = validateConstruction(bomLines, rules);

      expect(result.passed).toBe(true);
    });
  });

  describe('LED/driver/wiring calculations', () => {
    it('driverCount = ceil(totalLength / 5000)', () => {
      // Total length = 3000 + 5 = 3005 (PROFILE, single edge)
      const result = calculateLights({
        edges: [{ length: 3000 }],
        mountingType: 'PROFILE',
        mode: 'LINEAR',
        unitLength: 600,
      });

      expect(result.driverCount).toBe(Math.ceil(3005 / 5000)); // ceil(3005/5000) = 1
    });

    it('driverCount correctly rounds up for lengths exceeding one driver capacity', () => {
      // Total length = 6000 + 0 = 6000 (DIRECT, single edge)
      const result = calculateLights({
        edges: [{ length: 6000 }],
        mountingType: 'DIRECT',
        mode: 'LINEAR',
        unitLength: 1000,
      });

      expect(result.driverCount).toBe(Math.ceil(6000 / 5000)); // ceil(6000/5000) = 2
    });

    it('driverCount handles exact multiple of 5000', () => {
      const result = calculateLights({
        edges: [{ length: 10000 }],
        mountingType: 'DIRECT',
        mode: 'LINEAR',
        unitLength: 1000,
      });

      expect(result.driverCount).toBe(2); // 10000/5000 = exactly 2
    });

    it('wireLength = totalLength + 2000', () => {
      const result = calculateLights({
        edges: [{ length: 3000 }],
        mountingType: 'PROFILE',
        mode: 'LINEAR',
        unitLength: 600,
      });

      // totalLength = 3005, wireLength = 3005 + 2000 = 5005
      expect(result.wireLength).toBe(result.totalLength + 2000);
    });

    it('wireLength always adds exactly 2000mm extra', () => {
      const result = calculateLights({
        edges: [{ length: 100 }],
        mountingType: 'DIRECT',
        mode: 'LINEAR',
        unitLength: 100,
      });

      // totalLength = 100, wireLength = 100 + 2000 = 2100
      expect(result.wireLength).toBe(2100);
    });
  });

  describe('DISCRETE mode quantity', () => {
    it('quantity = ceil(totalLength / unitLength)', () => {
      const result = calculateLights({
        edges: [{ length: 1000 }],
        mountingType: 'DIRECT',
        mode: 'DISCRETE',
        unitLength: 300,
      });

      // totalLength = 1000, quantity = ceil(1000/300) = 4
      expect(result.quantity).toBe(Math.ceil(1000 / 300));
      expect(result.quantity).toBe(4);
    });

    it('DISCRETE with PROFILE offset included in calculation', () => {
      const result = calculateLights({
        edges: [{ length: 1000 }, { length: 1000 }],
        mountingType: 'PROFILE',
        mode: 'DISCRETE',
        unitLength: 500,
      });

      // totalLength = (1000+5) + (1000+5) = 2010
      // quantity = ceil(2010/500) = 5
      expect(result.totalLength).toBe(2010);
      expect(result.quantity).toBe(Math.ceil(2010 / 500));
    });

    it('LINEAR mode quantity equals totalLength in mm', () => {
      const result = calculateLights({
        edges: [{ length: 2500 }],
        mountingType: 'COVE',
        mode: 'LINEAR',
        unitLength: 500,
      });

      // totalLength = 2500 + 10 = 2510
      // LINEAR: quantity = totalLength
      expect(result.quantity).toBe(result.totalLength);
      expect(result.quantity).toBe(2510);
    });
  });

  describe('Lighting in full pipeline', () => {
    it('pipeline produces LIGHT BOM lines with correct quantities', () => {
      const input = createStraightWallPipelineInput();
      // Override lighting with known values
      input.snapshotData.lighting = [
        {
          componentId: 'light-test',
          skuId: 'sku-led-test',
          edges: [{ length: 3000 }],
          mountingType: 'PROFILE',
          mode: 'LINEAR',
          unitLength: 600,
        },
      ];

      const output = runBomPipeline(input);

      expect(output.status).toBe('SUCCESS');
      const lightLine = output.actualBomLines.find(l => l.calculationRule === 'LIGHT');
      expect(lightLine).toBeDefined();
      // totalLength = 3000 + 5 = 3005, LINEAR quantity = 3005
      expect(lightLine!.quantity).toBe(3005);
      expect(lightLine!.unitOfMeasure).toBe('MM');
    });

    it('pipeline produces PCS unit for DISCRETE lighting', () => {
      const input = createStraightWallPipelineInput();
      input.snapshotData.lighting = [
        {
          componentId: 'light-spots',
          skuId: 'sku-led-spots',
          edges: [{ length: 1200 }],
          mountingType: 'DIRECT',
          mode: 'DISCRETE',
          unitLength: 300,
        },
      ];

      const output = runBomPipeline(input);

      expect(output.status).toBe('SUCCESS');
      const lightLine = output.actualBomLines.find(l => l.componentId === 'light-spots');
      expect(lightLine).toBeDefined();
      // totalLength = 1200, DISCRETE quantity = ceil(1200/300) = 4
      expect(lightLine!.quantity).toBe(4);
      expect(lightLine!.unitOfMeasure).toBe('PCS');
    });
  });
});
