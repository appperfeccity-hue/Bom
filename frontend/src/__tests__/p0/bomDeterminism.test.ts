/**
 * P0 Test Suite: BOM Determinism
 *
 * Verifies that runBomPipeline is a pure function: same input always produces
 * identical output, regardless of call count or timing. This is a critical
 * release-blocking property that ensures BOM generation is reproducible.
 */
import { describe, it, expect } from 'vitest';
import { runBomPipeline } from '@/engines/bomPipeline';
import type { BomPipelineInput } from '@/engines/bomPipeline';

/**
 * Creates a fixed multi-zone BomPipelineInput with lighting, furniture,
 * and hidden components. This input exercises all quantity calculation paths.
 */
function createDeterminismInput(overrides?: Partial<BomPipelineInput>): BomPipelineInput {
  return {
    snapshotData: {
      zones: [
        {
          zoneId: 'zone-a',
          x: 0,
          y: 0,
          width: 1200,
          height: 900,
          skuId: 'sku-panel-oak',
          panelWidth: 300,
          panelHeight: 450,
          gapHorizontal: 5,
          gapVertical: 5,
          wasteFactor: 0.05,
        },
        {
          zoneId: 'zone-b',
          x: 1200,
          y: 0,
          width: 800,
          height: 900,
          skuId: 'sku-panel-walnut',
          panelWidth: 200,
          panelHeight: 300,
          gapHorizontal: 3,
          gapVertical: 3,
          wasteFactor: 0.08,
        },
        {
          zoneId: 'zone-c',
          x: 2000,
          y: 0,
          width: 600,
          height: 900,
          skuId: 'sku-panel-maple',
          panelWidth: 150,
          panelHeight: 225,
          gapHorizontal: 4,
          gapVertical: 4,
          wasteFactor: 0.03,
        },
      ],
      lighting: [
        {
          componentId: 'light-top',
          skuId: 'sku-led-strip-warm',
          edges: [{ length: 2600 }, { length: 900 }],
          mountingType: 'DIRECT',
          mode: 'LINEAR',
          unitLength: 600,
        },
        {
          componentId: 'light-bottom',
          skuId: 'sku-led-spot-cool',
          edges: [{ length: 1200 }],
          mountingType: 'PROFILE',
          mode: 'DISCRETE',
          unitLength: 300,
        },
      ],
      furniture: [
        {
          componentId: 'shelf-unit-1',
          skuId: 'sku-shelf-floating',
          quantity: 3,
          min: 1,
          max: 8,
        },
        {
          componentId: 'hook-set-1',
          skuId: 'sku-hook-brass',
          quantity: 6,
          min: 2,
          max: 12,
        },
      ],
      hiddenComponents: [
        {
          componentId: 'bracket-kit',
          skuId: 'sku-bracket-steel',
          triggerType: 'ALWAYS',
          quantityRule: 'FIXED',
          fixedValue: 8,
        },
        {
          componentId: 'adhesive-tube',
          skuId: 'sku-adhesive-epoxy',
          triggerType: 'ALWAYS',
          quantityRule: 'FIXED',
          fixedValue: 2,
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

/**
 * Compute SHA-256 hash of a string using Web Crypto API.
 */
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('P0: BOM Determinism', () => {
  describe('repeated execution produces identical output', () => {
    it('should produce identical output across 10 consecutive runs', () => {
      const input = createDeterminismInput();
      const outputs = Array.from({ length: 10 }, () => runBomPipeline(input));

      // All outputs must be deeply equal to the first
      const reference = outputs[0];
      for (let i = 1; i < outputs.length; i++) {
        expect(outputs[i]).toEqual(reference);
      }
    });

    it('should maintain stable line ordering across runs (lineId sorted consistently)', () => {
      const input = createDeterminismInput();
      const outputs = Array.from({ length: 10 }, () => runBomPipeline(input));

      const referenceLineIds = outputs[0].actualBomLines.map((l) => l.lineId);
      for (let i = 1; i < outputs.length; i++) {
        const currentLineIds = outputs[i].actualBomLines.map((l) => l.lineId);
        expect(currentLineIds).toEqual(referenceLineIds);
      }
    });

    it('should produce quantities that match to full floating-point precision', () => {
      const input = createDeterminismInput();
      const outputs = Array.from({ length: 10 }, () => runBomPipeline(input));

      const referenceQuantities = outputs[0].actualBomLines.map((l) => l.quantity);
      for (let i = 1; i < outputs.length; i++) {
        const currentQuantities = outputs[i].actualBomLines.map((l) => l.quantity);
        // Use strict equality for floating-point determinism, not approximate equality
        expect(currentQuantities).toEqual(referenceQuantities);
      }
    });

    it('should produce identical SHA-256 hash of actualBomLines across runs', async () => {
      const input = createDeterminismInput();
      const outputs = Array.from({ length: 10 }, () => runBomPipeline(input));

      const hashes = await Promise.all(
        outputs.map((output) =>
          sha256(JSON.stringify(output.actualBomLines))
        )
      );

      const referenceHash = hashes[0];
      expect(referenceHash).toBeTruthy();
      for (let i = 1; i < hashes.length; i++) {
        expect(hashes[i]).toBe(referenceHash);
      }
    });
  });

  describe('sensitivity to input changes', () => {
    it('should produce different output when zone width changes by 1mm', () => {
      const input1 = createDeterminismInput();
      const input2 = createDeterminismInput({
        snapshotData: {
          ...createDeterminismInput().snapshotData,
          zones: [
            {
              zoneId: 'zone-a',
              x: 0,
              y: 0,
              width: 1201, // 1mm wider
              height: 900,
              skuId: 'sku-panel-oak',
              panelWidth: 300,
              panelHeight: 450,
              gapHorizontal: 5,
              gapVertical: 5,
              wasteFactor: 0.05,
            },
            ...createDeterminismInput().snapshotData.zones.slice(1),
          ],
        },
      });

      const output1 = runBomPipeline(input1);
      const output2 = runBomPipeline(input2);

      // Outputs should differ - at minimum the panel quantity for zone-a changes
      expect(JSON.stringify(output1.actualBomLines)).not.toBe(
        JSON.stringify(output2.actualBomLines)
      );
    });

    it('should produce consistent output even with the changed input (determinism still holds)', () => {
      const input = createDeterminismInput({
        snapshotData: {
          ...createDeterminismInput().snapshotData,
          zones: [
            {
              zoneId: 'zone-a',
              x: 0,
              y: 0,
              width: 1201,
              height: 900,
              skuId: 'sku-panel-oak',
              panelWidth: 300,
              panelHeight: 450,
              gapHorizontal: 5,
              gapVertical: 5,
              wasteFactor: 0.05,
            },
            ...createDeterminismInput().snapshotData.zones.slice(1),
          ],
        },
      });

      const outputs = Array.from({ length: 5 }, () => runBomPipeline(input));
      for (let i = 1; i < outputs.length; i++) {
        expect(outputs[i]).toEqual(outputs[0]);
      }
    });
  });

  describe('generatedPanelFrames path determinism', () => {
    it('should produce deterministic output when using generatedPanelFrames', () => {
      const input = createDeterminismInput({
        snapshotData: {
          zones: [
            {
              zoneId: 'zone-frame',
              x: 0,
              y: 0,
              width: 2400,
              height: 1200,
              skuId: 'sku-frame-panel',
            },
          ],
          generatedPanelFrames: [
            {
              frameId: 'frame-1',
              rowIndex: 0,
              colIndex: 0,
              x: 0,
              y: 0,
              width: 600,
              height: 600,
              segment: null,
              isEdgePanel: true,
              skuId: 'sku-frame-panel',
              panelWidth: 300,
              panelHeight: 300,
              gapHorizontal: 2,
              gapVertical: 2,
              wasteFactor: 0.05,
            },
            {
              frameId: 'frame-2',
              rowIndex: 0,
              colIndex: 1,
              x: 600,
              y: 0,
              width: 600,
              height: 600,
              segment: null,
              isEdgePanel: false,
              skuId: 'sku-frame-panel',
              panelWidth: 300,
              panelHeight: 300,
              gapHorizontal: 2,
              gapVertical: 2,
              wasteFactor: 0.05,
            },
            {
              frameId: 'frame-3',
              rowIndex: 1,
              colIndex: 0,
              x: 0,
              y: 600,
              width: 600,
              height: 600,
              segment: null,
              isEdgePanel: true,
              skuId: 'sku-frame-panel',
              panelWidth: 300,
              panelHeight: 300,
              gapHorizontal: 2,
              gapVertical: 2,
              wasteFactor: 0.05,
            },
          ],
          lighting: [],
          furniture: [],
          hiddenComponents: [],
        },
      });

      const outputs = Array.from({ length: 10 }, () => runBomPipeline(input));

      expect(outputs[0].status).toBe('SUCCESS');
      expect(outputs[0].actualBomLines.length).toBeGreaterThan(0);

      for (let i = 1; i < outputs.length; i++) {
        expect(outputs[i]).toEqual(outputs[0]);
      }
    });

    it('should produce stable line ordering for frame-based BOM lines', () => {
      const input = createDeterminismInput({
        snapshotData: {
          zones: [
            {
              zoneId: 'zone-frame',
              x: 0,
              y: 0,
              width: 1800,
              height: 900,
              skuId: 'sku-frame-panel',
            },
          ],
          generatedPanelFrames: [
            {
              frameId: 'frame-a',
              rowIndex: 0,
              colIndex: 0,
              x: 0,
              y: 0,
              width: 900,
              height: 900,
              segment: null,
              isEdgePanel: true,
              skuId: 'sku-frame-panel',
              panelWidth: 450,
              panelHeight: 450,
              gapHorizontal: 5,
              gapVertical: 5,
              wasteFactor: 0.04,
            },
            {
              frameId: 'frame-b',
              rowIndex: 0,
              colIndex: 1,
              x: 900,
              y: 0,
              width: 900,
              height: 900,
              segment: null,
              isEdgePanel: false,
              skuId: 'sku-frame-panel',
              panelWidth: 450,
              panelHeight: 450,
              gapHorizontal: 5,
              gapVertical: 5,
              wasteFactor: 0.04,
            },
          ],
          lighting: [],
          furniture: [],
          hiddenComponents: [],
        },
      });

      const outputs = Array.from({ length: 5 }, () => runBomPipeline(input));
      const referenceIds = outputs[0].actualBomLines.map((l) => l.lineId);

      for (let i = 1; i < outputs.length; i++) {
        expect(outputs[i].actualBomLines.map((l) => l.lineId)).toEqual(referenceIds);
      }
    });
  });

  describe('site adaptation path determinism', () => {
    it('should produce deterministic output when templateWallWidth != wallWidth', () => {
      const input = createDeterminismInput({
        measurements: {
          wallWidth: 3200,
          wallHeight: 2700,
          templateWallWidth: 3000,
        },
        snapshotData: {
          zones: [
            {
              zoneId: 'zone-adapt-1',
              x: 0,
              y: 0,
              width: 1500,
              height: 900,
              skuId: 'sku-panel-adaptable',
              panelWidth: 300,
              panelHeight: 450,
              gapHorizontal: 5,
              gapVertical: 5,
              wasteFactor: 0.05,
              widthStrategy: 'RESIZABLE',
            },
            {
              zoneId: 'zone-adapt-2',
              x: 1500,
              y: 0,
              width: 1500,
              height: 900,
              skuId: 'sku-panel-adaptable',
              panelWidth: 300,
              panelHeight: 450,
              gapHorizontal: 5,
              gapVertical: 5,
              wasteFactor: 0.05,
              widthStrategy: 'RESIZABLE',
            },
          ],
          lighting: [
            {
              componentId: 'light-adapt',
              skuId: 'sku-led-adapt',
              edges: [{ length: 3200 }],
              mountingType: 'DIRECT',
              mode: 'LINEAR',
              unitLength: 500,
            },
          ],
          furniture: [],
          hiddenComponents: [
            {
              componentId: 'fastener-kit',
              skuId: 'sku-fastener',
              triggerType: 'ALWAYS',
              quantityRule: 'FIXED',
              fixedValue: 12,
            },
          ],
        },
      });

      const outputs = Array.from({ length: 10 }, () => runBomPipeline(input));

      expect(outputs[0].status).toBe('SUCCESS');
      expect(outputs[0].actualBomLines.length).toBeGreaterThan(0);

      for (let i = 1; i < outputs.length; i++) {
        expect(outputs[i]).toEqual(outputs[0]);
      }
    });

    it('should produce different output compared to non-adapted path', () => {
      const baseInput = createDeterminismInput({
        snapshotData: {
          zones: [
            {
              zoneId: 'zone-x',
              x: 0,
              y: 0,
              width: 1500,
              height: 900,
              skuId: 'sku-panel-x',
              panelWidth: 300,
              panelHeight: 450,
              gapHorizontal: 5,
              gapVertical: 5,
              wasteFactor: 0.05,
              widthStrategy: 'RESIZABLE',
            },
          ],
          lighting: [],
          furniture: [],
          hiddenComponents: [],
        },
      });

      const nonAdapted = runBomPipeline({
        ...baseInput,
        measurements: { wallWidth: 3000, wallHeight: 2700, templateWallWidth: 3000 },
      });

      const adapted = runBomPipeline({
        ...baseInput,
        measurements: { wallWidth: 3500, wallHeight: 2700, templateWallWidth: 3000 },
      });

      // Adaptation changes zone widths, which changes panel quantities
      expect(JSON.stringify(nonAdapted.actualBomLines)).not.toBe(
        JSON.stringify(adapted.actualBomLines)
      );
    });
  });
});
