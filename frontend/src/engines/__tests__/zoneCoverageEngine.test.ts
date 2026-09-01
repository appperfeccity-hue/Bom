import { describe, it, expect } from 'vitest';
import {
  calculateSkuActualArea,
  calculateZoneArea,
  calculateZoneCoverage,
  reconcileCoverage,
} from '../zoneCoverageEngine';

describe('zoneCoverageEngine', () => {
  it('derives zone area and SKU actual area', () => {
    expect(calculateZoneArea(1200, 900)).toBe(1_080_000);
    expect(calculateSkuActualArea(600, 300)).toBe(180_000);
  });

  it('computes raw and ceiling area-division quantities', () => {
    const result = calculateZoneCoverage({
      zoneWidth: 1200,
      zoneHeight: 900,
      skuWidth: 600,
      skuHeight: 300,
    });
    expect(result.rawPanelQuantity).toBe(6);
    expect(result.panelQuantity).toBe(6);
  });

  it('rounds a partial coverage up', () => {
    const result = calculateZoneCoverage({
      zoneWidth: 1000,
      zoneHeight: 900,
      skuWidth: 600,
      skuHeight: 300,
    });
    expect(result.rawPanelQuantity).toBeCloseTo(5, 5);
    expect(result.panelQuantity).toBe(5);

    const partial = calculateZoneCoverage({
      zoneWidth: 1100,
      zoneHeight: 900,
      skuWidth: 600,
      skuHeight: 300,
    });
    expect(partial.rawPanelQuantity).toBeCloseTo(5.5, 5);
    expect(partial.panelQuantity).toBe(6);
  });

  it('rejects non-positive dimensions', () => {
    expect(() =>
      calculateZoneCoverage({ zoneWidth: 0, zoneHeight: 900, skuWidth: 600, skuHeight: 300 }),
    ).toThrow();
    expect(() =>
      calculateZoneCoverage({ zoneWidth: 900, zoneHeight: 900, skuWidth: 600, skuHeight: 0 }),
    ).toThrow();
  });

  it('reports divergence without overriding the geometric quantity', () => {
    const same = reconcileCoverage(6, 6);
    expect(same.diverges).toBe(false);

    const diverging = reconcileCoverage(6, 8);
    expect(diverging).toEqual({
      expectedQuantity: 6,
      geometricQuantity: 8,
      difference: 2,
      diverges: true,
    });
  });
});
