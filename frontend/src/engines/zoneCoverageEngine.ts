/**
 * Zone coverage / area-division (spec sections 15-16).
 *
 * Area division is a deterministic zone-level quantity INPUT: it says how many
 * SKU units of area are needed to cover a zone. It is NOT the final BOM quantity
 * — wallPanelEngine/generatePanelFrames (rows/cols/cuts, 8 fit algorithms) stay
 * the authority on physical realizability. Divergence between the two is
 * surfaced as a warning, never a silent override.
 */

export interface ZoneCoverageInput {
  /** Zone width in mm. */
  zoneWidth: number;
  /** Zone height in mm. */
  zoneHeight: number;
  /** SKU width in mm. */
  skuWidth: number;
  /** SKU height in mm. */
  skuHeight: number;
}

export interface ZoneCoverageOutput {
  /** zoneWidth * zoneHeight in mm^2. */
  zoneArea: number;
  /** skuWidth * skuHeight in mm^2 (spec section 15). */
  skuActualArea: number;
  /** zoneArea / skuActualArea, unrounded. */
  rawPanelQuantity: number;
  /** CEILING(zoneArea / skuActualArea) (spec section 16). */
  panelQuantity: number;
}

/** Derived zone area in mm^2. */
export function calculateZoneArea(widthMm: number, heightMm: number): number {
  return widthMm * heightMm;
}

/** Derived SKU face area in mm^2. */
export function calculateSkuActualArea(widthMm: number, heightMm: number): number {
  return widthMm * heightMm;
}

/**
 * Area-division coverage for one zone. Throws on non-positive inputs so callers
 * cannot silently produce a zero or infinite quantity.
 */
export function calculateZoneCoverage(input: ZoneCoverageInput): ZoneCoverageOutput {
  const { zoneWidth, zoneHeight, skuWidth, skuHeight } = input;
  if (zoneWidth <= 0 || zoneHeight <= 0) {
    throw new Error('Zone dimensions must be positive');
  }
  if (skuWidth <= 0 || skuHeight <= 0) {
    throw new Error('SKU dimensions must be positive');
  }

  const zoneArea = calculateZoneArea(zoneWidth, zoneHeight);
  const skuActualArea = calculateSkuActualArea(skuWidth, skuHeight);
  const rawPanelQuantity = zoneArea / skuActualArea;

  return {
    zoneArea,
    skuActualArea,
    rawPanelQuantity,
    panelQuantity: Math.ceil(rawPanelQuantity),
  };
}

export interface CoverageReconciliation {
  /** Area-division expectation. */
  expectedQuantity: number;
  /** Quantity the geometric fit engine actually produced (the BOM authority). */
  geometricQuantity: number;
  /** geometricQuantity - expectedQuantity. */
  difference: number;
  /** True when the two figures disagree and a warning must be surfaced. */
  diverges: boolean;
}

/**
 * Compare area-division coverage against the geometric fit result. The geometric
 * result always wins; this only reports the divergence.
 */
export function reconcileCoverage(
  expectedQuantity: number,
  geometricQuantity: number,
): CoverageReconciliation {
  return {
    expectedQuantity,
    geometricQuantity,
    difference: geometricQuantity - expectedQuantity,
    diverges: geometricQuantity !== expectedQuantity,
  };
}
