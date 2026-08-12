/**
 * Canvas-specific types for the Konva-based designer/consultant UI.
 * All spatial values are in integer millimetres (mm).
 */

/** A 2D point in canvas coordinates (mm, bottom-left origin). */
export interface Point {
  x: number;
  y: number;
}

/** Width and height dimensions in mm. */
export interface Dimensions {
  width: number;
  height: number;
}

/** Axis-aligned bounding box in canvas coordinates. */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Viewport transform state. */
export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

/** Grid configuration for snap-to-grid behavior. */
export interface GridConfig {
  size: number; // 100mm default
  snapEnabled: boolean;
}

/** Canvas rendering layers, ordered back-to-front. */
export enum CanvasLayer {
  GRID = 'GRID',
  WALL_OUTLINE = 'WALL_OUTLINE',
  ZONES = 'ZONES',
  SKU_PLACEMENT = 'SKU_PLACEMENT',
  LIGHTING = 'LIGHTING',
  FURNITURE = 'FURNITURE',
  TRIMS = 'TRIMS',
  MEASUREMENTS = 'MEASUREMENTS',
  SELECTION = 'SELECTION',
  GRID_OVERLAY = 'GRID_OVERLAY',
}

/** Visibility map for each canvas layer. */
export type LayerVisibility = Record<CanvasLayer, boolean>;

/** 8-point resize handles for zone manipulation. */
export type ZoneResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Current selection state on the canvas. */
export interface SelectionState {
  selectedZoneId: string | null;
  resizeHandle: ZoneResizeHandle | null;
}

/** Save status for autosave state machine. */
export type SaveStatus = 'saving' | 'saved' | 'unsaved' | 'error';
