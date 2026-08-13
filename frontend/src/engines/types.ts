/**
 * Shared types for quantity resolution engines.
 */

// --- Error class ---

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}

// --- Wall Panel Engine ---

export interface WallPanelInput {
  /** Zone width in mm */
  W: number;
  /** Zone height in mm */
  H: number;
  /** Panel width in mm */
  w: number;
  /** Panel height in mm */
  h: number;
  /** Horizontal gap between panels in mm */
  gh: number;
  /** Vertical gap between panels in mm */
  gv: number;
  /** Waste factor (e.g. 0.05 for 5%) */
  wasteFactor: number;
}

export interface WallPanelOutput {
  /** Number of columns */
  Ncol: number;
  /** Number of rows */
  Nrow: number;
  /** Required quantity (Ncol * Nrow) */
  requiredQuantity: number;
  /** Procurement quantity (with waste factor applied) */
  procurementQuantity: number;
  /** Waste quantity (procurement - required) */
  wasteQuantity: number;
  /** Trim per side on width axis in mm */
  trimWidth: number;
  /** Retained width of edge panels in mm */
  retainedWidth: number;
  /** Trim per side on height axis in mm */
  trimHeight: number;
  /** Retained height of edge panels in mm */
  retainedHeight: number;
}

// --- Light Engine ---

export type MountingType = 'DIRECT' | 'PROFILE' | 'COVE';
export type LightMode = 'DISCRETE' | 'LINEAR';

export interface LightEdge {
  /** Length of this edge in mm */
  length: number;
}

export interface LightInput {
  /** Array of edges with their lengths */
  edges: LightEdge[];
  /** Mounting type determines offset per edge */
  mountingType: MountingType;
  /** Quantity calculation mode */
  mode: LightMode;
  /** Unit length in mm (used for DISCRETE mode) */
  unitLength: number;
}

export interface LightOutput {
  /** Total length of all edges with mounting offsets in mm */
  totalLength: number;
  /** Number of LED drivers needed */
  driverCount: number;
  /** Total wire length in mm */
  wireLength: number;
  /** Quantity (pieces for DISCRETE, mm for LINEAR) */
  quantity: number;
}

// --- Furniture Engine ---

export interface FurnitureInput {
  /** Selected quantity */
  quantity: number;
  /** Minimum allowed quantity */
  min: number;
  /** Maximum allowed quantity */
  max: number;
  /** SKU identifier */
  skuId: string;
}

export interface FurnitureOutput {
  /** Resolved quantity */
  quantity: number;
  /** Whether the BOM line should be omitted */
  omitted: boolean;
}

// --- Hidden Component Engine ---

export type TriggerType = 'ALWAYS' | 'CONDITION' | 'DEPENDENCY';
export type ConditionOperator = 'EQ' | 'NEQ' | 'GT' | 'LT' | 'GTE' | 'LTE';
export type QuantityRule = 'FIXED' | 'PER_ZONE' | 'PER_PANEL' | 'DERIVED_FROM_PARENT';

export interface HiddenComponentCondition {
  /** Field name to evaluate */
  field: string;
  /** Comparison operator */
  operator: ConditionOperator;
  /** Value to compare against */
  value: number | string;
}

export interface HiddenComponentInput {
  /** Trigger type for inclusion */
  triggerType: TriggerType;
  /** Condition (required when triggerType is CONDITION) */
  condition?: HiddenComponentCondition;
  /** Quantity rule to apply */
  quantityRule: QuantityRule;
  /** Fixed value (used for FIXED, PER_ZONE, PER_PANEL rules) */
  fixedValue?: number;
  /** Parent quantity (used for DERIVED_FROM_PARENT rule) */
  parentQuantity?: number;
  /** Number of zones (used for PER_ZONE rule) */
  zoneCount?: number;
  /** Number of panels (used for PER_PANEL rule) */
  panelCount?: number;
  /** Whether parent component is present (used for DEPENDENCY trigger) */
  parentPresent?: boolean;
  /** Actual field values for condition evaluation */
  fieldValues?: Record<string, number | string>;
}

export interface HiddenComponentOutput {
  /** Resolved quantity */
  quantity: number;
  /** Whether this component is included */
  included: boolean;
}

// --- Wall Configuration Engine ---

/** Wall type (straight or L-shaped corner). */
export type WallType = 'STRAIGHT' | 'L_CORNER';

/** Panel fit algorithm for distributing panel widths across columns. */
export type FitAlgorithm =
  | 'EQUAL'
  | 'ADJUST_END_PANELS'
  | 'SPREAD_LEFT'
  | 'SPREAD_RIGHT'
  | 'SPREAD_BOTH_ENDS'
  | 'CENTRE_FOCUS'
  | 'OUTER_FOCUS'
  | 'ALTERNATING';

/** Mounting type for the wall configuration. */
export type WallMountingType = 'DIRECT' | 'PROFILE' | 'RAIL';

/** Type of obstruction on the wall. */
export type ObstructionType = 'WINDOW' | 'DOOR' | 'PILLAR' | 'CUSTOM';

/** Wall segment identifier for L_CORNER walls. */
export type WallSegment = 'SEGMENT_A' | 'SEGMENT_B';

/** An obstruction (protected area) that panels cannot overlap. */
export interface Obstruction {
  /** Horizontal position in mm from wall left edge */
  x_mm: number;
  /** Vertical position in mm from wall bottom edge */
  y_mm: number;
  /** Width of obstruction in mm */
  width_mm: number;
  /** Height of obstruction in mm */
  height_mm: number;
  /** Type of obstruction */
  type: ObstructionType;
}

/** Input configuration for the wall configuration engine. */
export interface WallConfigInput {
  /** Wall type (STRAIGHT or L_CORNER) */
  wall_type: WallType;
  /** Total wall width in mm */
  total_width_mm: number;
  /** Total wall height in mm */
  total_height_mm: number;
  /** Number of panel rows */
  rows: number;
  /** Number of panel columns */
  columns: number;
  /** Structural gap between panel frames in mm (Rule 63: independent from SKU gh_mm/gv_mm) */
  panel_gap_mm: number;
  /** Panel fit algorithm */
  fit_algorithm: FitAlgorithm;
  /** Fit intensity from 0 to 100 (0 = equal distribution, 100 = maximum algorithm effect) */
  fit_intensity_percent: number;
  /** Mounting type */
  mounting_type: WallMountingType;
  /** Array of obstructions (protected areas) */
  obstructions: Obstruction[];
  /** Segment A width for L_CORNER walls (optional) */
  segment_a_width_mm?: number;
  /** Segment B width for L_CORNER walls (optional) */
  segment_b_width_mm?: number;
  /** Left edge margin in mm (space between wall left edge and first panel) */
  edge_margin_left_mm?: number;
  /** Right edge margin in mm (space between last panel and wall right edge) */
  edge_margin_right_mm?: number;
}

/** A generated panel frame. */
export interface PanelFrame {
  /** Deterministic ID based on row/col/config hash */
  frame_id: string;
  /** Row index (0-based) */
  row_index: number;
  /** Column index (0-based) */
  col_index: number;
  /** Horizontal position in mm from wall left edge */
  x_mm: number;
  /** Vertical position in mm from wall bottom edge */
  y_mm: number;
  /** Panel frame width in mm */
  width_mm: number;
  /** Panel frame height in mm */
  height_mm: number;
  /** Wall segment (for L_CORNER walls) or null */
  segment: WallSegment | null;
  /** Whether this panel is at an edge of the wall */
  is_edge_panel: boolean;
}

// --- Site Adaptation Engine ---

export type SiteAdaptationStrategy =
  | 'PROPORTIONAL'
  | 'PRIORITY_ZONE'
  | 'EQUAL_DISTRIBUTION'
  | 'FIXED';

export type HeightMode = 'DERIVED_FROM_WALL' | 'FIXED' | 'RESIZABLE';

export interface SiteAdaptationZoneInput {
  /** Unique zone identifier */
  zone_id: number;
  /** Template zone width in mm */
  width_mm: number;
  /** Width strategy for this zone */
  width_strategy: 'LOCKED' | 'RESIZABLE';
  /** Minimum allowed width in mm (default 200) */
  min_width?: number;
  /** Maximum allowed width in mm (default 3000) */
  max_width?: number;
  /** Template zone height in mm */
  height_mm?: number;
  /** Height adaptation mode */
  height_mode?: HeightMode;
  /** Minimum allowed height in mm (default 200) */
  min_height?: number;
  /** Maximum allowed height in mm (default 2700) */
  max_height?: number;
}

export interface SiteAdaptationInput {
  /** Template wall width in mm */
  template_wall_width: number;
  /** Actual wall width in mm */
  actual_wall_width: number;
  /** Array of zones to adapt */
  zones: SiteAdaptationZoneInput[];
  /** Width adaptation strategy */
  strategy: SiteAdaptationStrategy;
  /** Zone ID to receive all delta (required for PRIORITY_ZONE strategy) */
  priority_zone_id?: number;
  /** Template wall height in mm */
  template_wall_height?: number;
  /** Actual wall height in mm */
  actual_wall_height?: number;
}

export interface SiteAdaptationZoneOutput {
  /** Zone identifier */
  zone_id: number;
  /** Adapted width in mm */
  adapted_width_mm: number;
  /** Adapted height in mm (present only if height adaptation was performed) */
  adapted_height_mm?: number;
}

export interface SiteAdaptationOutput {
  /** Array of adapted zones */
  adapted_zones: SiteAdaptationZoneOutput[];
}
