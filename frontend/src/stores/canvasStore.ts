import { create } from 'zustand';
import { CanvasMode } from '@/types/database';
import type { TemplateZone } from '@/types/database';
import {
  CanvasLayer,
  type BoundingBox,
  type GridConfig,
  type LayerVisibility,
  type SaveStatus,
  type SelectionState,
  type ViewportState,
  type ZoneResizeHandle,
} from '@/types/canvas';
import { constrainToWall, hasOverlap } from '@/canvas/utils/zoneConstraints';

export interface CanvasState {
  mode: CanvasMode;
  viewport: ViewportState;
  gridConfig: GridConfig;
  layerVisibility: LayerVisibility;
  selection: SelectionState;
  saveStatus: SaveStatus;
  version: number;
  clipboard: TemplateZone[] | null;
  highlightedZoneIds: string[];
  highlightedBomLineIds: string[];
}

export interface CanvasActions {
  setMode: (mode: CanvasMode) => void;
  setZoom: (level: number) => void;
  pan: (dx: number, dy: number) => void;
  resetViewport: () => void;
  toggleLayer: (layer: CanvasLayer) => void;
  setLayerVisibility: (layer: CanvasLayer, visible: boolean) => void;
  selectZone: (id: string | null) => void;
  toggleZoneSelection: (id: string) => void;
  selectZonesInRect: (rect: BoundingBox, zones: TemplateZone[]) => void;
  setMarqueeRect: (rect: BoundingBox | null) => void;
  clearSelection: () => void;
  setResizeHandle: (handle: ZoneResizeHandle | null) => void;
  setSaveStatus: (status: SaveStatus) => void;
  incrementVersion: () => void;
  copySelection: (zones: TemplateZone[]) => void;
  pasteClipboard: (
    zones: TemplateZone[],
    wallWidth: number,
    wallHeight: number,
    pushHistory: (zones: TemplateZone[]) => void,
  ) => TemplateZone[];
  duplicateSelection: (
    zones: TemplateZone[],
    wallWidth: number,
    wallHeight: number,
    pushHistory: (zones: TemplateZone[]) => void,
  ) => TemplateZone[];
  setHighlightedZoneIds: (ids: string[]) => void;
  setHighlightedBomLineIds: (ids: string[]) => void;
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
    selectedZoneIds: [],
    resizeHandle: null,
    marqueeRect: null,
  },
  saveStatus: 'saved',
  version: 1,
  clipboard: null,
  highlightedZoneIds: [],
  highlightedBomLineIds: [],
};

/** Shared paste logic used by both pasteClipboard and duplicateSelection. */
function performPaste(
  clipboard: TemplateZone[],
  zones: TemplateZone[],
  wallWidth: number,
  wallHeight: number,
  pushHistory: (zones: TemplateZone[]) => void,
  setSelection: (selection: SelectionState) => void,
): TemplateZone[] {
  if (clipboard.length === 0) return [];

  // Push history before mutation
  pushHistory(zones);

  const PASTE_OFFSET = 100;
  const newZones: TemplateZone[] = [];

  for (const zone of clipboard) {
    let offsetX = zone.x_mm + PASTE_OFFSET;
    let offsetY = zone.y_mm + PASTE_OFFSET;

    // Constrain to wall
    const constrained = constrainToWall(offsetX, offsetY, zone.width_mm, zone.height_mm, wallWidth, wallHeight);
    offsetX = constrained.x;
    offsetY = constrained.y;

    // Check overlap and try additional offsets if needed
    const allZones = [...zones, ...newZones];
    let box: BoundingBox = { x: offsetX, y: offsetY, width: zone.width_mm, height: zone.height_mm };
    let attempts = 0;
    while (hasOverlap(box, allZones) && attempts < 10) {
      offsetX += PASTE_OFFSET;
      offsetY += PASTE_OFFSET;
      const re = constrainToWall(offsetX, offsetY, zone.width_mm, zone.height_mm, wallWidth, wallHeight);
      offsetX = re.x;
      offsetY = re.y;
      box = { x: offsetX, y: offsetY, width: zone.width_mm, height: zone.height_mm };
      attempts++;
    }

    const newZone: TemplateZone = {
      ...zone,
      id: crypto.randomUUID(),
      x_mm: offsetX,
      y_mm: offsetY,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    newZones.push(newZone);
  }

  // Select the new zones
  const newIds = newZones.map((z: TemplateZone) => z.id);
  setSelection({
    selectedZoneId: newIds[0] ?? null,
    selectedZoneIds: newIds,
    resizeHandle: null,
    marqueeRect: null,
  });

  return newZones;
}

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
      selection: {
        selectedZoneId: id,
        selectedZoneIds: id ? [id] : [],
        resizeHandle: null,
        marqueeRect: null,
      },
    }),

  toggleZoneSelection: (id: string) =>
    set((state) => {
      const current = state.selection.selectedZoneIds;
      const newIds = current.includes(id)
        ? current.filter((zid) => zid !== id)
        : [...current, id];
      return {
        selection: {
          selectedZoneId: newIds.length > 0 ? newIds[0] : null,
          selectedZoneIds: newIds,
          resizeHandle: null,
          marqueeRect: null,
        },
      };
    }),

  selectZonesInRect: (rect: BoundingBox, zones: TemplateZone[]) =>
    set(() => {
      const selected = zones.filter((zone) => {
        const zoneBox = { x: zone.x_mm, y: zone.y_mm, width: zone.width_mm, height: zone.height_mm };
        // Check intersection between rect and zone bounding box
        return (
          rect.x < zoneBox.x + zoneBox.width &&
          rect.x + rect.width > zoneBox.x &&
          rect.y < zoneBox.y + zoneBox.height &&
          rect.y + rect.height > zoneBox.y
        );
      });
      const ids = selected.map((z) => z.id);
      return {
        selection: {
          selectedZoneId: ids.length > 0 ? ids[0] : null,
          selectedZoneIds: ids,
          resizeHandle: null,
          marqueeRect: null,
        },
      };
    }),

  setMarqueeRect: (rect: BoundingBox | null) =>
    set((state) => ({
      selection: { ...state.selection, marqueeRect: rect },
    })),

  clearSelection: () =>
    set({
      selection: {
        selectedZoneId: null,
        selectedZoneIds: [],
        resizeHandle: null,
        marqueeRect: null,
      },
    }),

  setResizeHandle: (handle: ZoneResizeHandle | null) =>
    set((state) => ({
      selection: {
        ...state.selection,
        resizeHandle: handle,
      },
    })),

  setSaveStatus: (status: SaveStatus) => set({ saveStatus: status }),

  incrementVersion: () =>
    set((state) => ({ version: state.version + 1 })),

  copySelection: (zones: TemplateZone[]) =>
    set((state) => {
      const { selectedZoneIds } = state.selection;
      if (selectedZoneIds.length === 0) return {};
      const selectedZones = zones.filter((z) => selectedZoneIds.includes(z.id));
      if (selectedZones.length === 0) return {};
      // Deep copy
      const clipboard = selectedZones.map((z) => ({ ...z }));
      return { clipboard };
    }),

  pasteClipboard: (
    zones: TemplateZone[],
    wallWidth: number,
    wallHeight: number,
    pushHistory: (zones: TemplateZone[]) => void,
  ): TemplateZone[] => {
    const state = useCanvasStore.getState();
    const { clipboard } = state;
    if (!clipboard || clipboard.length === 0) return [];
    return performPaste(clipboard, zones, wallWidth, wallHeight, pushHistory, (selection) => set({ selection }));
  },

  duplicateSelection: (
    zones: TemplateZone[],
    wallWidth: number,
    wallHeight: number,
    pushHistory: (zones: TemplateZone[]) => void,
  ): TemplateZone[] => {
    const state = useCanvasStore.getState();
    const { selectedZoneIds } = state.selection;
    if (selectedZoneIds.length === 0) return [];

    const selectedZones = zones.filter((z: TemplateZone) => selectedZoneIds.includes(z.id));
    if (selectedZones.length === 0) return [];

    // Use the selected zones as clipboard directly
    const clipboard = selectedZones.map((z: TemplateZone) => ({ ...z }));
    set({ clipboard });
    return performPaste(clipboard, zones, wallWidth, wallHeight, pushHistory, (selection) => set({ selection }));
  },

  setHighlightedZoneIds: (ids: string[]) => set({ highlightedZoneIds: ids }),

  setHighlightedBomLineIds: (ids: string[]) => set({ highlightedBomLineIds: ids }),
}));
