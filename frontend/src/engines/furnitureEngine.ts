/**
 * Furniture Quantity Resolution Engine
 *
 * Validates consultant-selected quantity against min/max bounds.
 *
 * Spec reference: Section 87
 */

import type { FurnitureInput, FurnitureOutput } from './types';
import { EngineError } from './types';

/**
 * Calculate furniture quantity.
 *
 * @param input - Furniture calculation inputs
 * @returns Furniture calculation outputs
 * @throws EngineError if quantity is below min or above max
 */
export function calculateFurniture(input: FurnitureInput): FurnitureOutput {
  const { quantity, min, max } = input;

  // Quantity of 0 means the BOM line is omitted
  if (quantity === 0) {
    return { quantity: 0, omitted: true };
  }

  // Validate bounds
  if (quantity < min) {
    throw new EngineError(
      `Quantity ${quantity} is below minimum ${min} for SKU ${input.skuId}`,
    );
  }

  if (quantity > max) {
    throw new EngineError(
      `Quantity ${quantity} is above maximum ${max} for SKU ${input.skuId}`,
    );
  }

  return { quantity, omitted: false };
}
