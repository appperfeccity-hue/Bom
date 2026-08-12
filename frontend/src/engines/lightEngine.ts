/**
 * Light Quantity Resolution Engine
 *
 * Calculates LED strip/light quantities, driver count, and wire length.
 *
 * Spec reference: Section 86
 */

import type { LightInput, LightOutput, MountingType } from './types';

/** Mounting offset in mm per edge based on mounting type */
const MOUNTING_OFFSETS: Record<MountingType, number> = {
  DIRECT: 0,
  PROFILE: 5,
  COVE: 10,
};

/** Maximum LED strip length per driver in mm */
const LED_PER_DRIVER = 5000;

/** Extra wire length in mm */
const WIRE_EXTRA = 2000;

/**
 * Calculate light quantities for a set of edges.
 *
 * @param input - Light calculation inputs
 * @returns Light calculation outputs
 */
export function calculateLights(input: LightInput): LightOutput {
  const { edges, mountingType, mode, unitLength } = input;
  const offset = MOUNTING_OFFSETS[mountingType];

  // Total length = sum of (edge length + mounting offset) for each edge
  const totalLength = edges.reduce(
    (sum, edge) => sum + edge.length + offset,
    0,
  );

  // Driver count = ceiling(totalLength / LED_PER_DRIVER)
  const driverCount = Math.ceil(totalLength / LED_PER_DRIVER);

  // Wire length = totalLength + wire extra
  const wireLength = totalLength + WIRE_EXTRA;

  // Quantity depends on mode
  let quantity: number;
  if (mode === 'DISCRETE') {
    quantity = Math.ceil(totalLength / unitLength);
  } else {
    // LINEAR mode: quantity is the total length in mm
    quantity = totalLength;
  }

  return {
    totalLength,
    driverCount,
    wireLength,
    quantity,
  };
}
