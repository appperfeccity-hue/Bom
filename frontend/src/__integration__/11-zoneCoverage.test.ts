/**
 * Integration Test Area 11: Zone coverage / area division
 *
 * Validates that area-division coverage SUPPLEMENTS the geometric fit engine:
 * - the geometric engine result remains the BOM quantity
 * - a divergence between area division and geometric fit surfaces a warning
 *   rather than silently overriding either figure
 */

import { describe, it, expect } from 'vitest';
import { runBomPipeline } from '@/engines/bomPipeline';
import { ErrorCode, ErrorSeverity } from '@/engines/errorCatalogue';
import { calculateZoneCoverage } from '@/engines/zoneCoverageEngine';
import { createStraightWallPipelineInput } from './helpers/fixtures';

describe('Integration Area 11: Zone coverage', () => {
  it('warns when area division and geometric fit diverge, keeping the geometric quantity', () => {
    const input = createStraightWallPipelineInput();
    const zone = input.snapshotData.zones[0];
    const coverage = calculateZoneCoverage({
      zoneWidth: zone.width,
      zoneHeight: zone.height,
      skuWidth: zone.panelWidth ?? 0,
      skuHeight: zone.panelHeight ?? 0,
    });

    const result = runBomPipeline(input);
    const panelLine = result.actualBomLines.find((l) => l.lineId === `panel-${zone.zoneId}`);
    expect(panelLine).toBeDefined();

    const warning = result.warnings.find(
      (w) =>
        w.code === ErrorCode.QTY_AREA_FIT_DIVERGENCE &&
        w.context?.zoneId === zone.zoneId,
    );

    const geometricQuantity = warning
      ? (warning.context?.geometricQuantity as number)
      : coverage.panelQuantity;

    // The area-division figure never replaces the geometric result.
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe(ErrorSeverity.WARNING);
    expect(warning?.context?.expectedQuantity).toBe(coverage.panelQuantity);
    expect(geometricQuantity).not.toBe(coverage.panelQuantity);
    expect(panelLine?.requiredQuantity).toBe(geometricQuantity);
  });

  it('does not block the pipeline on a coverage divergence', () => {
    const result = runBomPipeline(createStraightWallPipelineInput());
    expect(
      result.errors.some((e) => e.code === ErrorCode.QTY_AREA_FIT_DIVERGENCE),
    ).toBe(false);
    expect(result.actualBomLines.length).toBeGreaterThan(0);
  });
});
