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
