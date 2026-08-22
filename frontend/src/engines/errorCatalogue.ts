/**
 * Error Catalogue for BOM Pipeline
 *
 * Defines all structured error codes, severities, categories,
 * and a helper to create PipelineError instances from templates.
 */

// --- Enums ---

export enum ErrorCode {
  // Geometry errors (19)
  GEO_ZONE_OVERLAP = 'GEO_ZONE_OVERLAP',
  GEO_ZONE_OUTSIDE_WALL = 'GEO_ZONE_OUTSIDE_WALL',
  GEO_ZONE_TOO_SMALL = 'GEO_ZONE_TOO_SMALL',
  GEO_ZONE_TOO_LARGE = 'GEO_ZONE_TOO_LARGE',
  GEO_ZONE_NEGATIVE_DIMENSION = 'GEO_ZONE_NEGATIVE_DIMENSION',
  GEO_ZONE_INVALID_POSITION = 'GEO_ZONE_INVALID_POSITION',
  GEO_ZONE_EXCEEDS_WALL = 'GEO_ZONE_EXCEEDS_WALL',
  GEO_GAP_TOO_SMALL = 'GEO_GAP_TOO_SMALL',
  GEO_GAP_TOO_LARGE = 'GEO_GAP_TOO_LARGE',
  GEO_PANEL_TOO_SMALL = 'GEO_PANEL_TOO_SMALL',
  GEO_PANEL_TOO_LARGE = 'GEO_PANEL_TOO_LARGE',
  GEO_RETAINED_BELOW_MIN = 'GEO_RETAINED_BELOW_MIN',
  GEO_TRIM_EXCEEDS_PANEL = 'GEO_TRIM_EXCEEDS_PANEL',
  GEO_TOTAL_WIDTH_MISMATCH = 'GEO_TOTAL_WIDTH_MISMATCH',
  GEO_TOTAL_HEIGHT_MISMATCH = 'GEO_TOTAL_HEIGHT_MISMATCH',
  GEO_ZONE_COUNT_EXCEEDED = 'GEO_ZONE_COUNT_EXCEEDED',
  GEO_ZONE_ASPECT_RATIO = 'GEO_ZONE_ASPECT_RATIO',
  GEO_WALL_DIMENSION_INVALID = 'GEO_WALL_DIMENSION_INVALID',
  GEO_ZONE_MIN_DIMENSION = 'GEO_ZONE_MIN_DIMENSION',
  // Construction errors (3)
  CONST_MISSING_REQUIRED_COMPONENT = 'CONST_MISSING_REQUIRED_COMPONENT',
  CONST_INVALID_MOUNTING = 'CONST_INVALID_MOUNTING',
  CONST_STRUCTURE_REQUIRED = 'CONST_STRUCTURE_REQUIRED',
  // Compatibility errors (2)
  COMPAT_INCOMPATIBLE_SKUS = 'COMPAT_INCOMPATIBLE_SKUS',
  COMPAT_MISSING_REQUIRED = 'COMPAT_MISSING_REQUIRED',
  // Permission errors (3)
  PERM_LOCKED_PARAMETER = 'PERM_LOCKED_PARAMETER',
  PERM_VALUE_OUT_OF_RANGE = 'PERM_VALUE_OUT_OF_RANGE',
  PERM_INVALID_SKU_SELECTION = 'PERM_INVALID_SKU_SELECTION',
  // Quantity errors (2)
  QTY_PANEL_NO_VALID_ARRANGEMENT = 'QTY_PANEL_NO_VALID_ARRANGEMENT',
  QTY_AREA_FIT_DIVERGENCE = 'QTY_AREA_FIT_DIVERGENCE',
  // Wall Configuration errors (3)
  E_WALL_NO_DIMENSIONS = 'E-WALL-001',
  E_WALL_INVALID_GEOMETRY = 'E-WALL-002',
  E_WALL_GAP_EXCEEDS_SPACE = 'E-WALL-003',
  // Fit errors (2)
  E_FIT_PANEL_BELOW_MIN = 'E-FIT-001',
  E_FIT_INTENSITY_INVALID = 'E-FIT-002',
}

export enum ErrorSeverity {
  BLOCKING = 'BLOCKING',
  WARNING = 'WARNING',
}

export enum ErrorCategory {
  GEOMETRY = 'GEOMETRY',
  CONSTRUCTION = 'CONSTRUCTION',
  COMPATIBILITY = 'COMPATIBILITY',
  PERMISSION = 'PERMISSION',
  QUANTITY = 'QUANTITY',
}

// --- Interfaces ---

export interface PipelineError {
  code: ErrorCode;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  context?: Record<string, unknown>;
}

interface ErrorDefinition {
  severity: ErrorSeverity;
  category: ErrorCategory;
  messageTemplate: string;
}

// --- Error Definitions ---

export const ERROR_DEFINITIONS: Record<ErrorCode, ErrorDefinition> = {
  // Geometry
  [ErrorCode.GEO_ZONE_OVERLAP]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Zones overlap each other',
  },
  [ErrorCode.GEO_ZONE_OUTSIDE_WALL]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Zone is positioned outside the wall boundary',
  },
  [ErrorCode.GEO_ZONE_TOO_SMALL]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Zone dimensions are below minimum allowed size',
  },
  [ErrorCode.GEO_ZONE_TOO_LARGE]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Zone dimensions exceed maximum allowed size',
  },
  [ErrorCode.GEO_ZONE_NEGATIVE_DIMENSION]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Zone has a negative dimension value',
  },
  [ErrorCode.GEO_ZONE_INVALID_POSITION]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Zone has an invalid position',
  },
  [ErrorCode.GEO_ZONE_EXCEEDS_WALL]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Zone extends beyond wall dimensions',
  },
  [ErrorCode.GEO_GAP_TOO_SMALL]: {
    severity: ErrorSeverity.WARNING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Gap between panels is below minimum threshold',
  },
  [ErrorCode.GEO_GAP_TOO_LARGE]: {
    severity: ErrorSeverity.WARNING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Gap between panels exceeds maximum threshold',
  },
  [ErrorCode.GEO_PANEL_TOO_SMALL]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Panel dimensions are below minimum size',
  },
  [ErrorCode.GEO_PANEL_TOO_LARGE]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Panel dimensions exceed maximum size',
  },
  [ErrorCode.GEO_RETAINED_BELOW_MIN]: {
    severity: ErrorSeverity.WARNING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Retained panel dimension is below minimum threshold',
  },
  [ErrorCode.GEO_TRIM_EXCEEDS_PANEL]: {
    severity: ErrorSeverity.WARNING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Trim amount exceeds panel dimension',
  },
  [ErrorCode.GEO_TOTAL_WIDTH_MISMATCH]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Total zone widths do not match wall width',
  },
  [ErrorCode.GEO_TOTAL_HEIGHT_MISMATCH]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Total zone heights do not match wall height',
  },
  [ErrorCode.GEO_ZONE_COUNT_EXCEEDED]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Number of zones exceeds the maximum allowed',
  },
  [ErrorCode.GEO_ZONE_ASPECT_RATIO]: {
    severity: ErrorSeverity.WARNING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Zone aspect ratio is outside recommended range',
  },
  [ErrorCode.GEO_WALL_DIMENSION_INVALID]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Wall dimension is invalid',
  },
  [ErrorCode.GEO_ZONE_MIN_DIMENSION]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Zone does not meet minimum dimension requirement',
  },
  // Construction
  [ErrorCode.CONST_MISSING_REQUIRED_COMPONENT]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.CONSTRUCTION,
    messageTemplate: 'A required component is missing from the BOM',
  },
  [ErrorCode.CONST_INVALID_MOUNTING]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.CONSTRUCTION,
    messageTemplate: 'Invalid mounting configuration detected',
  },
  [ErrorCode.CONST_STRUCTURE_REQUIRED]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.CONSTRUCTION,
    messageTemplate: 'Structural support is required but not present',
  },
  // Compatibility
  [ErrorCode.COMPAT_INCOMPATIBLE_SKUS]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.COMPATIBILITY,
    messageTemplate: 'Selected SKUs are incompatible with each other',
  },
  [ErrorCode.COMPAT_MISSING_REQUIRED]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.COMPATIBILITY,
    messageTemplate: 'A required companion SKU is missing',
  },
  // Permission
  [ErrorCode.PERM_LOCKED_PARAMETER]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.PERMISSION,
    messageTemplate: 'Attempt to modify a locked parameter',
  },
  [ErrorCode.PERM_VALUE_OUT_OF_RANGE]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.PERMISSION,
    messageTemplate: 'Parameter value is outside the allowed range',
  },
  [ErrorCode.PERM_INVALID_SKU_SELECTION]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.PERMISSION,
    messageTemplate: 'Selected SKU is not permitted for this parameter',
  },
  // Quantity
  [ErrorCode.QTY_PANEL_NO_VALID_ARRANGEMENT]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.QUANTITY,
    messageTemplate: 'No valid panel arrangement found for the given dimensions',
  },
  [ErrorCode.QTY_AREA_FIT_DIVERGENCE]: {
    severity: ErrorSeverity.WARNING,
    category: ErrorCategory.QUANTITY,
    messageTemplate:
      'Area-division coverage differs from the geometric panel fit; the geometric fit is authoritative',
  },
  // Wall Configuration
  [ErrorCode.E_WALL_NO_DIMENSIONS]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Wall dimensions are missing or zero',
  },
  [ErrorCode.E_WALL_INVALID_GEOMETRY]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Wall geometry is invalid (negative dimensions or invalid L_SHAPE segments)',
  },
  [ErrorCode.E_WALL_GAP_EXCEEDS_SPACE]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Panel gaps exceed available wall space',
  },
  // Fit
  [ErrorCode.E_FIT_PANEL_BELOW_MIN]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Generated panel frame dimension is below minimum 50mm (Rule 69)',
  },
  [ErrorCode.E_FIT_INTENSITY_INVALID]: {
    severity: ErrorSeverity.BLOCKING,
    category: ErrorCategory.GEOMETRY,
    messageTemplate: 'Fit intensity must be between 0 and 100',
  },
};

// --- Helper ---

/**
 * Creates a PipelineError from the ERROR_DEFINITIONS catalogue.
 */
export function createPipelineError(
  code: ErrorCode,
  context?: Record<string, unknown>
): PipelineError {
  const definition = ERROR_DEFINITIONS[code];
  return {
    code,
    severity: definition.severity,
    category: definition.category,
    message: definition.messageTemplate,
    ...(context !== undefined ? { context } : {}),
  };
}
