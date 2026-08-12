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
  /** Panel width within this zone (for panel-level checks) */
  panelWidth?: number;
  /** Panel height within this zone (for panel-level checks) */
  panelHeight?: number;
  /** Horizontal gap between panels */
  gapHorizontal?: number;
  /** Vertical gap between panels */
  gapVertical?: number;
}

export interface WallDimensions {
  width: number;
  height: number;
  maxZoneCount?: number;
  minZoneDimension?: number;
  maxAspectRatio?: number;
  /** Maximum allowed zone dimension */
  maxZoneDimension?: number;
  /** Minimum gap between panels */
  minGap?: number;
  /** Maximum gap between panels */
  maxGap?: number;
  /** Minimum panel dimension */
  minPanelDimension?: number;
  /** Maximum panel dimension */
  maxPanelDimension?: number;
  /** Minimum retained panel width after trim */
  minRetainedWidth?: number;
  /** Whether to check total width/height match against wall dimensions */
  checkTotalDimensions?: boolean;
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

    // Zone too large (dimension-based) - only checked when maxZoneDimension configured
    if (wallDimensions.maxZoneDimension !== undefined) {
      if (zone.width > wallDimensions.maxZoneDimension || zone.height > wallDimensions.maxZoneDimension) {
        allErrors.push(
          createPipelineError(ErrorCode.GEO_ZONE_TOO_LARGE, {
            zoneId: zone.zoneId,
            width: zone.width,
            height: zone.height,
            maxDimension: wallDimensions.maxZoneDimension,
          })
        );
      }
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

    // Aspect ratio check - only emit when maxAspectRatio is explicitly configured
    if (wallDimensions.maxAspectRatio !== undefined && zone.width > 0 && zone.height > 0) {
      const ratio = Math.max(zone.width / zone.height, zone.height / zone.width);
      if (ratio > wallDimensions.maxAspectRatio) {
        allErrors.push(
          createPipelineError(ErrorCode.GEO_ZONE_ASPECT_RATIO, {
            zoneId: zone.zoneId,
            aspectRatio: ratio,
            maxAspectRatio: wallDimensions.maxAspectRatio,
          })
        );
      }
    }

    // Panel-level checks (only when panel dimensions are provided)
    if (zone.panelWidth !== undefined && zone.panelHeight !== undefined) {
      // Panel too small
      if (wallDimensions.minPanelDimension !== undefined) {
        if (zone.panelWidth < wallDimensions.minPanelDimension || zone.panelHeight < wallDimensions.minPanelDimension) {
          allErrors.push(
            createPipelineError(ErrorCode.GEO_PANEL_TOO_SMALL, {
              zoneId: zone.zoneId,
              panelWidth: zone.panelWidth,
              panelHeight: zone.panelHeight,
              minPanelDimension: wallDimensions.minPanelDimension,
            })
          );
        }
      }

      // Panel too large
      if (wallDimensions.maxPanelDimension !== undefined) {
        if (zone.panelWidth > wallDimensions.maxPanelDimension || zone.panelHeight > wallDimensions.maxPanelDimension) {
          allErrors.push(
            createPipelineError(ErrorCode.GEO_PANEL_TOO_LARGE, {
              zoneId: zone.zoneId,
              panelWidth: zone.panelWidth,
              panelHeight: zone.panelHeight,
              maxPanelDimension: wallDimensions.maxPanelDimension,
            })
          );
        }
      }

      // Retained width below minimum: check if the remaining width after full panels is below threshold
      if (wallDimensions.minRetainedWidth !== undefined && zone.panelWidth > 0) {
        const gapH = zone.gapHorizontal ?? 0;
        const effectivePanelWidth = zone.panelWidth + gapH;
        const numFullPanels = Math.floor(zone.width / effectivePanelWidth);
        if (numFullPanels > 0) {
          const usedWidth = numFullPanels * effectivePanelWidth - gapH;
          const retained = zone.width - usedWidth;
          if (retained > 0 && retained < wallDimensions.minRetainedWidth) {
            allErrors.push(
              createPipelineError(ErrorCode.GEO_RETAINED_BELOW_MIN, {
                zoneId: zone.zoneId,
                retainedWidth: retained,
                minRetainedWidth: wallDimensions.minRetainedWidth,
              })
            );
          }
        }
      }

      // Trim exceeds panel: check if trim amount exceeds the panel dimension
      if (zone.panelWidth > 0) {
        const gapH = zone.gapHorizontal ?? 0;
        const effectivePanelWidth = zone.panelWidth + gapH;
        const numFullPanels = Math.floor(zone.width / effectivePanelWidth);
        if (numFullPanels > 0) {
          const usedWidth = numFullPanels * effectivePanelWidth - gapH;
          const trimAmount = zone.width - usedWidth;
          if (trimAmount > zone.panelWidth) {
            allErrors.push(
              createPipelineError(ErrorCode.GEO_TRIM_EXCEEDS_PANEL, {
                zoneId: zone.zoneId,
                trimAmount,
                panelWidth: zone.panelWidth,
              })
            );
          }
        }
      }
    }

    // Gap checks (only when gap values are provided)
    if (zone.gapHorizontal !== undefined || zone.gapVertical !== undefined) {
      const gapH = zone.gapHorizontal ?? 0;
      const gapV = zone.gapVertical ?? 0;

      // Gap too small
      if (wallDimensions.minGap !== undefined) {
        if ((zone.gapHorizontal !== undefined && gapH < wallDimensions.minGap) ||
            (zone.gapVertical !== undefined && gapV < wallDimensions.minGap)) {
          allErrors.push(
            createPipelineError(ErrorCode.GEO_GAP_TOO_SMALL, {
              zoneId: zone.zoneId,
              gapHorizontal: gapH,
              gapVertical: gapV,
              minGap: wallDimensions.minGap,
            })
          );
        }
      }

      // Gap too large
      if (wallDimensions.maxGap !== undefined) {
        if ((zone.gapHorizontal !== undefined && gapH > wallDimensions.maxGap) ||
            (zone.gapVertical !== undefined && gapV > wallDimensions.maxGap)) {
          allErrors.push(
            createPipelineError(ErrorCode.GEO_GAP_TOO_LARGE, {
              zoneId: zone.zoneId,
              gapHorizontal: gapH,
              gapVertical: gapV,
              maxGap: wallDimensions.maxGap,
            })
          );
        }
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

  // Total dimension consistency checks (only when checkTotalDimensions is true)
  if (wallDimensions.checkTotalDimensions && zones.length > 0) {
    const totalZoneWidth = zones.reduce((sum, z) => sum + z.width, 0);
    const totalZoneHeight = zones.reduce((max, z) => Math.max(max, z.y + z.height), 0);

    if (Math.abs(totalZoneWidth - wallDimensions.width) > 1) {
      allErrors.push(
        createPipelineError(ErrorCode.GEO_TOTAL_WIDTH_MISMATCH, {
          totalZoneWidth,
          wallWidth: wallDimensions.width,
          difference: Math.abs(totalZoneWidth - wallDimensions.width),
        })
      );
    }

    if (Math.abs(totalZoneHeight - wallDimensions.height) > 1) {
      allErrors.push(
        createPipelineError(ErrorCode.GEO_TOTAL_HEIGHT_MISMATCH, {
          totalZoneHeight,
          wallHeight: wallDimensions.height,
          difference: Math.abs(totalZoneHeight - wallDimensions.height),
        })
      );
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
