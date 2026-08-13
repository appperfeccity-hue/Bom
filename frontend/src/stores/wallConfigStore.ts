import { create } from 'zustand';
import type {
  WallConfigInput,
  PanelFrame,
  WallType,
  FitAlgorithm,
  WallMountingType,
  Obstruction,
} from '@/engines/types';
import { generatePanelFrames } from '@/engines/wallConfigEngine';
import { useProjectStore } from '@/stores/projectStore';

/**
 * Consultant permission mode for wall configuration parameters.
 * Rule 72: Consultant can only change parameters explicitly marked ALLOWED by Designer.
 * Rule 73: Consultant cannot manually edit panel frames.
 */
export type WallParamPermission = 'LOCKED' | 'ALLOWED';

/**
 * Consultant wall permissions - one entry per wall/spacing parameter.
 */
export interface ConsultantWallPermissions {
  wall_width: WallParamPermission;
  wall_height: WallParamPermission;
  panel_gap: WallParamPermission;
  fit_algorithm: WallParamPermission;
  fit_intensity: WallParamPermission;
  mounting_type: WallParamPermission;
  rows: WallParamPermission;
  columns: WallParamPermission;
}

/** All wall config parameter keys that can be permission-controlled. */
export type WallParamKey = keyof ConsultantWallPermissions;

/** Default permissions: everything locked. */
export const DEFAULT_WALL_PERMISSIONS: ConsultantWallPermissions = {
  wall_width: 'LOCKED',
  wall_height: 'LOCKED',
  panel_gap: 'LOCKED',
  fit_algorithm: 'LOCKED',
  fit_intensity: 'LOCKED',
  mounting_type: 'LOCKED',
  rows: 'LOCKED',
  columns: 'LOCKED',
};

/** History entry for undo/redo. */
interface HistoryEntry {
  config: WallConfigInput;
  permissions: ConsultantWallPermissions;
}

export interface WallConfigState {
  /**
   * AUTHORITATIVE INPUTS — these are the source of truth.
   * Any change to config triggers frame regeneration.
   * The BOM pipeline always recomputes frames from these inputs.
   */
  config: WallConfigInput;

  /**
   * DERIVED STATE — cached for UI rendering performance only.
   * NEVER authoritative. Always regenerable from config.
   * Rule: generatePanelFrames(config) ALWAYS wins over this cache.
   * The BOM pipeline ignores this and recomputes from config directly.
   */
  panelFrames: PanelFrame[];

  /** Consultant permissions per parameter */
  permissions: ConsultantWallPermissions;
  /** Whether frame generation encountered an error */
  generationError: string | null;
  /** Undo history stack */
  undoStack: HistoryEntry[];
  /** Redo history stack */
  redoStack: HistoryEntry[];
}

export interface WallConfigActions {
  /** Set entire wall configuration and regenerate frames */
  setWallConfig: (config: Partial<WallConfigInput>) => void;
  /** Add an obstruction */
  addObstruction: (obstruction: Obstruction) => void;
  /** Remove an obstruction by index */
  removeObstruction: (index: number) => void;
  /** Update an obstruction by index */
  updateObstruction: (index: number, obstruction: Obstruction) => void;
  /** Regenerate frames from the current config */
  regenerateFrames: () => void;
  /** Set consultant permissions for a parameter */
  setPermission: (param: WallParamKey, permission: WallParamPermission) => void;
  /** Set all consultant permissions at once */
  setPermissions: (permissions: ConsultantWallPermissions) => void;
  /** Undo the last config change */
  undo: () => void;
  /** Redo a previously undone config change */
  redo: () => void;
  /** Check if undo is available */
  canUndo: () => boolean;
  /** Check if redo is available */
  canRedo: () => boolean;
  /** Reset to initial state */
  reset: () => void;
}

export type WallConfigStore = WallConfigState & WallConfigActions;

const DEFAULT_CONFIG: WallConfigInput = {
  wall_type: 'STRAIGHT' as WallType,
  total_width_mm: 3000,
  total_height_mm: 2400,
  rows: 1,
  columns: 3,
  panel_gap_mm: 0,
  fit_algorithm: 'EQUAL' as FitAlgorithm,
  fit_intensity_percent: 0,
  mounting_type: 'DIRECT' as WallMountingType,
  obstructions: [],
};

/** Maximum undo history size */
const MAX_HISTORY = 50;

/**
 * Safely generate panel frames, returning an error string on failure.
 */
function safeGenerateFrames(config: WallConfigInput): { frames: PanelFrame[]; error: string | null } {
  try {
    const frames = generatePanelFrames(config);
    return { frames, error: null };
  } catch (e) {
    return { frames: [], error: (e as Error).message };
  }
}

const initialGeneration = safeGenerateFrames(DEFAULT_CONFIG);

const initialState: WallConfigState = {
  config: DEFAULT_CONFIG,
  panelFrames: initialGeneration.frames,
  permissions: { ...DEFAULT_WALL_PERMISSIONS },
  generationError: initialGeneration.error,
  undoStack: [],
  redoStack: [],
};

export const useWallConfigStore = create<WallConfigStore>((set, get) => ({
  ...initialState,

  setWallConfig: (partial: Partial<WallConfigInput>) => {
    const state = get();
    const prevConfig = state.config;
    const prevPermissions = state.permissions;

    // Push current state to undo stack
    const newUndoStack = [...state.undoStack, { config: prevConfig, permissions: prevPermissions }];
    if (newUndoStack.length > MAX_HISTORY) {
      newUndoStack.shift();
    }

    const newConfig: WallConfigInput = { ...prevConfig, ...partial };
    const { frames, error } = safeGenerateFrames(newConfig);

    set({
      config: newConfig,
      panelFrames: frames,
      generationError: error,
      undoStack: newUndoStack,
      redoStack: [], // Clear redo stack on new change
    });
  },

  addObstruction: (obstruction: Obstruction) => {
    const state = get();
    const prevConfig = state.config;

    // Push current state to undo stack
    const newUndoStack = [...state.undoStack, { config: prevConfig, permissions: state.permissions }];
    if (newUndoStack.length > MAX_HISTORY) {
      newUndoStack.shift();
    }

    const newConfig: WallConfigInput = {
      ...prevConfig,
      obstructions: [...prevConfig.obstructions, obstruction],
    };
    const { frames, error } = safeGenerateFrames(newConfig);

    set({
      config: newConfig,
      panelFrames: frames,
      generationError: error,
      undoStack: newUndoStack,
      redoStack: [],
    });
  },

  removeObstruction: (index: number) => {
    const state = get();
    const prevConfig = state.config;

    const newUndoStack = [...state.undoStack, { config: prevConfig, permissions: state.permissions }];
    if (newUndoStack.length > MAX_HISTORY) {
      newUndoStack.shift();
    }

    const newObstructions = prevConfig.obstructions.filter((_, i) => i !== index);
    const newConfig: WallConfigInput = { ...prevConfig, obstructions: newObstructions };
    const { frames, error } = safeGenerateFrames(newConfig);

    set({
      config: newConfig,
      panelFrames: frames,
      generationError: error,
      undoStack: newUndoStack,
      redoStack: [],
    });
  },

  updateObstruction: (index: number, obstruction: Obstruction) => {
    const state = get();
    const prevConfig = state.config;

    const newUndoStack = [...state.undoStack, { config: prevConfig, permissions: state.permissions }];
    if (newUndoStack.length > MAX_HISTORY) {
      newUndoStack.shift();
    }

    const newObstructions = prevConfig.obstructions.map((o, i) => (i === index ? obstruction : o));
    const newConfig: WallConfigInput = { ...prevConfig, obstructions: newObstructions };
    const { frames, error } = safeGenerateFrames(newConfig);

    set({
      config: newConfig,
      panelFrames: frames,
      generationError: error,
      undoStack: newUndoStack,
      redoStack: [],
    });
  },

  regenerateFrames: () => {
    const { config } = get();
    const { frames, error } = safeGenerateFrames(config);
    set({ panelFrames: frames, generationError: error });
  },

  setPermission: (param: WallParamKey, permission: WallParamPermission) => {
    const state = get();
    set({
      permissions: { ...state.permissions, [param]: permission },
    });
  },

  setPermissions: (permissions: ConsultantWallPermissions) => {
    set({ permissions });
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;

    const prev = state.undoStack[state.undoStack.length - 1];
    const newUndoStack = state.undoStack.slice(0, -1);
    const newRedoStack = [...state.redoStack, { config: state.config, permissions: state.permissions }];

    const { frames, error } = safeGenerateFrames(prev.config);

    set({
      config: prev.config,
      permissions: prev.permissions,
      panelFrames: frames,
      generationError: error,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
    });
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;

    const next = state.redoStack[state.redoStack.length - 1];
    const newRedoStack = state.redoStack.slice(0, -1);
    const newUndoStack = [...state.undoStack, { config: state.config, permissions: state.permissions }];

    const { frames, error } = safeGenerateFrames(next.config);

    set({
      config: next.config,
      permissions: next.permissions,
      panelFrames: frames,
      generationError: error,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
    });
  },

  canUndo: () => get().undoStack.length > 0,

  canRedo: () => get().redoStack.length > 0,

  reset: () => {
    const generation = safeGenerateFrames(DEFAULT_CONFIG);
    set({
      ...initialState,
      panelFrames: generation.frames,
      generationError: generation.error,
    });
  },
}));

/**
 * Subscription that syncs wallConfigStore.panelFrames to projectStore.
 *
 * When wallConfigStore panel frames change, the subscription automatically
 * calls projectStore.setWallConfigAndFrames to keep both stores in sync.
 * This prevents the dual-store divergence issue where wallConfigStore.panelFrames
 * and projectStore.panelFrames/zones could hold different data.
 *
 * Call this function once (e.g., at app initialization) to activate the sync.
 * Returns an unsubscribe function for cleanup.
 */
export function initWallConfigStoreSync(
  projectStoreRef: {
    getState: () => { setWallConfigAndFrames: (config: WallConfigInput, frames: PanelFrame[]) => void };
  },
): () => void {
  let previousFrames = useWallConfigStore.getState().panelFrames;

  return useWallConfigStore.subscribe((state) => {
    // Only sync if panel frames reference changed
    if (state.panelFrames !== previousFrames) {
      previousFrames = state.panelFrames;
      projectStoreRef.getState().setWallConfigAndFrames(state.config, state.panelFrames);
    }
  });
}

/**
 * Self-initializing subscription: activate the store sync at module load.
 * This ensures the wallConfigStore and projectStore stay synchronized
 * without requiring an external consumer to call initWallConfigStoreSync.
 */
initWallConfigStoreSync(useProjectStore);
