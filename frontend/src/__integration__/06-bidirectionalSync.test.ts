/**
 * Integration Test Area 6: Bidirectional Synchronization
 *
 * Validates that:
 * - BOM output lines map 1:1 to snapshot zones+lighting+furniture+hidden
 * - Modifying snapshot data and re-running pipeline produces updated BOM with no stale references
 * - Running pipeline twice with identical input produces identical output (idempotency)
 */

import { describe, it, expect } from 'vitest';
import { runBomPipeline } from '@/engines/bomPipeline';
import type { BomPipelineInput } from '@/engines/bomPipeline';
import {
  createStraightWallPipelineInput,
  createMultiZoneMultiSkuPipelineInput,
} from './helpers/fixtures';
import { assertBomConsistency, assertNoStaleReferences } from './helpers/pipelineHelpers';

describe('Integration Area 6: Bidirectional Synchronization', () => {
  describe('BOM output lines map 1:1 to snapshot components', () => {
    it('straight wall: each zone, lighting, furniture, hidden has exactly one BOM line', () => {
      const input = createStraightWallPipelineInput();
      const output = runBomPipeline(input);

      expect(output.status).toBe('SUCCESS');

      // 2 zones + 1 lighting + 1 furniture + 1 hidden = 5 lines
      const expectedLineCount =
        input.snapshotData.zones.filter(z => z.panelWidth && z.panelHeight).length +
        (input.snapshotData.lighting?.length ?? 0) +
        (input.snapshotData.furniture?.filter(f => f.quantity > 0).length ?? 0) +
        (input.snapshotData.hiddenComponents?.filter(h => h.triggerType === 'ALWAYS').length ?? 0);

      expect(output.actualBomLines.length).toBe(expectedLineCount);
    });

    it('multi-zone: BOM and snapshot are consistent', () => {
      const input = createMultiZoneMultiSkuPipelineInput();
      const output = runBomPipeline(input);

      expect(output.status).toBe('SUCCESS');
      expect(() => assertBomConsistency(output, input.snapshotData)).not.toThrow();
    });
  });

  describe('Modifying snapshot produces updated BOM with no stale references', () => {
    it('adding a zone produces an additional BOM line', () => {
      const input = createStraightWallPipelineInput();
      const output1 = runBomPipeline(input);
      const initialPanelCount = output1.actualBomLines.filter(
        l => l.calculationRule === 'WALL_PANEL',
      ).length;

      // Add a third zone (shrink existing zones to make room)
      const modifiedInput: BomPipelineInput = {
        ...input,
        snapshotData: {
          ...input.snapshotData,
          zones: [
            { ...input.snapshotData.zones[0], width: 1000 },
            { ...input.snapshotData.zones[1], x: 1000, width: 1000 },
            {
              zoneId: 'zone-new',
              x: 2000,
              y: 0,
              width: 1000,
              height: 2400,
              skuId: 'sku-panel-new',
              panelWidth: 500,
              panelHeight: 1200,
              gapHorizontal: 3,
              gapVertical: 3,
              wasteFactor: 0.05,
            },
          ],
        },
      };

      const output2 = runBomPipeline(modifiedInput);

      expect(output2.status).toBe('SUCCESS');
      const updatedPanelCount = output2.actualBomLines.filter(
        l => l.calculationRule === 'WALL_PANEL',
      ).length;
      expect(updatedPanelCount).toBe(initialPanelCount + 1);
      expect(() => assertNoStaleReferences(output2, modifiedInput.snapshotData)).not.toThrow();
    });

    it('removing a zone removes its BOM line with no stale references', () => {
      const input = createStraightWallPipelineInput();
      const output1 = runBomPipeline(input);
      expect(output1.actualBomLines.some(l => l.componentId === 'zone-right')).toBe(true);

      // Remove zone-right, expand zone-left to fill wall
      const modifiedInput: BomPipelineInput = {
        ...input,
        snapshotData: {
          ...input.snapshotData,
          zones: [
            { ...input.snapshotData.zones[0], width: 3000 },
          ],
        },
      };

      const output2 = runBomPipeline(modifiedInput);

      expect(output2.status).toBe('SUCCESS');
      expect(output2.actualBomLines.some(l => l.componentId === 'zone-right')).toBe(false);
      expect(() => assertNoStaleReferences(output2, modifiedInput.snapshotData)).not.toThrow();
    });

    it('removing lighting removes its BOM line', () => {
      const input = createStraightWallPipelineInput();
      const output1 = runBomPipeline(input);
      expect(output1.actualBomLines.some(l => l.calculationRule === 'LIGHT')).toBe(true);

      const modifiedInput: BomPipelineInput = {
        ...input,
        snapshotData: {
          ...input.snapshotData,
          lighting: [],
        },
      };

      const output2 = runBomPipeline(modifiedInput);

      expect(output2.status).toBe('SUCCESS');
      expect(output2.actualBomLines.some(l => l.calculationRule === 'LIGHT')).toBe(false);
    });
  });

  describe('Idempotency', () => {
    it('running pipeline twice with identical input produces identical output', () => {
      const input = createStraightWallPipelineInput();

      const output1 = runBomPipeline(input);
      const output2 = runBomPipeline(input);

      expect(output1.status).toBe(output2.status);
      expect(output1.actualBomLines).toEqual(output2.actualBomLines);
      expect(output1.errors).toEqual(output2.errors);
      expect(output1.warnings).toEqual(output2.warnings);
    });

    it('multi-zone pipeline is idempotent', () => {
      const input = createMultiZoneMultiSkuPipelineInput();

      const output1 = runBomPipeline(input);
      const output2 = runBomPipeline(input);

      expect(output1).toEqual(output2);
    });

    it('running pipeline 10 times yields consistent results', () => {
      const input = createStraightWallPipelineInput();
      const baseline = runBomPipeline(input);

      for (let i = 0; i < 10; i++) {
        const output = runBomPipeline(input);
        expect(output).toEqual(baseline);
      }
    });
  });
});
