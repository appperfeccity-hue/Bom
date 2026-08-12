/**
 * Wall Panel Quantity Resolution Engine
 *
 * Calculates the number of panels needed to cover a zone,
 * applying symmetric trimming and waste factor.
 *
 * Spec reference: Section 82
 */

import type { WallPanelInput, WallPanelOutput } from './types';
import { EngineError } from './types';

/** Minimum retained panel dimension in mm */
const MIN_RETAINED = 50;

/**
 * Calculate the number of panels and trim for a single axis.
 *
 * Algorithm:
 * 1. Find smallest N such that (N * panelSize) + ((N - 1) * gap) >= zoneSize
 * 2. total_span = (N * panelSize) + ((N - 1) * gap)
 * 3. trim_per_side = (total_span - zoneSize) / 2
 * 4. retained = panelSize - trim_per_side
 * 5. Single-panel special case (N=1): final_panel_size = zoneSize, trim = panelSize - zoneSize, retained = zoneSize
 */
function calculateAxis(
  zoneSize: number,
  panelSize: number,
  gap: number,
): { count: number; trim: number; retained: number } {
  // Find the smallest N such that (N * panelSize) + ((N - 1) * gap) >= zoneSize
  let N = 1;
  while (N * panelSize + (N - 1) * gap < zoneSize) {
    N++;
  }

  // Single-panel special case
  if (N === 1) {
    const trim = panelSize - zoneSize;
    const retained = zoneSize;

    if (retained < MIN_RETAINED) {
      throw new EngineError(
        `Retained dimension ${retained}mm is below minimum ${MIN_RETAINED}mm`,
      );
    }

    return { count: N, trim, retained };
  }

  // Multi-panel case
  const totalSpan = N * panelSize + (N - 1) * gap;
  const trimPerSide = (totalSpan - zoneSize) / 2;
  const retained = panelSize - trimPerSide;

  if (retained < MIN_RETAINED) {
    throw new EngineError(
      `Retained dimension ${retained}mm is below minimum ${MIN_RETAINED}mm`,
    );
  }

  return { count: N, trim: trimPerSide, retained };
}

/**
 * Calculate wall panel quantities for a zone.
 *
 * @param input - Wall panel calculation inputs
 * @returns Wall panel calculation outputs
 * @throws EngineError if retained dimension is below MIN_RETAINED (50mm)
 */
export function calculateWallPanels(input: WallPanelInput): WallPanelOutput {
  const { W, H, w, h, gh, gv, wasteFactor } = input;

  // Calculate width axis
  const widthResult = calculateAxis(W, w, gh);

  // Calculate height axis
  const heightResult = calculateAxis(H, h, gv);

  const requiredQuantity = widthResult.count * heightResult.count;
  const procurementQuantity = Math.ceil(requiredQuantity * (1 + wasteFactor));
  const wasteQuantity = procurementQuantity - requiredQuantity;

  return {
    Ncol: widthResult.count,
    Nrow: heightResult.count,
    requiredQuantity,
    procurementQuantity,
    wasteQuantity,
    trimWidth: widthResult.trim,
    retainedWidth: widthResult.retained,
    trimHeight: heightResult.trim,
    retainedHeight: heightResult.retained,
  };
}
