/**
 * Integration Test Area 5: BOM Generation
 *
 * Validates that:
 * - Every physical zone in snapshot produces a WALL_PANEL BOM line
 * - Every lighting component produces a LIGHT BOM line
 * - Every furniture item (quantity > 0) produces a FURNITURE BOM line
 * - Hidden components with met trigger conditions produce HIDDEN_COMPONENT lines
 * - No orphan BOM lines (every lineId traces back to a snapshot component)
 * - Quantities reconcile: procurementQuantity = ceil(requiredQuantity * (1 + wasteFactor))
 */

import { describe, it, expect } from 'vitest';
import { runBomPipeline } from '@/engines/bomPipeline';
import { calculateWallPanels } from '@/engines/wallPanelEngine';
import {
  createStraightWallPipelineInput,
  createMultiZoneMultiSkuPipelineInput,
} from './helpers/fixtures';
import { assertBomConsistency } from './helpers/pipelineHelpers';

describe('Integration Area 5: BOM Generation', () => {
  describe('Every physical zone produces a WALL_PANEL BOM line', () => {
    it('2-zone straight wall produces 2 WALL_PANEL lines', () => {
      const input = createStraightWallPipelineInput();
      const output = runBomPipeline(input);

      expect(output.status).toBe('SUCCESS');
      const panelLines = output.actualBomLines.filter(l => l.calculationRule === 'WALL_PANEL');
      expect(panelLines).toHaveLength(2);
      expect(panelLines[0].componentId).toBe('zone-left');
      expect(panelLines[1].componentId).toBe('zone-right');
    });

    it('4-zone multi-SKU wall produces 4 WALL_PANEL lines', () => {
      const input = createMultiZoneMultiSkuPipelineInput();
      const output = runBomPipeline(input);

      expect(output.status).toBe('SUCCESS');
      const panelLines = output.actualBomLines.filter(l => l.calculationRule === 'WALL_PANEL');
      expect(panelLines).toHaveLength(4);
      expect(panelLines.map(l => l.componentId)).toEqual([
        'zone-1', 'zone-2', 'zone-3', 'zone-4',
      ]);
    });

    it('each WALL_PANEL line has correct skuId from the zone', () => {
      const input = createStraightWallPipelineInput();
      const output = runBomPipeline(input);

      const panelLines = output.actualBomLines.filter(l => l.calculationRule === 'WALL_PANEL');
      expect(panelLines[0].skuId).toBe('sku-panel-oak-001');
      expect(panelLines[1].skuId).toBe('sku-panel-oak-002');
    });
  });

  describe('Every lighting component produces a LIGHT BOM line', () => {
    it('single lighting component produces 1 LIGHT line', () => {
      const input = createStraightWallPipelineInput();
      const output = runBomPipeline(input);

      const lightLines = output.actualBomLines.filter(l => l.calculationRule === 'LIGHT');
      expect(lightLines).toHaveLength(1);
      expect(lightLines[0].componentId).toBe('light-profile-strip');
    });

    it('multiple lighting components each produce a LIGHT line', () => {
      const input = createMultiZoneMultiSkuPipelineInput();
      const output = runBomPipeline(input);

      const lightLines = output.actualBomLines.filter(l => l.calculationRule === 'LIGHT');
      expect(lightLines).toHaveLength(2);
      expect(lightLines.map(l => l.componentId).sort()).toEqual(
        ['light-cove-accent', 'light-profile-main'].sort(),
      );
    });
  });

  describe('Every furniture item (quantity > 0) produces a FURNITURE BOM line', () => {
    it('furniture with quantity > 0 produces a FURNITURE line', () => {
      const input = createStraightWallPipelineInput();
      const output = runBomPipeline(input);

      const furnLines = output.actualBomLines.filter(l => l.calculationRule === 'FURNITURE');
      expect(furnLines).toHaveLength(1);
      expect(furnLines[0].componentId).toBe('furn-shelf');
      expect(furnLines[0].quantity).toBe(2);
    });

    it('furniture with quantity = 0 is omitted from BOM', () => {
      const input = createStraightWallPipelineInput();
      input.snapshotData.furniture = [
        { componentId: 'furn-omitted', skuId: 'sku-omit', quantity: 0, min: 0, max: 5 },
      ];
      const output = runBomPipeline(input);

      const furnLines = output.actualBomLines.filter(l => l.calculationRule === 'FURNITURE');
      expect(furnLines).toHaveLength(0);
    });

    it('multiple furniture items each produce their own FURNITURE line', () => {
      const input = createMultiZoneMultiSkuPipelineInput();
      const output = runBomPipeline(input);

      const furnLines = output.actualBomLines.filter(l => l.calculationRule === 'FURNITURE');
      expect(furnLines).toHaveLength(2);
      expect(furnLines.find(l => l.componentId === 'furn-table')?.quantity).toBe(1);
      expect(furnLines.find(l => l.componentId === 'furn-lamp')?.quantity).toBe(3);
    });
  });

  describe('Hidden components with met trigger conditions produce HIDDEN_COMPONENT lines', () => {
    it('ALWAYS trigger produces a hidden component line', () => {
      const input = createStraightWallPipelineInput();
      const output = runBomPipeline(input);

      const hiddenLines = output.actualBomLines.filter(l => l.calculationRule === 'HIDDEN_COMPONENT');
      expect(hiddenLines).toHaveLength(1);
      expect(hiddenLines[0].componentId).toBe('hidden-bracket');
      expect(hiddenLines[0].quantity).toBe(4);
    });

    it('CONDITION trigger produces line when condition is met', () => {
      const input = createMultiZoneMultiSkuPipelineInput();
      const output = runBomPipeline(input);

      const hiddenLines = output.actualBomLines.filter(l => l.calculationRule === 'HIDDEN_COMPONENT');
      const clipLine = hiddenLines.find(l => l.componentId === 'hidden-clip');
      expect(clipLine).toBeDefined();
      expect(clipLine!.quantity).toBe(12);
    });

    it('DEPENDENCY trigger produces line when parent is present', () => {
      const input = createMultiZoneMultiSkuPipelineInput();
      const output = runBomPipeline(input);

      const hiddenLines = output.actualBomLines.filter(l => l.calculationRule === 'HIDDEN_COMPONENT');
      const adhesiveLine = hiddenLines.find(l => l.componentId === 'hidden-adhesive');
      expect(adhesiveLine).toBeDefined();
      expect(adhesiveLine!.quantity).toBe(8); // DERIVED_FROM_PARENT with parentQuantity=8
    });

    it('PER_ZONE rule multiplies fixedValue by zoneCount', () => {
      const input = createMultiZoneMultiSkuPipelineInput();
      const output = runBomPipeline(input);

      const hiddenLines = output.actualBomLines.filter(l => l.calculationRule === 'HIDDEN_COMPONENT');
      const railLine = hiddenLines.find(l => l.componentId === 'hidden-rail');
      expect(railLine).toBeDefined();
      expect(railLine!.quantity).toBe(8); // 2 * 4 zones
    });
  });

  describe('No orphan BOM lines', () => {
    it('every BOM line traces back to a snapshot component (straight wall)', () => {
      const input = createStraightWallPipelineInput();
      const output = runBomPipeline(input);

      expect(() => assertBomConsistency(output, input.snapshotData)).not.toThrow();
    });

    it('every BOM line traces back to a snapshot component (multi-zone)', () => {
      const input = createMultiZoneMultiSkuPipelineInput();
      const output = runBomPipeline(input);

      expect(() => assertBomConsistency(output, input.snapshotData)).not.toThrow();
    });
  });

  describe('Quantities reconcile', () => {
    it('procurementQuantity = ceil(requiredQuantity * (1 + wasteFactor))', () => {
      // Use the wall panel engine directly to verify
      const panelOutput = calculateWallPanels({
        W: 1500,
        H: 2400,
        w: 600,
        h: 1200,
        gh: 3,
        gv: 3,
        wasteFactor: 0.05,
      });

      const expectedProcurement = Math.ceil(
        panelOutput.requiredQuantity * (1 + 0.05),
      );
      expect(panelOutput.procurementQuantity).toBe(expectedProcurement);
      expect(panelOutput.wasteQuantity).toBe(
        panelOutput.procurementQuantity - panelOutput.requiredQuantity,
      );
    });

    it('pipeline BOM line quantities are correct for known inputs', () => {
      const input = createStraightWallPipelineInput();
      const output = runBomPipeline(input);

      const panelLines = output.actualBomLines.filter(l => l.calculationRule === 'WALL_PANEL');
      for (const line of panelLines) {
        expect(line.quantity).toBeGreaterThan(0);
        expect(line.requiredQuantity).toBeGreaterThan(0);
        expect(line.quantity).toBeGreaterThanOrEqual(line.requiredQuantity);
        expect(line.wasteQuantity).toBe(line.quantity - line.requiredQuantity);
      }
    });
  });
});
