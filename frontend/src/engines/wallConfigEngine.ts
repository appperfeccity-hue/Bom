/**
 * Wall Configuration Engine
 *
 * Deterministically generates panel frames from wall configuration parameters.
 * Pure function with no side effects.
 *
 * Rules:
 * - Rule 63: panel_gap_mm is the structural gap between frames, independent from SKU gh_mm/gv_mm joint gaps
 * - Rule 69: Minimum 50mm for any panel frame dimension - throws EngineError if violated
 * - Rule 65: Designer CANNOT manually create, resize, or delete panel frame zones (enforced at UI level)
 */

import type {
  WallConfigInput,
  PanelFrame,
  FitAlgorithm,
  Obstruction,
  WallSegment,
} from './types';
import { EngineError } from './types';

/** Minimum panel frame dimension in mm (Rule 69) */
const MIN_PANEL_DIMENSION = 50;

/**
 * Generate a deterministic frame ID based on row, column, and config hash.
 */
function generateFrameId(row: number, col: number, configHash: string): string {
  // Create a deterministic ID from the config hash and position
  return `pf-${configHash}-r${row}-c${col}`;
}

/**
 * Simple deterministic hash from the config for frame ID generation.
 */
function hashConfig(config: WallConfigInput): string {
  const key = [
    config.wall_type,
    config.total_width_mm,
    config.total_height_mm,
    config.rows,
    config.columns,
    config.panel_gap_mm,
    config.fit_algorithm,
    config.fit_intensity_percent,
    config.edge_margin_left_mm ?? 0,
    config.edge_margin_right_mm ?? 0,
  ].join('-');

  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Validate the wall configuration input.
 */
function validateInput(config: WallConfigInput): void {
  if (config.total_width_mm <= 0 || config.total_height_mm <= 0) {
    throw new EngineError(
      `Wall dimensions must be positive: width=${config.total_width_mm}mm, height=${config.total_height_mm}mm [E-WALL-001]`,
    );
  }

  if (config.rows <= 0 || config.columns <= 0) {
    throw new EngineError(
      `Rows and columns must be positive: rows=${config.rows}, columns=${config.columns} [E-WALL-002]`,
    );
  }

  if (config.panel_gap_mm < 0) {
    throw new EngineError(
      `Panel gap must be non-negative: ${config.panel_gap_mm}mm [E-WALL-002]`,
    );
  }

  if (config.fit_intensity_percent < 0 || config.fit_intensity_percent > 100) {
    throw new EngineError(
      `Fit intensity must be between 0 and 100: ${config.fit_intensity_percent} [E-FIT-002]`,
    );
  }

  if (config.wall_type === 'L_CORNER') {
    if (
      config.segment_a_width_mm == null ||
      config.segment_b_width_mm == null ||
      config.segment_a_width_mm <= 0 ||
      config.segment_b_width_mm <= 0
    ) {
      throw new EngineError(
        'L_CORNER wall requires positive segment_a_width_mm and segment_b_width_mm [E-WALL-002]',
      );
    }
  }

  // Check if gaps exceed available space
  const edgeMargins = (config.edge_margin_left_mm ?? 0) + (config.edge_margin_right_mm ?? 0);
  const totalHorizontalGap = (config.columns - 1) * config.panel_gap_mm + edgeMargins;
  const totalVerticalGap = (config.rows - 1) * config.panel_gap_mm;

  if (totalHorizontalGap >= config.total_width_mm) {
    throw new EngineError(
      `Panel gaps (${totalHorizontalGap}mm) exceed available wall width (${config.total_width_mm}mm) [E-WALL-003]`,
    );
  }

  if (totalVerticalGap >= config.total_height_mm) {
    throw new EngineError(
      `Panel gaps (${totalVerticalGap}mm) exceed available wall height (${config.total_height_mm}mm) [E-WALL-003]`,
    );
  }
}

/**
 * Calculate column widths for the EQUAL algorithm.
 * All panels get identical width.
 */
function calculateEqual(availableWidth: number, columns: number): number[] {
  const panelWidth = availableWidth / columns;
  return Array(columns).fill(panelWidth);
}

/**
 * Calculate column widths for the ADJUST_END_PANELS algorithm.
 * Center panels use standard size, end panels absorb remainder.
 * At intensity 0% = equal; at intensity 100% = max adjustment to ends.
 */
function calculateAdjustEndPanels(
  availableWidth: number,
  columns: number,
  intensity: number,
): number[] {
  if (columns <= 1) return [availableWidth];
  if (columns === 2) {
    // With 2 columns, both are "end panels" - just split equally
    return calculateEqual(availableWidth, columns);
  }

  const equalWidth = availableWidth / columns;
  const t = intensity / 100;

  // At full intensity, center panels are 20% wider, end panels absorb the difference
  const centerWidthBoost = equalWidth * 0.2 * t;
  const centerCount = columns - 2;
  const totalCenterExtra = centerWidthBoost * centerCount;
  const endReduction = totalCenterExtra / 2;

  const endWidth = equalWidth - endReduction;
  const centerWidth = equalWidth + centerWidthBoost;

  const widths: number[] = [];
  for (let i = 0; i < columns; i++) {
    if (i === 0 || i === columns - 1) {
      widths.push(endWidth);
    } else {
      widths.push(centerWidth);
    }
  }

  return widths;
}

/**
 * Calculate column widths for the SPREAD_LEFT algorithm.
 * Leftmost panels narrower, progressive widening to right.
 */
function calculateSpreadLeft(
  availableWidth: number,
  columns: number,
  intensity: number,
): number[] {
  if (columns <= 1) return [availableWidth];

  const equalWidth = availableWidth / columns;
  const t = intensity / 100;

  // Linear spread: left panels narrower, right panels wider
  // At full intensity, leftmost is 50% of equal, rightmost is 150% of equal
  const widths: number[] = [];
  for (let i = 0; i < columns; i++) {
    const factor = 1 + t * (i / (columns - 1) - 0.5);
    widths.push(equalWidth * factor);
  }

  // Normalize to ensure total matches available width
  const total = widths.reduce((sum, w) => sum + w, 0);
  const scale = availableWidth / total;
  return widths.map((w) => w * scale);
}

/**
 * Calculate column widths for the SPREAD_RIGHT algorithm.
 * Rightmost panels narrower, progressive widening to left.
 */
function calculateSpreadRight(
  availableWidth: number,
  columns: number,
  intensity: number,
): number[] {
  // Mirror of SPREAD_LEFT
  return calculateSpreadLeft(availableWidth, columns, intensity).reverse();
}

/**
 * Calculate column widths for the SPREAD_BOTH_ENDS algorithm.
 * Both end panels narrower, center panels wider. Symmetric.
 */
function calculateSpreadBothEnds(
  availableWidth: number,
  columns: number,
  intensity: number,
): number[] {
  if (columns <= 1) return [availableWidth];
  if (columns === 2) return calculateEqual(availableWidth, columns);

  const equalWidth = availableWidth / columns;
  const t = intensity / 100;

  // Parabolic distribution: center high, edges low
  const midpoint = (columns - 1) / 2;
  const widths: number[] = [];

  for (let i = 0; i < columns; i++) {
    const distFromCenter = Math.abs(i - midpoint) / midpoint; // 0 at center, 1 at edges
    const factor = 1 + t * (0.5 - distFromCenter * 0.5) * 2;
    widths.push(equalWidth * factor);
  }

  // Normalize
  const total = widths.reduce((sum, w) => sum + w, 0);
  const scale = availableWidth / total;
  return widths.map((w) => w * scale);
}

/**
 * Calculate column widths for the CENTRE_FOCUS algorithm.
 * Center panels wider, outer panels narrower.
 */
function calculateCentreFocus(
  availableWidth: number,
  columns: number,
  intensity: number,
): number[] {
  if (columns <= 1) return [availableWidth];

  const equalWidth = availableWidth / columns;
  const t = intensity / 100;
  const midpoint = (columns - 1) / 2;

  const widths: number[] = [];
  for (let i = 0; i < columns; i++) {
    const distFromCenter = Math.abs(i - midpoint) / (midpoint || 1);
    // Center gets a boost, edges get reduced
    const factor = 1 + t * (1 - distFromCenter) * 0.5 - t * distFromCenter * 0.25;
    widths.push(equalWidth * factor);
  }

  // Normalize
  const total = widths.reduce((sum, w) => sum + w, 0);
  const scale = availableWidth / total;
  return widths.map((w) => w * scale);
}

/**
 * Calculate column widths for the OUTER_FOCUS algorithm.
 * Outer panels wider, center panels narrower.
 */
function calculateOuterFocus(
  availableWidth: number,
  columns: number,
  intensity: number,
): number[] {
  if (columns <= 1) return [availableWidth];

  const equalWidth = availableWidth / columns;
  const t = intensity / 100;
  const midpoint = (columns - 1) / 2;

  const widths: number[] = [];
  for (let i = 0; i < columns; i++) {
    const distFromCenter = Math.abs(i - midpoint) / (midpoint || 1);
    // Edges get a boost, center gets reduced
    const factor = 1 + t * distFromCenter * 0.5 - t * (1 - distFromCenter) * 0.25;
    widths.push(equalWidth * factor);
  }

  // Normalize
  const total = widths.reduce((sum, w) => sum + w, 0);
  const scale = availableWidth / total;
  return widths.map((w) => w * scale);
}

/**
 * Calculate column widths for the ALTERNATING algorithm.
 * Alternating wide/narrow panels based on intensity.
 */
function calculateAlternating(
  availableWidth: number,
  columns: number,
  intensity: number,
): number[] {
  if (columns <= 1) return [availableWidth];

  const equalWidth = availableWidth / columns;
  const t = intensity / 100;

  // Alternating: even-indexed columns are wide, odd-indexed are narrow
  const widths: number[] = [];
  for (let i = 0; i < columns; i++) {
    const isWide = i % 2 === 0;
    const factor = isWide ? 1 + t * 0.3 : 1 - t * 0.3;
    widths.push(equalWidth * factor);
  }

  // Normalize
  const total = widths.reduce((sum, w) => sum + w, 0);
  const scale = availableWidth / total;
  return widths.map((w) => w * scale);
}

/**
 * Apply Math.round rounding with sum-correction to preserve total width.
 *
 * Strategy: round each width to the nearest integer, then distribute any
 * rounding residual (difference between rounded sum and target) across the
 * widest panels (one pixel at a time) to maintain the total width invariant.
 * This ensures that when persisted to INT columns in Postgres, the rounded
 * widths still sum exactly to `availableWidth` (which is itself an integer
 * since both total_width_mm and panel_gap_mm are integers).
 */
function applyRoundingWithSumCorrection(widths: number[], availableWidth: number): number[] {
  const rounded = widths.map((w) => Math.round(w));
  let sum = rounded.reduce((s, w) => s + w, 0);
  const target = Math.round(availableWidth);

  // Distribute residual across panels (favour larger panels to minimize visible distortion)
  while (sum !== target) {
    // Create indices sorted by width descending for consistent correction distribution
    const indices = rounded
      .map((_, i) => i)
      .sort((a, b) => rounded[b] - rounded[a]);

    if (sum < target) {
      // Need to add pixels - add 1mm to the widest panel that won't cause issues
      rounded[indices[0]] += 1;
      sum += 1;
    } else {
      // Need to remove pixels - subtract 1mm from the widest panel
      // Only if it stays above MIN_PANEL_DIMENSION
      const candidate = indices.find((i) => rounded[i] > MIN_PANEL_DIMENSION);
      if (candidate !== undefined) {
        rounded[candidate] -= 1;
        sum -= 1;
      } else {
        // Cannot correct without violating minimum - break to avoid infinite loop
        break;
      }
    }
  }

  return rounded;
}

/**
 * Dispatch to the appropriate fit algorithm.
 */
function calculateColumnWidths(
  availableWidth: number,
  columns: number,
  algorithm: FitAlgorithm,
  intensity: number,
): number[] {
  let widths: number[];
  switch (algorithm) {
    case 'EQUAL':
      widths = calculateEqual(availableWidth, columns);
      break;
    case 'ADJUST_END_PANELS':
      widths = calculateAdjustEndPanels(availableWidth, columns, intensity);
      break;
    case 'SPREAD_LEFT':
      widths = calculateSpreadLeft(availableWidth, columns, intensity);
      break;
    case 'SPREAD_RIGHT':
      widths = calculateSpreadRight(availableWidth, columns, intensity);
      break;
    case 'SPREAD_BOTH_ENDS':
      widths = calculateSpreadBothEnds(availableWidth, columns, intensity);
      break;
    case 'CENTRE_FOCUS':
      widths = calculateCentreFocus(availableWidth, columns, intensity);
      break;
    case 'OUTER_FOCUS':
      widths = calculateOuterFocus(availableWidth, columns, intensity);
      break;
    case 'ALTERNATING':
      widths = calculateAlternating(availableWidth, columns, intensity);
      break;
    default:
      widths = calculateEqual(availableWidth, columns);
      break;
  }

  // Apply rounding with sum-correction to produce integer widths suitable for
  // persistence to INT columns while preserving the total width invariant.
  return applyRoundingWithSumCorrection(widths, availableWidth);
}

/**
 * Check if a panel frame overlaps with any obstruction.
 *
 * Boundary semantics: strict less-than/greater-than is used for overlap detection.
 * A panel whose edge exactly touches an obstruction boundary (zero-gap adjacency)
 * is NOT excluded. This is intentional - touching means the panel ends precisely
 * where the obstruction begins, with no physical overlap. Only panels that extend
 * into the obstruction area are excluded.
 */
function overlapsObstruction(
  x: number,
  y: number,
  width: number,
  height: number,
  obstructions: Obstruction[],
): boolean {
  for (const obs of obstructions) {
    const overlapX = x < obs.x_mm + obs.width_mm && x + width > obs.x_mm;
    const overlapY = y < obs.y_mm + obs.height_mm && y + height > obs.y_mm;
    if (overlapX && overlapY) {
      return true;
    }
  }
  return false;
}

/**
 * Determine which segment a panel belongs to for L_CORNER walls.
 */
function getSegment(
  x: number,
  width: number,
  segmentAWidth: number | undefined,
): WallSegment | null {
  if (segmentAWidth == null) return null;

  const panelMidX = x + width / 2;
  if (panelMidX <= segmentAWidth) {
    return 'SEGMENT_A';
  }
  return 'SEGMENT_B';
}

/**
 * Generate panel frames from wall configuration.
 *
 * This is a deterministic pure function: given the same input, it always
 * produces the same output. No side effects.
 *
 * @param config - Wall configuration input parameters
 * @returns Array of generated panel frames
 * @throws EngineError if configuration is invalid or generated panels violate Rule 69
 */
export function generatePanelFrames(config: WallConfigInput): PanelFrame[] {
  validateInput(config);

  const configHash = hashConfig(config);
  const { rows, columns, panel_gap_mm, total_width_mm, total_height_mm, obstructions } = config;
  const edgeMarginLeft = config.edge_margin_left_mm ?? 0;
  const edgeMarginRight = config.edge_margin_right_mm ?? 0;

  // Calculate available space after gaps and edge margins
  const availableWidth = total_width_mm - (columns - 1) * panel_gap_mm - edgeMarginLeft - edgeMarginRight;
  const availableHeight = total_height_mm - (rows - 1) * panel_gap_mm;

  // Calculate row heights (equal distribution for rows) with sum-correction rounding
  // to ensure heights sum exactly to availableHeight, same strategy as column widths.
  const rawRowHeights = Array(rows).fill(availableHeight / rows) as number[];
  const rowHeights = applyRoundingWithSumCorrection(rawRowHeights, availableHeight);

  // Calculate column widths based on fit algorithm
  const columnWidths = calculateColumnWidths(
    availableWidth,
    columns,
    config.fit_algorithm,
    config.fit_intensity_percent,
  );

  // Validate minimum dimensions (Rule 69)
  for (let col = 0; col < columns; col++) {
    if (columnWidths[col] < MIN_PANEL_DIMENSION) {
      throw new EngineError(
        `Generated panel width ${columnWidths[col].toFixed(2)}mm at column ${col} is below minimum ${MIN_PANEL_DIMENSION}mm (Rule 69) [E-FIT-001]`,
      );
    }
  }

  for (let row = 0; row < rows; row++) {
    if (rowHeights[row] < MIN_PANEL_DIMENSION) {
      throw new EngineError(
        `Generated panel height ${rowHeights[row].toFixed(2)}mm at row ${row} is below minimum ${MIN_PANEL_DIMENSION}mm (Rule 69) [E-FIT-001]`,
      );
    }
  }

  // Generate panel frames
  const frames: PanelFrame[] = [];

  for (let row = 0; row < rows; row++) {
    // Calculate y position using sum of previous row heights + gaps
    let y = 0;
    for (let r = 0; r < row; r++) {
      y += rowHeights[r] + panel_gap_mm;
    }

    let x = edgeMarginLeft;
    for (let col = 0; col < columns; col++) {
      const width = columnWidths[col];
      const height = rowHeights[row];

      // Check if this panel overlaps with any obstruction
      if (!overlapsObstruction(x, y, width, height, obstructions)) {
        const isEdge =
          row === 0 || row === rows - 1 || col === 0 || col === columns - 1;

        const segment =
          config.wall_type === 'L_CORNER'
            ? getSegment(x, width, config.segment_a_width_mm)
            : null;

        frames.push({
          frame_id: generateFrameId(row, col, configHash),
          row_index: row,
          col_index: col,
          x_mm: x,
          y_mm: y,
          width_mm: width,
          height_mm: height,
          segment,
          is_edge_panel: isEdge,
        });
      }

      x += width + panel_gap_mm;
    }
  }

  return frames;
}
