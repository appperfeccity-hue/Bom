import { create } from 'zustand';
import { CanvasMode } from '@/types/database';
import {
  CanvasLayer,
  type GridConfig,
  type LayerVisibility,
  type SaveStatus,
  type SelectionState,
  type ViewportState,
  type ZoneResizeHandle,
} from '@/types/canvas';

export interface CanvasState {
  mode: CanvasMode;
  viewport: ViewportState;
  gridConfig: GridConfig;
  layerVisibility: LayerVisibility;
  selection: SelectionState;
  saveStatus: SaveStatus;
  version: number;
}

export interface CanvasActions {
  setMode: (mode: CanvasMode) => void;
  setZoom: (level: number) => void;
  pan: (dx: number, dy: number) => void;
  resetViewport: () => void;
  toggleLayer: (layer: CanvasLayer) => void;
  setLayerVisibility: (layer: CanvasLayer, visible: boolean) => void;
  selectZone: (id: string | null) => void;
  clearSelection: () => void;
  setResizeHandle: (handle: ZoneResizeHandle | null) => void;
  setSaveStatus: (status: SaveStatus) => void;
  incrementVersion: () => void;
}

export type CanvasStore = CanvasState & CanvasActions;

/** Minimum zoom level (25%). */
export const MIN_ZOOM = 0.25;

/** Maximum zoom level (400%). */
export const MAX_ZOOM = 4.0;

/** Clamp zoom to valid range. */
export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Create default layer visibility with all layers visible. */
function defaultLayerVisibility(): LayerVisibility {
  return {
    [CanvasLayer.GRID]: true,
    [CanvasLayer.WALL_OUTLINE]: true,
    [CanvasLayer.ZONES]: true,
    [CanvasLayer.SKU_PLACEMENT]: true,
    [CanvasLayer.LIGHTING]: true,
    [CanvasLayer.FURNITURE]: true,
    [CanvasLayer.TRIMS]: true,
    [CanvasLayer.MEASUREMENTS]: true,
    [CanvasLayer.SELECTION]: true,
    [CanvasLayer.GRID_OVERLAY]: true,
  };
}

const initialState: CanvasState = {
  mode: CanvasMode.DESIGNER,
  viewport: {
    zoom: 1.0, // Default; fit-to-viewport will be computed at render time
    panX: 0,
    panY: 0,
  },
  gridConfig: {
    size: 100,
    snapEnabled: true,
  },
  layerVisibility: defaultLayerVisibility(),
  selection: {
    selectedZoneId: null,
    resizeHandle: null,
  },
  saveStatus: 'saved',
  version: 1,
};

export const useCanvasStore = create<CanvasStore>((set) => ({
  ...initialState,

  setMode: (mode: CanvasMode) => set({ mode }),

  setZoom: (level: number) =>
    set((state) => ({
      viewport: { ...state.viewport, zoom: clampZoom(level) },
    })),

  pan: (dx: number, dy: number) =>
    set((state) => ({
      viewport: {
        ...state.viewport,
        panX: state.viewport.panX + dx,
        panY: state.viewport.panY + dy,
      },
    })),

  resetViewport: () =>
    set({
      viewport: { zoom: 1.0, panX: 0, panY: 0 },
    }),

  toggleLayer: (layer: CanvasLayer) =>
    set((state) => ({
      layerVisibility: {
        ...state.layerVisibility,
        [layer]: !state.layerVisibility[layer],
      },
    })),

  setLayerVisibility: (layer: CanvasLayer, visible: boolean) =>
    set((state) => ({
      layerVisibility: {
        ...state.layerVisibility,
        [layer]: visible,
      },
    })),

  selectZone: (id: string | null) =>
    set({
      selection: { selectedZoneId: id, resizeHandle: null },
    }),

  clearSelection: () =>
    set({
      selection: { selectedZoneId: null, resizeHandle: null },
    }),

  setResizeHandle: (handle: ZoneResizeHandle | null) =>
    set((state) => ({
      selection: { ...state.selection, resizeHandle: handle },
    })),

  setSaveStatus: (status: SaveStatus) => set({ saveStatus: status }),

  incrementVersion: () =>
    set((state) => ({ version: state.version + 1 })),
}));
