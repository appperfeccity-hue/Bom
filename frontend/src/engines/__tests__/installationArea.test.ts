import { describe, it, expect } from 'vitest';
import {
  MAX_ZONES_PER_WALL,
  canAddZone,
  isZoneWithinInstallationArea,
  resolveInstallationArea,
  zoneArea,
  zoneInnerEdge,
  zoneOuterEdge,
} from '../installationArea';

const wall = { width_mm: 4000, height_mm: 2700 };
const zone = { x_mm: 500, y_mm: 200, width_mm: 1000, height_mm: 2000 };

describe('installation area', () => {
  it('caps zones per wall at three', () => {
    expect(MAX_ZONES_PER_WALL).toBe(3);
    expect(canAddZone(0)).toBe(true);
    expect(canAddZone(2)).toBe(true);
    expect(canAddZone(3)).toBe(false);
  });

  it('treats missing configuration as FULL wall coverage', () => {
    expect(resolveInstallationArea(wall, null)).toEqual({
      coverage: 'FULL',
      outerEdge: { x_mm: 0, y_mm: 0, width_mm: 4000, height_mm: 2700 },
    });
  });

  it('clamps a PARTIAL outer edge to the wall', () => {
    const area = resolveInstallationArea(wall, {
      coverage: 'PARTIAL',
      outerEdge: { x_mm: 3000, y_mm: 0, width_mm: 5000, height_mm: 3000 },
    });
    expect(area.outerEdge).toEqual({
      x_mm: 3000,
      y_mm: 0,
      width_mm: 1000,
      height_mm: 2700,
    });
  });

  it('bounds zones by the installation-area outer edge, not the full wall', () => {
    const partial = resolveInstallationArea(wall, {
      coverage: 'PARTIAL',
      outerEdge: { x_mm: 0, y_mm: 0, width_mm: 1200, height_mm: 2700 },
    });
    // Inside the wall, but crosses the installation-area outer edge.
    expect(isZoneWithinInstallationArea(zone, partial)).toBe(false);
    expect(isZoneWithinInstallationArea(zone, resolveInstallationArea(wall, null))).toBe(
      true,
    );
  });

  it('derives zone outer edge, inner edge and area', () => {
    expect(zoneOuterEdge(zone)).toEqual(zone);
    expect(zoneInnerEdge(zone, 50)).toEqual({
      x_mm: 550,
      y_mm: 250,
      width_mm: 900,
      height_mm: 1900,
    });
    expect(zoneArea(zone)).toBe(2_000_000);
  });
});
