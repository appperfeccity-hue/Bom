/**
 * Site Adaptation Engine
 *
 * Transforms template zone geometry to match actual site dimensions.
 * Supports 4 width strategies and 3 height modes.
 *
 * Spec reference: Section 77
 */

import type {
  SiteAdaptationInput,
  SiteAdaptationOutput,
  SiteAdaptationZoneInput,
  SiteAdaptationZoneOutput,
} from './types';
import { EngineError } from './types';

/** Width constraint bounds */
const DEFAULT_MIN_WIDTH = 200;
const DEFAULT_MAX_WIDTH = 3000;

/** Height constraint bounds */
const DEFAULT_MIN_HEIGHT = 200;
const DEFAULT_MAX_HEIGHT = 2700;

/** Tolerance for FIXED strategy in mm */
const FIXED_TOLERANCE = 5;

/**
 * Validate inputs and throw EngineError if invalid.
 */
function validateInput(input: SiteAdaptationInput): void {
  if (!input) {
    throw new EngineError('Input is required');
  }

  if (
    input.template_wall_width === undefined ||
    input.template_wall_width === null ||
    input.template_wall_width <= 0
  ) {
    throw new EngineError(
      `template_wall_width must be positive, got ${input.template_wall_width}`,
    );
  }

  if (
    input.actual_wall_width === undefined ||
    input.actual_wall_width === null ||
    input.actual_wall_width <= 0
  ) {
    throw new EngineError(
      `actual_wall_width must be positive, got ${input.actual_wall_width}`,
    );
  }

  if (!input.zones || input.zones.length === 0) {
    throw new EngineError('zones array must not be empty');
  }

  if (!input.strategy) {
    throw new EngineError('strategy is required');
  }

  const validStrategies = [
    'PROPORTIONAL',
    'PRIORITY_ZONE',
    'EQUAL_DISTRIBUTION',
    'FIXED',
  ];
  if (!validStrategies.includes(input.strategy)) {
    throw new EngineError(`Invalid strategy: ${input.strategy}`);
  }

  if (input.strategy === 'PRIORITY_ZONE') {
    if (input.priority_zone_id === undefined || input.priority_zone_id === null) {
      throw new EngineError(
        'priority_zone_id is required for PRIORITY_ZONE strategy',
      );
    }
    const zoneIds = input.zones.map((z) => z.zone_id);
    if (!zoneIds.includes(input.priority_zone_id)) {
      throw new EngineError(
        `priority_zone_id ${input.priority_zone_id} not found in zones`,
      );
    }
  }

  for (const zone of input.zones) {
    if (zone.zone_id === undefined || zone.zone_id === null) {
      throw new EngineError('Each zone must have a zone_id');
    }
    if (zone.width_mm === undefined || zone.width_mm === null || zone.width_mm <= 0) {
      throw new EngineError(
        `Zone ${zone.zone_id}: width_mm must be positive, got ${zone.width_mm}`,
      );
    }
  }

  // Validate zone_id uniqueness
  const zoneIds = input.zones.map((z) => z.zone_id);
  const uniqueIds = new Set(zoneIds);
  if (uniqueIds.size !== zoneIds.length) {
    const duplicates = zoneIds.filter((id, idx) => zoneIds.indexOf(id) !== idx);
    throw new EngineError(
      `Duplicate zone_id(s) found: ${[...new Set(duplicates)].join(', ')}`,
    );
  }

  // Validate that sum of zone widths matches template_wall_width within 1mm tolerance
  const zoneWidthSum = input.zones.reduce((sum, z) => sum + z.width_mm, 0);
  if (Math.abs(zoneWidthSum - input.template_wall_width) > 1) {
    throw new EngineError(
      `Sum of zone widths (${zoneWidthSum}mm) does not match template_wall_width (${input.template_wall_width}mm). Difference: ${Math.abs(zoneWidthSum - input.template_wall_width)}mm exceeds 1mm tolerance`,
    );
  }

  // Validate that wall height fields are either both present or both absent
  const hasTemplateHeight =
    input.template_wall_height !== undefined && input.template_wall_height !== null;
  const hasActualHeight =
    input.actual_wall_height !== undefined && input.actual_wall_height !== null;
  if (hasTemplateHeight !== hasActualHeight) {
    throw new EngineError(
      'Both template_wall_height and actual_wall_height must be provided for height adaptation, or neither',
    );
  }
}

/**
 * Apply PROPORTIONAL width strategy.
 * ratio = actual_wall_width / template_wall_width
 * Scale each zone by ratio using Math.round (ROUND_HALF_UP).
 * Distribute remainder by zone_id ASC order.
 *
 * NOTE: Per spec (section 77), PROPORTIONAL strategy scales ALL zones by the
 * actual/template ratio regardless of width_strategy. LOCKED zones are NOT
 * excluded from proportional scaling - this is intentional and differs from
 * EQUAL_DISTRIBUTION which does honor LOCKED. The rationale is that proportional
 * scaling maintains relative zone proportions across the entire wall.
 */
function applyProportional(
  zones: SiteAdaptationZoneInput[],
  templateWidth: number,
  actualWidth: number,
): Map<number, number> {
  const ratio = actualWidth / templateWidth;
  const result = new Map<number, number>();

  // Sort zones by zone_id ASC for remainder distribution
  const sortedZones = [...zones].sort((a, b) => a.zone_id - b.zone_id);

  // Scale each zone
  for (const zone of sortedZones) {
    result.set(zone.zone_id, Math.round(zone.width_mm * ratio));
  }

  // Compute sum
  let sum = 0;
  for (const width of result.values()) {
    sum += width;
  }

  // Distribute remainder
  const remainder = actualWidth - sum;
  const direction = remainder > 0 ? 1 : -1;
  const absRemainder = Math.abs(remainder);

  for (let i = 0; i < absRemainder; i++) {
    const zone = sortedZones[i % sortedZones.length];
    result.set(zone.zone_id, result.get(zone.zone_id)! + direction);
  }

  return result;
}

/**
 * Apply PRIORITY_ZONE width strategy.
 * Delta is absorbed entirely by the designated priority zone.
 */
function applyPriorityZone(
  zones: SiteAdaptationZoneInput[],
  templateWidth: number,
  actualWidth: number,
  priorityZoneId: number,
): Map<number, number> {
  const delta = actualWidth - templateWidth;
  const result = new Map<number, number>();

  for (const zone of zones) {
    if (zone.zone_id === priorityZoneId) {
      result.set(zone.zone_id, zone.width_mm + delta);
    } else {
      result.set(zone.zone_id, zone.width_mm);
    }
  }

  return result;
}

/**
 * Apply EQUAL_DISTRIBUTION width strategy.
 * Delta is split equally among resizable zones.
 * Remainder distributed by zone_id ASC among resizable zones.
 */
function applyEqualDistribution(
  zones: SiteAdaptationZoneInput[],
  templateWidth: number,
  actualWidth: number,
): Map<number, number> {
  const delta = actualWidth - templateWidth;
  const result = new Map<number, number>();

  // Identify resizable zones sorted by zone_id ASC
  const resizableZones = zones
    .filter((z) => z.width_strategy !== 'LOCKED')
    .sort((a, b) => a.zone_id - b.zone_id);

  if (resizableZones.length === 0) {
    throw new EngineError(
      'EQUAL_DISTRIBUTION requires at least one resizable zone',
    );
  }

  // Calculate per-zone delta
  const perZone = Math.trunc(delta / resizableZones.length);
  const remainder = delta - perZone * resizableZones.length;

  // Initialize all zones with their original width
  for (const zone of zones) {
    result.set(zone.zone_id, zone.width_mm);
  }

  // Apply equal distribution to resizable zones
  for (const zone of resizableZones) {
    result.set(zone.zone_id, zone.width_mm + perZone);
  }

  // Distribute remainder by zone_id ASC among resizable zones
  const direction = remainder > 0 ? 1 : -1;
  const absRemainder = Math.abs(remainder);
  for (let i = 0; i < absRemainder; i++) {
    const zone = resizableZones[i % resizableZones.length];
    result.set(zone.zone_id, result.get(zone.zone_id)! + direction);
  }

  return result;
}

/**
 * Apply FIXED width strategy.
 * No change allowed. Throws if |actual - template| > 5mm.
 */
function applyFixed(
  zones: SiteAdaptationZoneInput[],
  templateWidth: number,
  actualWidth: number,
): Map<number, number> {
  if (Math.abs(actualWidth - templateWidth) > FIXED_TOLERANCE) {
    throw new EngineError(
      `FIXED strategy: actual wall width differs from template by ${Math.abs(actualWidth - templateWidth)}mm (tolerance: ${FIXED_TOLERANCE}mm)`,
    );
  }

  const result = new Map<number, number>();
  for (const zone of zones) {
    result.set(zone.zone_id, zone.width_mm);
  }
  return result;
}

/**
 * Enforce width and height constraints on adapted zones.
 */
function enforceConstraints(
  zones: SiteAdaptationZoneInput[],
  adaptedWidths: Map<number, number>,
  adaptedHeights: Map<number, number>,
): void {
  for (const zone of zones) {
    const width = adaptedWidths.get(zone.zone_id)!;
    const minWidth = zone.min_width ?? DEFAULT_MIN_WIDTH;
    const maxWidth = zone.max_width ?? DEFAULT_MAX_WIDTH;

    if (width < minWidth) {
      throw new EngineError(
        `Zone ${zone.zone_id}: adapted width ${width}mm is below minimum ${minWidth}mm`,
      );
    }
    if (width > maxWidth) {
      throw new EngineError(
        `Zone ${zone.zone_id}: adapted width ${width}mm exceeds maximum ${maxWidth}mm`,
      );
    }

    if (adaptedHeights.has(zone.zone_id)) {
      const height = adaptedHeights.get(zone.zone_id)!;
      const minHeight = zone.min_height ?? DEFAULT_MIN_HEIGHT;
      const maxHeight = zone.max_height ?? DEFAULT_MAX_HEIGHT;

      if (height < minHeight) {
        throw new EngineError(
          `Zone ${zone.zone_id}: adapted height ${height}mm is below minimum ${minHeight}mm`,
        );
      }
      if (height > maxHeight) {
        throw new EngineError(
          `Zone ${zone.zone_id}: adapted height ${height}mm exceeds maximum ${maxHeight}mm`,
        );
      }
    }
  }
}

/**
 * Adapt template zone geometry to match actual site dimensions.
 *
 * @param input - Site adaptation calculation inputs
 * @returns Adapted zone dimensions
 * @throws EngineError if constraints are violated or input is invalid
 */
export function adaptZonesToSite(input: SiteAdaptationInput): SiteAdaptationOutput {
  validateInput(input);

  const { zones, strategy, template_wall_width, actual_wall_width } = input;

  // Apply width strategy
  let adaptedWidths: Map<number, number>;

  switch (strategy) {
    case 'PROPORTIONAL':
      adaptedWidths = applyProportional(zones, template_wall_width, actual_wall_width);
      break;
    case 'PRIORITY_ZONE':
      adaptedWidths = applyPriorityZone(
        zones,
        template_wall_width,
        actual_wall_width,
        input.priority_zone_id!,
      );
      break;
    case 'EQUAL_DISTRIBUTION':
      adaptedWidths = applyEqualDistribution(
        zones,
        template_wall_width,
        actual_wall_width,
      );
      break;
    case 'FIXED':
      adaptedWidths = applyFixed(zones, template_wall_width, actual_wall_width);
      break;
  }

  // Apply height adaptation
  const adaptedHeights = new Map<number, number>();

  if (input.template_wall_height !== undefined && input.template_wall_height !== null &&
      input.actual_wall_height !== undefined && input.actual_wall_height !== null) {
    const heightRatio = input.actual_wall_height / input.template_wall_height;

    for (const zone of zones) {
      if (zone.height_mm !== undefined) {
        const mode = zone.height_mode ?? 'FIXED';

        switch (mode) {
          case 'DERIVED_FROM_WALL':
          case 'RESIZABLE':
            adaptedHeights.set(
              zone.zone_id,
              Math.round(zone.height_mm * heightRatio),
            );
            break;
          case 'FIXED':
            adaptedHeights.set(zone.zone_id, zone.height_mm);
            break;
        }
      }
    }
  } else {
    // If no wall height info, preserve original heights
    for (const zone of zones) {
      if (zone.height_mm !== undefined) {
        adaptedHeights.set(zone.zone_id, zone.height_mm);
      }
    }
  }

  // Enforce constraints
  enforceConstraints(zones, adaptedWidths, adaptedHeights);

  // Build output sorted by zone_id ASC for determinism
  const sortedZones = [...zones].sort((a, b) => a.zone_id - b.zone_id);
  const adapted_zones: SiteAdaptationZoneOutput[] = sortedZones.map((zone) => {
    const output: SiteAdaptationZoneOutput = {
      zone_id: zone.zone_id,
      adapted_width_mm: adaptedWidths.get(zone.zone_id)!,
    };

    if (adaptedHeights.has(zone.zone_id)) {
      output.adapted_height_mm = adaptedHeights.get(zone.zone_id)!;
    }

    return output;
  });

  return { adapted_zones };
}
