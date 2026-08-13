import { describe, it, expect } from 'vitest';
import { runBomPipeline } from '../bomPipeline';
import type { BomPipelineInput, SnapshotPanelFrame } from '../bomPipeline';

/**
 * Tests for BOM pipeline integration with wall configuration panel frames.
 * Validates that:
 * - Panel frames are used as W/H inputs for quantity calculation
 * - panel_gap_mm (structural frame gap) is NOT confused with SKU gh_mm/gv_mm (joint gaps)
 * - Multiple frames produce separate BOM lines
 */

function makeBasePipelineInput(overrides: Partial<BomPipelineInput> = {}): BomPipelineInput {
  return {
    snapshotData: {
      zones: [],
      lighting: [],
      furniture: [],
      hiddenComponents: [],
      generatedPanelFrames: [],
    },
    measurements: {
      wallWidth: 3000,
      wallHeight: 2400,
      templateWallWidth: 3000,
    },
    configuration: {},
    ruleSet: {},
    permissions: [],
    compatibilityRules: [],
    ...overrides,
  };
}

describe('BOM Pipeline - Wall Config Integration', () => {
  describe('panel frames as zone dimensions', () => {
    it('uses generated panel frame width and height as W and H for calculation', () => {
      const frames: SnapshotPanelFrame[] = [
        {
          frameId: 'frame-1',
          rowIndex: 0,
          colIndex: 0,
          x: 0,
          y: 0,
          width: 1000,
          height: 2400,
          segment: null,
          isEdgePanel: true,
          skuId: 'sku-panel-1',
          panelWidth: 600,
          panelHeight: 600,
          gapHorizontal: 2,
          gapVertical: 2,
          wasteFactor: 0.05,
        },
      ];

      const input = makeBasePipelineInput({
        snapshotData: {
          zones: [],
          generatedPanelFrames: frames,
        },
      });

      const result = runBomPipeline(input);

      expect(result.status).toBe('SUCCESS');
      expect(result.actualBomLines.length).toBeGreaterThan(0);

      const panelLine = result.actualBomLines.find(
        (l) => l.componentId === 'frame-1',
      );
      expect(panelLine).toBeDefined();
      expect(panelLine!.skuId).toBe('sku-panel-1');
      expect(panelLine!.calculationRule).toBe('WALL_PANEL');
      // W=1000, H=2400, w=600, h=600, gh=2, gv=2
      // Width: smallest N where N*600 + (N-1)*2 >= 1000 -> N=2 (1202 >= 1000)
      // Height: smallest N where N*600 + (N-1)*2 >= 2400 -> N=4 (2406 >= 2400)
      // required = 2 * 4 = 8
      // procurement = ceil(8 * 1.05) = 9
      expect(panelLine!.requiredQuantity).toBe(8);
      expect(panelLine!.quantity).toBe(9);
    });

    it('produces separate BOM lines for each panel frame', () => {
      const frames: SnapshotPanelFrame[] = [
        {
          frameId: 'frame-a',
          rowIndex: 0,
          colIndex: 0,
          x: 0,
          y: 0,
          width: 1000,
          height: 2400,
          segment: null,
          isEdgePanel: true,
          skuId: 'sku-1',
          panelWidth: 500,
          panelHeight: 500,
          gapHorizontal: 0,
          gapVertical: 0,
          wasteFactor: 0,
        },
        {
          frameId: 'frame-b',
          rowIndex: 0,
          colIndex: 1,
          x: 1000,
          y: 0,
          width: 2000,
          height: 2400,
          segment: null,
          isEdgePanel: true,
          skuId: 'sku-1',
          panelWidth: 500,
          panelHeight: 500,
          gapHorizontal: 0,
          gapVertical: 0,
          wasteFactor: 0,
        },
      ];

      const input = makeBasePipelineInput({
        snapshotData: {
          zones: [],
          generatedPanelFrames: frames,
        },
      });

      const result = runBomPipeline(input);

      expect(result.status).toBe('SUCCESS');
      // Should have separate lines for each frame (different componentId)
      const lineA = result.actualBomLines.find((l) => l.componentId === 'frame-a');
      const lineB = result.actualBomLines.find((l) => l.componentId === 'frame-b');
      expect(lineA).toBeDefined();
      expect(lineB).toBeDefined();
      // frame-a: W=1000, H=2400, w=500, h=500, gh=0, gv=0
      // Width: smallest N where N*500 >= 1000 -> N=2
      // Height: smallest N where N*500 >= 2400 -> N=5 (2500 >= 2400)
      // required = 2*5 = 10
      expect(lineA!.requiredQuantity).toBe(10);
      // frame-b: W=2000, H=2400, w=500, h=500, gh=0, gv=0
      // Width: N=4, Height: N=5
      // required = 4*5 = 20
      expect(lineB!.requiredQuantity).toBe(20);
    });

    it('panel frames take priority over zone dimensions when both present', () => {
      const frames: SnapshotPanelFrame[] = [
        {
          frameId: 'frame-priority',
          rowIndex: 0,
          colIndex: 0,
          x: 0,
          y: 0,
          width: 800,
          height: 800,
          segment: null,
          isEdgePanel: false,
          skuId: 'sku-p',
          panelWidth: 400,
          panelHeight: 400,
          gapHorizontal: 0,
          gapVertical: 0,
          wasteFactor: 0,
        },
      ];

      const input = makeBasePipelineInput({
        snapshotData: {
          zones: [
            {
              zoneId: 'zone-legacy',
              x: 0,
              y: 0,
              width: 3000,
              height: 2400,
              skuId: 'sku-legacy',
              panelWidth: 600,
              panelHeight: 600,
              gapHorizontal: 0,
              gapVertical: 0,
              wasteFactor: 0,
            },
          ],
          generatedPanelFrames: frames,
        },
      });

      const result = runBomPipeline(input);
      expect(result.status).toBe('SUCCESS');
      // Only frame-based line should exist, not zone-based
      const frameLine = result.actualBomLines.find(
        (l) => l.componentId === 'frame-priority',
      );
      const zoneLine = result.actualBomLines.find(
        (l) => l.componentId === 'zone-legacy',
      );
      expect(frameLine).toBeDefined();
      expect(zoneLine).toBeUndefined();
    });

    it('falls back to zone dimensions when no panel frames present', () => {
      const input = makeBasePipelineInput({
        snapshotData: {
          zones: [
            {
              zoneId: 'zone-1',
              x: 0,
              y: 0,
              width: 1200,
              height: 2400,
              skuId: 'sku-fallback',
              panelWidth: 600,
              panelHeight: 600,
              gapHorizontal: 0,
              gapVertical: 0,
              wasteFactor: 0,
            },
          ],
          generatedPanelFrames: undefined,
        },
      });

      const result = runBomPipeline(input);
      expect(result.status).toBe('SUCCESS');
      const line = result.actualBomLines.find((l) => l.componentId === 'zone-1');
      expect(line).toBeDefined();
      // W=1200, H=2400, w=600, h=600 -> Ncol=2, Nrow=4 -> required=8
      expect(line!.requiredQuantity).toBe(8);
    });
  });

  describe('Rule 63: panel_gap_mm vs SKU gaps', () => {
    it('frame gapHorizontal/gapVertical are SKU joint gaps (gh_mm/gv_mm), not panel_gap_mm', () => {
      // panel_gap_mm is the structural spacing between frames (handled by wallConfigEngine).
      // The BOM pipeline uses frame.gapHorizontal/gapVertical which are the SKU joint gaps.
      // These are independent concepts per Rule 63.
      const frames: SnapshotPanelFrame[] = [
        {
          frameId: 'frame-gap-test',
          rowIndex: 0,
          colIndex: 0,
          x: 0,
          y: 0,
          width: 1000,
          height: 1000,
          segment: null,
          isEdgePanel: false,
          skuId: 'sku-gap',
          panelWidth: 300,
          panelHeight: 300,
          gapHorizontal: 5, // SKU gh_mm joint gap
          gapVertical: 5, // SKU gv_mm joint gap
          wasteFactor: 0,
        },
      ];

      const input = makeBasePipelineInput({
        snapshotData: {
          zones: [],
          generatedPanelFrames: frames,
        },
      });

      const result = runBomPipeline(input);
      expect(result.status).toBe('SUCCESS');

      const line = result.actualBomLines.find(
        (l) => l.componentId === 'frame-gap-test',
      );
      expect(line).toBeDefined();
      // W=1000, H=1000, w=300, h=300, gh=5, gv=5
      // Width: smallest N where N*300 + (N-1)*5 >= 1000 -> N=4 (1200+15=1215 >= 1000)
      // Height: same -> N=4
      // required = 4*4 = 16
      expect(line!.requiredQuantity).toBe(16);
    });

    it('zero SKU gaps produce correct count independent of frame structural gap', () => {
      // Even though the wallConfigEngine placed this frame with panel_gap_mm=10 between frames,
      // the BOM calculation uses only the SKU gaps (0 here) for panel cutting within the frame.
      const frames: SnapshotPanelFrame[] = [
        {
          frameId: 'frame-zero-gap',
          rowIndex: 0,
          colIndex: 0,
          x: 0,   // This position includes the structural gap offset
          y: 0,
          width: 990,  // Frame width (already accounts for structural gap in layout)
          height: 2400,
          segment: null,
          isEdgePanel: true,
          skuId: 'sku-zero',
          panelWidth: 330,
          panelHeight: 600,
          gapHorizontal: 0, // Zero SKU joint gap
          gapVertical: 0,
          wasteFactor: 0,
        },
      ];

      const input = makeBasePipelineInput({
        snapshotData: {
          zones: [],
          generatedPanelFrames: frames,
        },
      });

      const result = runBomPipeline(input);
      expect(result.status).toBe('SUCCESS');

      const line = result.actualBomLines.find(
        (l) => l.componentId === 'frame-zero-gap',
      );
      expect(line).toBeDefined();
      // W=990, H=2400, w=330, h=600, gh=0, gv=0
      // Width: smallest N where N*330 >= 990 -> N=3 (990 >= 990)
      // Height: smallest N where N*600 >= 2400 -> N=4 (2400 >= 2400)
      // required = 3 * 4 = 12
      expect(line!.requiredQuantity).toBe(12);
    });
  });

  describe('frames without SKU data', () => {
    it('skips frames that have no panelWidth or panelHeight', () => {
      const frames: SnapshotPanelFrame[] = [
        {
          frameId: 'frame-no-sku',
          rowIndex: 0,
          colIndex: 0,
          x: 0,
          y: 0,
          width: 1000,
          height: 2400,
          segment: null,
          isEdgePanel: true,
          // No panelWidth/panelHeight - no SKU assigned
        },
      ];

      const input = makeBasePipelineInput({
        snapshotData: {
          zones: [],
          generatedPanelFrames: frames,
        },
      });

      const result = runBomPipeline(input);
      expect(result.status).toBe('SUCCESS');
      expect(result.actualBomLines.length).toBe(0);
    });
  });
});
