/**
 * Hidden Component Quantity Resolution Engine
 *
 * Determines whether hidden components are included based on trigger rules,
 * and calculates their quantity based on quantity rules.
 *
 * Spec reference: Section 88
 */

import type {
  HiddenComponentInput,
  HiddenComponentOutput,
  ConditionOperator,
} from './types';
import { EngineError } from './types';

/**
 * Evaluate a condition against actual field values.
 */
function evaluateCondition(
  fieldValue: number | string | undefined,
  operator: ConditionOperator,
  targetValue: number | string,
): boolean {
  if (fieldValue === undefined) {
    return false;
  }

  switch (operator) {
    case 'EQ':
      return fieldValue === targetValue;
    case 'NEQ':
      return fieldValue !== targetValue;
    case 'GT':
      return fieldValue > targetValue;
    case 'LT':
      return fieldValue < targetValue;
    case 'GTE':
      return fieldValue >= targetValue;
    case 'LTE':
      return fieldValue <= targetValue;
    default:
      return false;
  }
}

/**
 * Calculate hidden component inclusion and quantity.
 *
 * @param input - Hidden component calculation inputs
 * @returns Hidden component calculation outputs
 * @throws EngineError if required parameters are missing
 */
export function calculateHiddenComponent(
  input: HiddenComponentInput,
): HiddenComponentOutput {
  const {
    triggerType,
    condition,
    quantityRule,
    fixedValue,
    parentQuantity,
    zoneCount,
    panelCount,
    parentPresent,
    fieldValues,
  } = input;

  // Determine inclusion based on trigger type
  let included = false;

  switch (triggerType) {
    case 'ALWAYS':
      included = true;
      break;

    case 'CONDITION':
      if (!condition) {
        throw new EngineError(
          'Condition is required when triggerType is CONDITION',
        );
      }
      {
        const fieldValue = fieldValues?.[condition.field];
        included = evaluateCondition(
          fieldValue,
          condition.operator,
          condition.value,
        );
      }
      break;

    case 'DEPENDENCY':
      included = parentPresent === true;
      break;
  }

  // If not included, return 0 quantity
  if (!included) {
    return { quantity: 0, included: false };
  }

  // Calculate quantity based on quantity rule
  let quantity = 0;

  switch (quantityRule) {
    case 'FIXED':
      if (fixedValue === undefined) {
        throw new EngineError('fixedValue is required for FIXED quantity rule');
      }
      quantity = fixedValue;
      break;

    case 'PER_ZONE':
      if (fixedValue === undefined) {
        throw new EngineError(
          'fixedValue is required for PER_ZONE quantity rule',
        );
      }
      if (zoneCount === undefined) {
        throw new EngineError(
          'zoneCount is required for PER_ZONE quantity rule',
        );
      }
      quantity = fixedValue * zoneCount;
      break;

    case 'PER_PANEL':
      if (fixedValue === undefined) {
        throw new EngineError(
          'fixedValue is required for PER_PANEL quantity rule',
        );
      }
      if (panelCount === undefined) {
        throw new EngineError(
          'panelCount is required for PER_PANEL quantity rule',
        );
      }
      quantity = fixedValue * panelCount;
      break;

    case 'DERIVED_FROM_PARENT':
      if (parentQuantity === undefined) {
        throw new EngineError(
          'parentQuantity is required for DERIVED_FROM_PARENT quantity rule',
        );
      }
      quantity = parentQuantity;
      break;
  }

  return { quantity, included: true };
}
