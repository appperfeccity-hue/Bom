/**
 * Integration Test Area 10: End-to-End Scenarios
 *
 * Validates complete production chain scenarios:
 * - Straight wall E2E
 * - L-corner E2E
 * - Multi-zone multi-SKU E2E
 * - Consultant mode E2E
 * - Finalisation E2E
 *
 * Critical invariant tested:
 * > Canvas state, rule-engine state, BOM state and persisted snapshot must describe the same physical wall.
 */

import { describe, it, expect } from 'vitest';
import { runBomPipeline } from '@/engines/bomPipeline';
import { assignSegment } from '@/canvas/utils/segmentAssignment';
import { calculateWallPanels } from '@/engines/wallPanelEngine';
import { ErrorCode } from '@/engines/errorCatalogue';
import {
  createStraightWallPipelineInput,
  createLCornerPipelineInput,
  createMultiZoneMultiSkuPipelineInput,
  createConsultantModeInput,
  createFinalisationInput,
} from './helpers/fixtures';
import { assertBomConsistency, assertNoStaleReferences } from './helpers/pipelineHelpers';

describe('Integration Area 10: End-to-End Scenarios', () => {
  describe('Straight wall E2E', () => {
    it('complete pipeline: snapshot -> validation -> BOM with correct line count and quantities', () => {
      const input = createStraightWallPipelineInput();
      const output = runBomPipeline(input);

      // Status is SUCCESS
      expect(output.status).toBe('SUCCESS');
      expect(output.errors).toHaveLength(0);

      // BOM lines: 2 panels + 1 light + 1 furniture + 1 hidden = 5
      expect(output.actualBomLines).toHaveLength(5);

      // Panel lines have positive quantities
      const panelLines = output.actualBomLines.filter(l => l.calculationRule === 'WALL_PANEL');
      expect(panelLines).toHaveLength(2);
      for (const line of panelLines) {
        expect(line.quantity).toBeGreaterThan(0);
        expect(line.requiredQuantity).toBeGreaterThan(0);
        expect(line.quantity).toBeGreaterThanOrEqual(line.requiredQuantity);
      }

      // Light line exists with correct calculation
      const lightLine = output.actualBomLines.find(l => l.calculationRule === 'LIGHT');
      expect(lightLine).toBeDefined();
      expect(lightLine!.quantity).toBe(3005); // 3000 + 5mm PROFILE offset

      // Furniture line
      const furnLine = output.actualBomLines.find(l => l.calculationRule === 'FURNITURE');
      expect(furnLine).toBeDefined();
      expect(furnLine!.quantity).toBe(2);

      // Hidden component line
      const hiddenLine = output.actualBomLines.find(l => l.calculationRule === 'HIDDEN_COMPONENT');
      expect(hiddenLine).toBeDefined();
      expect(hiddenLine!.quantity).toBe(4);
    });

    it('BOM is consistent with canvas snapshot (critical invariant)', () => {
      const input = createStraightWallPipelineInput();
      const output = runBomPipeline(input);

      expect(output.status).toBe('SUCCESS');
      expect(() => assertBomConsistency(output, input.snapshotData)).not.toThrow();
      expect(() => assertNoStaleReferences(output, input.snapshotData)).not.toThrow();
    });

    it('panel quantities match direct engine calculation', () => {
      const input = createStraightWallPipelineInput();
      const output = runBomPipeline(input);

      // Verify zone-left panels match direct calculation
      const directCalc = calculateWallPanels({
        W: 1500,
        H: 2400,
        w: 600,
        h: 1200,
        gh: 3,
        gv: 3,
        wasteFactor: 0.05,
      });

      const pipelineLine = output.actualBomLines.find(
        l => l.componentId === 'zone-left' && l.calculationRule === 'WALL_PANEL',
      );
      expect(pipelineLine!.quantity).toBe(directCalc.procurementQuantity);
      expect(pipelineLine!.requiredQuantity).toBe(directCalc.requiredQuantity);
      expect(pipelineLine!.wasteQuantity).toBe(directCalc.wasteQuantity);
    });
  });

  describe('L-corner E2E', () => {
    it('L-corner zones are validated per-segment and pipeline succeeds', () => {
      const input = createLCornerPipelineInput();
      const output = runBomPipeline(input);

      expect(output.status).toBe('SUCCESS');
      expect(output.errors).toHaveLength(0);

      // 3 panel lines + 2 light lines + 1 furniture = 6 lines
      expect(output.actualBomLines).toHaveLength(6);
    });

    it('segments are correctly assigned for L-corner zones', () => {
      const cornerAt = { x: 2000, y: 0 };

      // Zone in segment A (x=0, width=1000, rightEdge=1000 < 2000)
      const segA = assignSegment(
        { x_mm: 0, y_mm: 0, width_mm: 1000, height_mm: 2400 },
        cornerAt,
        'L_CORNER',
      );
      expect(segA).toBe('SEGMENT_A');

      // Zone in segment B (x=2000, width=1500, leftEdge=2000 >= 2000)
      const segB = assignSegment(
        { x_mm: 2000, y_mm: 0, width_mm: 1500, height_mm: 2400 },
        cornerAt,
        'L_CORNER',
      );
      expect(segB).toBe('SEGMENT_B');
    });

    it('BOM is consistent with L-corner snapshot', () => {
      const input = createLCornerPipelineInput();
      const output = runBomPipeline(input);

      expect(() => assertBomConsistency(output, input.snapshotData)).not.toThrow();
    });

    it('L-corner lighting calculations include correct offsets', () => {
      const input = createLCornerPipelineInput();
      const output = runBomPipeline(input);

      // COVE light: edge 2000mm + 10mm offset = 2010mm (LINEAR)
      const coveLine = output.actualBomLines.find(l => l.componentId === 'light-cove-a');
      expect(coveLine).toBeDefined();
      expect(coveLine!.quantity).toBe(2010); // 2000 + 10

      // DIRECT light: edge 1500mm + 0mm offset = 1500mm, DISCRETE: ceil(1500/300) = 5
      const directLine = output.actualBomLines.find(l => l.componentId === 'light-direct-b');
      expect(directLine).toBeDefined();
      expect(directLine!.quantity).toBe(5);
    });
  });

  describe('Multi-zone multi-SKU E2E', () => {
    it('4 zones with different SKUs and mixed lighting produces correct BOM', () => {
      const input = createMultiZoneMultiSkuPipelineInput();
      const output = runBomPipeline(input);

      expect(output.status).toBe('SUCCESS');
      expect(output.errors).toHaveLength(0);

      // 4 panels + 2 lights + 2 furniture + 3 hidden = 11 lines
      const panelLines = output.actualBomLines.filter(l => l.calculationRule === 'WALL_PANEL');
      const lightLines = output.actualBomLines.filter(l => l.calculationRule === 'LIGHT');
      const furnLines = output.actualBomLines.filter(l => l.calculationRule === 'FURNITURE');
      const hiddenLines = output.actualBomLines.filter(l => l.calculationRule === 'HIDDEN_COMPONENT');

      expect(panelLines).toHaveLength(4);
      expect(lightLines).toHaveLength(2);
      expect(furnLines).toHaveLength(2);
      expect(hiddenLines).toHaveLength(3);
    });

    it('each zone has unique SKU reflected in BOM', () => {
      const input = createMultiZoneMultiSkuPipelineInput();
      const output = runBomPipeline(input);

      const panelLines = output.actualBomLines.filter(l => l.calculationRule === 'WALL_PANEL');
      const skuIds = panelLines.map(l => l.skuId);

      expect(skuIds).toContain('sku-panel-marble-001');
      expect(skuIds).toContain('sku-panel-wood-001');
      expect(skuIds).toContain('sku-panel-glass-001');
      expect(skuIds).toContain('sku-panel-ceramic-001');
    });

    it('mixed PROFILE and COVE lighting offsets correctly applied', () => {
      const input = createMultiZoneMultiSkuPipelineInput();
      const output = runBomPipeline(input);

      // PROFILE: single edge 3000mm -> totalLength = 3000+5 = 3005
      const profileLine = output.actualBomLines.find(l => l.componentId === 'light-profile-main');
      expect(profileLine!.quantity).toBe(3005);

      // COVE: two edges 1500mm each -> totalLength = (1500+10) + (1500+10) = 3020
      const coveLine = output.actualBomLines.find(l => l.componentId === 'light-cove-accent');
      expect(coveLine!.quantity).toBe(3020);
    });

    it('BOM consistency check passes for multi-zone scenario', () => {
      const input = createMultiZoneMultiSkuPipelineInput();
      const output = runBomPipeline(input);

      expect(() => assertBomConsistency(output, input.snapshotData)).not.toThrow();
      expect(() => assertNoStaleReferences(output, input.snapshotData)).not.toThrow();
    });
  });

  describe('Consultant mode E2E', () => {
    it('consultant actions within bounds produces SUCCESS', () => {
      const input = createConsultantModeInput();
      const output = runBomPipeline(input);

      expect(output.status).toBe('SUCCESS');
      expect(output.errors).toHaveLength(0);
      expect(output.actualBomLines.length).toBeGreaterThan(0);
    });

    it('consultant actions violating bounds produces BLOCKED', () => {
      const input = createConsultantModeInput();
      // Add an action that violates the locked sku_selection parameter
      input.configuration.consultantActions = [
        ...(input.configuration.consultantActions ?? []),
        { parameter: 'sku_selection', value: 'sku-unauthorized', actionType: 'SELECT_SKU' },
      ];

      const output = runBomPipeline(input);

      expect(output.status).toBe('BLOCKED');
      expect(output.errors[0].code).toBe(ErrorCode.PERM_LOCKED_PARAMETER);
    });

    it('consultant value below min range blocks pipeline', () => {
      const input = createConsultantModeInput();
      input.configuration.consultantActions = [
        { parameter: 'zone_width', value: 100, actionType: 'SET_VALUE' }, // min is 500
      ];

      const output = runBomPipeline(input);

      expect(output.status).toBe('BLOCKED');
      expect(output.errors[0].code).toBe(ErrorCode.PERM_VALUE_OUT_OF_RANGE);
    });

    it('consultant value above max range blocks pipeline', () => {
      const input = createConsultantModeInput();
      input.configuration.consultantActions = [
        { parameter: 'zone_height', value: 5000, actionType: 'SET_VALUE' }, // max is 2700
      ];

      const output = runBomPipeline(input);

      expect(output.status).toBe('BLOCKED');
      expect(output.errors[0].code).toBe(ErrorCode.PERM_VALUE_OUT_OF_RANGE);
    });
  });

  describe('Finalisation E2E', () => {
    it('full pipeline produces valid output suitable for final BOM', () => {
      const input = createFinalisationInput();
      const output = runBomPipeline(input);

      expect(output.status).toBe('SUCCESS');
      expect(output.errors).toHaveLength(0);

      // All BOM lines have quantity > 0
      for (const line of output.actualBomLines) {
        expect(line.quantity).toBeGreaterThan(0);
      }

      // No orphans - every line traces to snapshot
      expect(() => assertBomConsistency(output, input.snapshotData)).not.toThrow();
    });

    it('finalisation output is reproducible (deterministic hash basis)', () => {
      const input = createFinalisationInput();

      const output1 = runBomPipeline(input);
      const output2 = runBomPipeline(input);

      expect(output1.status).toBe('SUCCESS');
      expect(output2.status).toBe('SUCCESS');

      // Exact same BOM lines
      expect(output1.actualBomLines).toEqual(output2.actualBomLines);

      // Can be serialized to produce deterministic representation
      const json1 = JSON.stringify(output1.actualBomLines);
      const json2 = JSON.stringify(output2.actualBomLines);
      expect(json1).toBe(json2);
    });

    it('finalisation BOM has all required fields populated', () => {
      const input = createFinalisationInput();
      const output = runBomPipeline(input);

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

    it('finalisation output covers all physical components from snapshot', () => {
      const input = createFinalisationInput();
      const output = runBomPipeline(input);
      const snapshot = input.snapshotData;

      // Zones with panels are in BOM
      const panelComponentIds = output.actualBomLines
        .filter(l => l.calculationRule === 'WALL_PANEL')
        .map(l => l.componentId);
      for (const zone of snapshot.zones) {
        if (zone.panelWidth && zone.panelHeight) {
          expect(panelComponentIds).toContain(zone.zoneId);
        }
      }

      // Lighting is in BOM
      if (snapshot.lighting) {
        const lightComponentIds = output.actualBomLines
          .filter(l => l.calculationRule === 'LIGHT')
          .map(l => l.componentId);
        for (const light of snapshot.lighting) {
          expect(lightComponentIds).toContain(light.componentId);
        }
      }

      // Furniture (qty > 0) is in BOM
      if (snapshot.furniture) {
        const furnComponentIds = output.actualBomLines
          .filter(l => l.calculationRule === 'FURNITURE')
          .map(l => l.componentId);
        for (const item of snapshot.furniture) {
          if (item.quantity > 0) {
            expect(furnComponentIds).toContain(item.componentId);
          }
        }
      }
    });

    it('critical invariant: Canvas state, rule-engine state, BOM state describe the same wall', () => {
      const input = createFinalisationInput();
      const output = runBomPipeline(input);

      // The snapshot describes 2 zones at [0,1500) and [1500,3000) in a 3000mm wall
      const snapshot = input.snapshotData;
      const totalZoneWidth = snapshot.zones.reduce((sum, z) => sum + z.width, 0);
      expect(totalZoneWidth).toBe(input.measurements.wallWidth);

      // BOM lines match the snapshot components
      expect(() => assertBomConsistency(output, snapshot)).not.toThrow();

      // BOM is reproducible (rule-engine is deterministic)
      const output2 = runBomPipeline(input);
      expect(output.actualBomLines).toEqual(output2.actualBomLines);
    });
  });
});
