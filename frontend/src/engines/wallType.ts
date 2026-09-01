/**
 * Wall type naming policy.
 *
 * L_SHAPE is the CANONICAL domain/display name for wall geometry with a corner.
 * L_CORNER is the LEGACY value, preserved verbatim in frozen snapshots, the
 * immutable baseline (baseline/v1.1.5_baseline.sql) and historical rows.
 *
 * Rules:
 *  - Readers and validators MUST accept BOTH values during the migration period.
 *  - Domain/display logic compares against the canonical value (normalizeWallType).
 *  - Writes normalize to L_SHAPE only where a NEW migration governs the column;
 *    denormalizeWallType() produces the legacy value for columns still governed
 *    by a frozen CHECK constraint.
 *  - Historical snapshots and frozen migrations are never rewritten.
 */

/** Legacy persisted wall type value. */
export const LEGACY_L_CORNER = 'L_CORNER';

/** Canonical wall type value for corner walls. */
export const CANONICAL_L_SHAPE = 'L_SHAPE';

/** Canonical wall type vocabulary used by domain and display logic. */
export type CanonicalWallType = 'STRAIGHT' | 'L_SHAPE';

/** Every wall type value accepted on read (canonical + legacy). */
export type AnyWallType = 'STRAIGHT' | 'L_CORNER' | 'L_SHAPE';

/**
 * The L_SHAPE corner point is the canvas origin (0,0) (spec section 3).
 * Segment A extends along +x from the corner, segment B along +y.
 * Canvas coordinates use a bottom-left origin in mm, so the corner point
 * coincides with the canvas origin and every segment offset is measured from it.
 */
export const L_SHAPE_CORNER_ORIGIN: Readonly<{ x: number; y: number }> = Object.freeze({
  x: 0,
  y: 0,
});

/**
 * Maps any accepted wall type value to the canonical vocabulary.
 * L_CORNER -> L_SHAPE. Unknown / nullish values fall back to STRAIGHT.
 */
export function normalizeWallType(value: string | null | undefined): CanonicalWallType {
  if (value === CANONICAL_L_SHAPE || value === LEGACY_L_CORNER) {
    return CANONICAL_L_SHAPE;
  }
  return 'STRAIGHT';
}

/**
 * Maps a wall type back to the value a persisted column expects.
 *
 * @param value  any accepted wall type value
 * @param target 'LEGACY' for columns whose CHECK constraint predates L_SHAPE,
 *               'CANONICAL' for columns governed by a new migration.
 */
export function denormalizeWallType(
  value: string | null | undefined,
  target: 'LEGACY' | 'CANONICAL' = 'CANONICAL',
): AnyWallType {
  const canonical = normalizeWallType(value);
  if (canonical !== CANONICAL_L_SHAPE) return 'STRAIGHT';
  return target === 'LEGACY' ? LEGACY_L_CORNER : CANONICAL_L_SHAPE;
}

/** True when the value denotes a corner wall, in either vocabulary. */
export function isLShape(value: string | null | undefined): boolean {
  return normalizeWallType(value) === CANONICAL_L_SHAPE;
}

/** True when the value is one of the accepted wall type values. */
export function isAcceptedWallType(value: string | null | undefined): value is AnyWallType {
  return value === 'STRAIGHT' || value === LEGACY_L_CORNER || value === CANONICAL_L_SHAPE;
}

/** Human-readable label for a wall type (canonical naming). */
export function wallTypeLabel(value: string | null | undefined): string {
  return isLShape(value) ? 'L-Shape' : 'Straight';
}
