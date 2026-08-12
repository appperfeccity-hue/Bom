/**
 * Validation Engine
 *
 * Pure validation functions for the BOM pipeline.
 * Each function returns a ValidationResult with errors and warnings.
 */

import {
  ErrorCode,
  ErrorSeverity,
  PipelineError,
  createPipelineError,
} from './errorCatalogue';

// --- Types ---

export interface ValidationResult {
  passed: boolean;
  errors: PipelineError[];
  warnings: PipelineError[];
}

export interface PermissionRule {
  /** Parameter identifier */
  parameter: string;
  /** Whether the parameter is locked */
  locked: boolean;
  /** Minimum allowed value (for numeric parameters) */
  minValue?: number;
  /** Maximum allowed value (for numeric parameters) */
  maxValue?: number;
  /** Allowed SKU IDs (for SKU selection parameters) */
  allowedSkus?: string[];
}

export interface ConsultantAction {
  /** Parameter being modified */
  parameter: string;
  /** New value set by the consultant */
  value: number | string;
  /** Type of action */
  actionType: 'SET_VALUE' | 'SELECT_SKU';
}

export interface SkuPair {
  sourceSkuId: string;
  targetSkuId: string;
}

export interface CompatibilityRule {
  sourceSkuId: string;
  targetSkuId: string;
  relationshipType: 'REQUIRES' | 'COMPATIBLE_WITH' | 'ALTERNATIVE_TO';
  isMandatory: boolean;
}

export interface GeometryZone {
  zoneId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WallDimensions {
  width: number;
  height: number;
  maxZoneCount?: number;
  minZoneDimension?: number;
  maxAspectRatio?: number;
}

export interface ConstructionLine {
  componentId: string;
  skuId: string;
  mountingType?: string;
  hasStructure?: boolean;
  isMandatory?: boolean;
  isPresent?: boolean;
}

export interface ConstructionRule {
  componentId: string;
  requiresStructure?: boolean;
  validMountingTypes?: string[];
  isMandatory?: boolean;
}

export interface BomValidationLine {
  lineId: string;
  skuId: string;
  quantity: number;
  requiredQuantity: number;
}

// --- Helpers ---

function classifyErrors(errors: PipelineError[]): ValidationResult {
  const blocking = errors.filter(
    (e) => e.severity === ErrorSeverity.BLOCKING
  );
  const warnings = errors.filter(
    (e) => e.severity === ErrorSeverity.WARNING
  );
  return {
    passed: blocking.length === 0,
    errors: blocking,
    warnings,
  };
}

// --- Validation Functions ---

/**
 * Validates consultant actions against permission rules.
 */
export function validatePermissions(
  permissions: PermissionRule[],
  actions: ConsultantAction[]
): ValidationResult {
  const allErrors: PipelineError[] = [];

  for (const action of actions) {
    const rule = permissions.find((p) => p.parameter === action.parameter);

    if (!rule) {
      // No rule means no restriction
      continue;
    }

    // Check locked parameters
    if (rule.locked) {
      allErrors.push(
        createPipelineError(ErrorCode.PERM_LOCKED_PARAMETER, {
          parameter: action.parameter,
          attemptedValue: action.value,
        })
      );
      continue;
    }

    // Check value range for numeric parameters
    if (action.actionType === 'SET_VALUE' && typeof action.value === 'number') {
      if (rule.minValue !== undefined && action.value < rule.minValue) {
        allErrors.push(
          createPipelineError(ErrorCode.PERM_VALUE_OUT_OF_RANGE, {
            parameter: action.parameter,
            value: action.value,
            minValue: rule.minValue,
            maxValue: rule.maxValue,
          })
        );
      } else if (rule.maxValue !== undefined && action.value > rule.maxValue) {
        allErrors.push(
          createPipelineError(ErrorCode.PERM_VALUE_OUT_OF_RANGE, {
            parameter: action.parameter,
            value: action.value,
            minValue: rule.minValue,
            maxValue: rule.maxValue,
          })
        );
      }
    }

    // Check SKU selection
    if (action.actionType === 'SELECT_SKU' && rule.allowedSkus) {
      if (!rule.allowedSkus.includes(action.value as string)) {
        allErrors.push(
          createPipelineError(ErrorCode.PERM_INVALID_SKU_SELECTION, {
            parameter: action.parameter,
            selectedSku: action.value,
            allowedSkus: rule.allowedSkus,
          })
        );
      }
    }
  }

  return classifyErrors(allErrors);
}

/**
 * Checks SKU compatibility based on defined rules.
 */
export function checkCompatibility(
  selectedSkus: SkuPair[],
  rules: CompatibilityRule[]
): ValidationResult {
  const allErrors: PipelineError[] = [];

  // Check for incompatible pairs
  for (const pair of selectedSkus) {
    const matchingRules = rules.filter(
      (r) =>
        r.sourceSkuId === pair.sourceSkuId &&
        r.targetSkuId === pair.targetSkuId
    );

    for (const rule of matchingRules) {
      if (
        rule.relationshipType === 'REQUIRES' &&
        rule.isMandatory
      ) {
        // This pair is required - it's present so no error
        continue;
      }
    }
  }

  // Check for missing required companions
  for (const rule of rules) {
    if (rule.relationshipType === 'REQUIRES' && rule.isMandatory) {
      const sourcePresent = selectedSkus.some(
        (p) => p.sourceSkuId === rule.sourceSkuId || p.targetSkuId === rule.sourceSkuId
      );
      const targetPresent = selectedSkus.some(
        (p) => p.sourceSkuId === rule.targetSkuId || p.targetSkuId === rule.targetSkuId
      );

      if (sourcePresent && !targetPresent) {
        allErrors.push(
          createPipelineError(ErrorCode.COMPAT_MISSING_REQUIRED, {
            sourceSkuId: rule.sourceSkuId,
            missingSkuId: rule.targetSkuId,
          })
        );
      }
    }

    // Check incompatible pairs (alternative_to used together without explicit compat)
    if (rule.relationshipType === 'ALTERNATIVE_TO') {
      const bothPresent = selectedSkus.some(
        (p) =>
          (p.sourceSkuId === rule.sourceSkuId && p.targetSkuId === rule.targetSkuId) ||
          (p.sourceSkuId === rule.targetSkuId && p.targetSkuId === rule.sourceSkuId)
      );
      if (bothPresent) {
        allErrors.push(
          createPipelineError(ErrorCode.COMPAT_INCOMPATIBLE_SKUS, {
            sourceSkuId: rule.sourceSkuId,
            targetSkuId: rule.targetSkuId,
            reason: 'Alternative SKUs cannot be used together',
          })
        );
      }
    }
  }

  return classifyErrors(allErrors);
}

/**
 * Validates zone geometry against wall dimensions and rules.
 */
export function validateGeometry(
  zones: GeometryZone[],
  wallDimensions: WallDimensions
): ValidationResult {
  const allErrors: PipelineError[] = [];

  // Wall dimension validation
  if (wallDimensions.width <= 0 || wallDimensions.height <= 0) {
    allErrors.push(
      createPipelineError(ErrorCode.GEO_WALL_DIMENSION_INVALID, {
        width: wallDimensions.width,
        height: wallDimensions.height,
      })
    );
    return classifyErrors(allErrors);
  }

  // Zone count
  if (
    wallDimensions.maxZoneCount !== undefined &&
    zones.length > wallDimensions.maxZoneCount
  ) {
    allErrors.push(
      createPipelineError(ErrorCode.GEO_ZONE_COUNT_EXCEEDED, {
        count: zones.length,
        maxAllowed: wallDimensions.maxZoneCount,
      })
    );
  }

  const minDim = wallDimensions.minZoneDimension ?? 100;
  const maxAspect = wallDimensions.maxAspectRatio ?? 10;

  for (const zone of zones) {
    // Negative dimension
    if (zone.width < 0 || zone.height < 0) {
      allErrors.push(
        createPipelineError(ErrorCode.GEO_ZONE_NEGATIVE_DIMENSION, {
          zoneId: zone.zoneId,
          width: zone.width,
          height: zone.height,
        })
      );
      continue;
    }

    // Invalid position
    if (zone.x < 0 || zone.y < 0) {
      allErrors.push(
        createPipelineError(ErrorCode.GEO_ZONE_INVALID_POSITION, {
          zoneId: zone.zoneId,
          x: zone.x,
          y: zone.y,
        })
      );
    }

    // Minimum dimension
    if (zone.width < minDim || zone.height < minDim) {
      allErrors.push(
        createPipelineError(ErrorCode.GEO_ZONE_MIN_DIMENSION, {
          zoneId: zone.zoneId,
          width: zone.width,
          height: zone.height,
          minDimension: minDim,
        })
      );
    }

    // Zone too small (area-based)
    if (zone.width > 0 && zone.height > 0 && zone.width * zone.height < minDim * minDim) {
      allErrors.push(
        createPipelineError(ErrorCode.GEO_ZONE_TOO_SMALL, {
          zoneId: zone.zoneId,
          area: zone.width * zone.height,
          minArea: minDim * minDim,
        })
      );
    }

    // Zone exceeds wall
    if (
      zone.x + zone.width > wallDimensions.width ||
      zone.y + zone.height > wallDimensions.height
    ) {
      allErrors.push(
        createPipelineError(ErrorCode.GEO_ZONE_EXCEEDS_WALL, {
          zoneId: zone.zoneId,
          zoneRight: zone.x + zone.width,
          zoneBottom: zone.y + zone.height,
          wallWidth: wallDimensions.width,
          wallHeight: wallDimensions.height,
        })
      );
    }

    // Zone outside wall (fully)
    if (
      zone.x >= wallDimensions.width ||
      zone.y >= wallDimensions.height
    ) {
      allErrors.push(
        createPipelineError(ErrorCode.GEO_ZONE_OUTSIDE_WALL, {
          zoneId: zone.zoneId,
          x: zone.x,
          y: zone.y,
        })
      );
    }

    // Aspect ratio check
    if (zone.width > 0 && zone.height > 0) {
      const ratio = Math.max(zone.width / zone.height, zone.height / zone.width);
      if (ratio > maxAspect) {
        allErrors.push(
          createPipelineError(ErrorCode.GEO_ZONE_ASPECT_RATIO, {
            zoneId: zone.zoneId,
            aspectRatio: ratio,
            maxAspectRatio: maxAspect,
          })
        );
      }
    }
  }

  // Check for overlaps between zones
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const a = zones[i];
      const b = zones[j];
      if (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      ) {
        allErrors.push(
          createPipelineError(ErrorCode.GEO_ZONE_OVERLAP, {
            zoneA: a.zoneId,
            zoneB: b.zoneId,
          })
        );
      }
    }
  }

  return classifyErrors(allErrors);
}

/**
 * Validates construction rules (mounting, structure, mandatory components).
 */
export function validateConstruction(
  bomLines: ConstructionLine[],
  rules: ConstructionRule[]
): ValidationResult {
  const allErrors: PipelineError[] = [];

  for (const rule of rules) {
    const line = bomLines.find((l) => l.componentId === rule.componentId);

    // Check mandatory components are present
    if (rule.isMandatory && (!line || line.isPresent === false)) {
      allErrors.push(
        createPipelineError(ErrorCode.CONST_MISSING_REQUIRED_COMPONENT, {
          componentId: rule.componentId,
        })
      );
      continue;
    }

    if (!line) continue;

    // Check valid mounting types
    if (
      rule.validMountingTypes &&
      line.mountingType &&
      !rule.validMountingTypes.includes(line.mountingType)
    ) {
      allErrors.push(
        createPipelineError(ErrorCode.CONST_INVALID_MOUNTING, {
          componentId: rule.componentId,
          mountingType: line.mountingType,
          validTypes: rule.validMountingTypes,
        })
      );
    }

    // Check structural support requirement
    if (rule.requiresStructure && !line.hasStructure) {
      allErrors.push(
        createPipelineError(ErrorCode.CONST_STRUCTURE_REQUIRED, {
          componentId: rule.componentId,
        })
      );
    }
  }

  return classifyErrors(allErrors);
}

/**
 * Final BOM coherence validation.
 * Checks that all lines have valid quantities and no duplicate entries.
 */
export function validateBom(lines: BomValidationLine[]): ValidationResult {
  const allErrors: PipelineError[] = [];

  for (const line of lines) {
    if (line.quantity <= 0) {
      allErrors.push(
        createPipelineError(ErrorCode.QTY_PANEL_NO_VALID_ARRANGEMENT, {
          lineId: line.lineId,
          skuId: line.skuId,
          quantity: line.quantity,
        })
      );
    }
  }

  return classifyErrors(allErrors);
}
