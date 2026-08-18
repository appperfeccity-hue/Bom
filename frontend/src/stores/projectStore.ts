import { create } from 'zustand';
import type {
  Template,
  TemplateZone,
  TemplateLighting,
  TemplateFurniture,
  TemplateTrim,
  Project,
  ProjectSnapshot,
  ProjectMeasurement,
  SkuMaster,
  WallGeometryType,
} from '@/types/database';
import type { WallConfigInput, PanelFrame } from '@/engines/types';
import { fromTable } from '@/lib/supabase';
import { readSnapshot } from '@/lib/snapshotReader';
import type { SnapshotAlternative, SnapshotConsultantPermission } from '@/lib/snapshotReader';
import { createDebouncedSave } from '@/lib/autosave';
import type { SaveStatus } from '@/types/canvas';
import { useCanvasStore } from '@/stores/canvasStore';
import { assignSegment } from '@/canvas/utils/segmentAssignment';
import { ZoneWidthStrategy, ZoneHeightStrategy, ZonePositionStrategy } from '@/types/database';

export interface ProjectState {
  currentTemplate: Template | null;
  currentProject: Project | null;
  currentSnapshot: ProjectSnapshot | null;
  zones: TemplateZone[];
  zoneSku: Map<string, SkuMaster>;
  /** Substitutable SKUs frozen into the snapshot, keyed by zone */
  zoneAlternatives: Map<string, SnapshotAlternative[]>;
  /** Consultant permissions frozen into the snapshot */
  consultantPermissions: SnapshotConsultantPermission[];
  lighting: TemplateLighting[];
  furniture: TemplateFurniture[];
  trims: TemplateTrim[];
  measurements: ProjectMeasurement | null;
  wallGeometry: WallGeometryType;
  /** Wall configuration from Amendment 001 */
  wallConfig: WallConfigInput | null;
  /** Generated panel frames from wall config engine */
  panelFrames: PanelFrame[];
  isLoading: boolean;
  error: string | null;
}

export interface ProjectActions {
  loadTemplate: (id: string) => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  updateZone: (zone: TemplateZone) => Promise<void>;
  addZone: (zone: Omit<TemplateZone, 'zone_id' | 'created_at'>) => Promise<void>;
  removeZone: (zoneId: string) => Promise<void>;
  assignSku: (zoneId: string, skuId: string) => Promise<void>;
  removeSku: (zoneId: string) => Promise<void>;
  updateMeasurements: (measurements: Partial<ProjectMeasurement>) => Promise<void>;
  /** Set wall config and generated panel frames; populates zones from frames */
  setWallConfigAndFrames: (config: WallConfigInput, frames: PanelFrame[]) => void;
  /** Populate the zones array from generated panel frames (each frame becomes a read-only zone) */
  populateZonesFromFrames: (frames: PanelFrame[]) => void;
  reset: () => void;
}

export type ProjectStore = ProjectState & ProjectActions;

const initialState: ProjectState = {
  currentTemplate: null,
  currentProject: null,
  currentSnapshot: null,
  zones: [],
  zoneSku: new Map(),
  zoneAlternatives: new Map(),
  consultantPermissions: [],
  lighting: [],
  furniture: [],
  trims: [],
  measurements: null,
  wallGeometry: 'STRAIGHT',
  wallConfig: null,
  panelFrames: [],
  isLoading: false,
  error: null,
};

/**
 * Shown when a project-context edit would have to be written to the designer-owned
 * `template_*` tables. Projects read from the immutable snapshot, so such a write
 * would mutate the shared template and be discarded on the next load.
 */
export const PROJECT_TEMPLATE_WRITE_BLOCKED =
  'This change was not saved. Editing zones or SKUs inside a project is not available yet — ' +
  'the project reads a frozen snapshot, and saving would modify the shared designer template.';

/**
 * Module-level autosave debouncer instance, created lazily.
 * Wraps zone-persistence calls with debounce and save-status transitions.
 * Uses a Map keyed by zone ID so that concurrent zone updates within the
 * debounce window are all persisted when the debounce fires.
 */
let autosaver: ReturnType<typeof createDebouncedSave> | null = null;
const pendingZoneUpdates = new Map<string, () => Promise<void>>();

function getAutosaver(onStatusChange: (status: SaveStatus) => void): ReturnType<typeof createDebouncedSave> {
  if (!autosaver) {
    autosaver = createDebouncedSave(
      async (version: number) => {
        const entries = Array.from(pendingZoneUpdates.values());
        pendingZoneUpdates.clear();
        await Promise.all(entries.map((fn) => fn()));
        return { version: version + 1 };
      },
      onStatusChange,
      2000,
    );
  }
  return autosaver;
}

/**
 * True when the store holds a project (snapshot-backed), in which case zone and SKU
 * mutations must not fall through to the designer template. Reports the rejection
 * through the store error and the save-status indicator.
 */
function rejectTemplateWrite(
  get: () => ProjectStore,
  set: (partial: Partial<ProjectStore>) => void,
): boolean {
  if (!get().currentProject) return false;
  set({ error: PROJECT_TEMPLATE_WRITE_BLOCKED });
  useCanvasStore.getState().setSaveStatus('error');
  return true;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  ...initialState,

  loadTemplate: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: template, error: tErr } = await fromTable('template')
        .select('*')
        .eq('template_id', id)
        .single();
      if (tErr) throw tErr;

      const { data: zones, error: zErr } = await fromTable('template_zone')
        .select('*')
        .eq('template_id', id);
      if (zErr) throw zErr;

      const { data: lighting, error: lErr } = await fromTable('template_lighting')
        .select('*')
        .eq('template_id', id);
      if (lErr) throw lErr;

      const { data: furniture, error: fErr } = await fromTable('template_furniture')
        .select('*')
        .eq('template_id', id);
      if (fErr) throw fErr;

      const { data: trims, error: trErr } = await fromTable('template_trim')
        .select('*')
        .eq('template_id', id);
      if (trErr) throw trErr;

      set({
        currentTemplate: template as Template,
        zones: (zones ?? []) as TemplateZone[],
        lighting: (lighting ?? []) as TemplateLighting[],
        furniture: (furniture ?? []) as TemplateFurniture[],
        trims: (trims ?? []) as TemplateTrim[],
        wallGeometry: (template as Template).wall_geometry.type,
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  loadProject: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: project, error: pErr } = await fromTable('project')
        .select('*')
        .eq('project_id', id)
        .single();
      if (pErr) throw pErr;

      const { data: measurements, error: mErr } = await fromTable('project_measurement')
        .select('*')
        .eq('project_id', id)
        .single();
      if (mErr && mErr.code !== 'PGRST116') throw mErr;

      const { data: snapshot, error: sErr } = await fromTable('project_snapshot')
        .select('*')
        .eq('project_id', id)
        .single();
      if (sErr) throw sErr;

      // The project executes against its frozen snapshot, never against the
      // live template: later designer edits must not reach an existing project.
      const typedSnapshot = snapshot as ProjectSnapshot;
      const hydrated = readSnapshot(typedSnapshot.snapshot_data, typedSnapshot.template_id);

      set({
        currentProject: project as Project,
        currentSnapshot: typedSnapshot,
        measurements: (measurements as ProjectMeasurement) ?? null,
        currentTemplate: hydrated.template,
        zones: hydrated.zones,
        zoneSku: hydrated.zoneSku,
        zoneAlternatives: hydrated.zoneAlternatives,
        lighting: hydrated.lighting,
        furniture: hydrated.furniture,
        trims: hydrated.trims,
        consultantPermissions: hydrated.consultantPermissions,
        wallGeometry: hydrated.wallGeometry.type,
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  updateZone: async (zone: TemplateZone) => {
    // Guard: prevent mutations on a finalized project
    if (get().currentProject?.status === 'FINALIZED') return;
    if (rejectTemplateWrite(get, set)) return;

    // Auto-compute segment based on position for L_CORNER walls
    const { wallGeometry, measurements } = get();
    if (wallGeometry === 'L_CORNER' && measurements?.segment_a_width_mm != null) {
      zone = {
        ...zone,
        segment: assignSegment(
          { x_mm: zone.x_mm, y_mm: zone.y_mm, width_mm: zone.width_mm, height_mm: zone.height_mm },
          { x: measurements.segment_a_width_mm, y: 0 },
          wallGeometry,
        ),
      };
    } else {
      zone = { ...zone, segment: null };
    }

    // Optimistic update
    const prevZones = get().zones;
    set({
      zones: prevZones.map((z) => (z.zone_id === zone.zone_id ? zone : z)),
    });

    // Schedule debounced persistence with save-status transitions.
    // Each zone update is stored by zone ID so concurrent updates within
    // the debounce window are all persisted (not just the last one).
    const saver = getAutosaver((status) => useCanvasStore.getState().setSaveStatus(status));
    pendingZoneUpdates.set(zone.zone_id, async () => {
      const { error } = await fromTable('template_zone')
        .update({
          x_mm: zone.x_mm,
          y_mm: zone.y_mm,
          width_mm: zone.width_mm,
          height_mm: zone.height_mm,
          width_strategy: zone.width_strategy,
          height_strategy: zone.height_strategy,
          position_strategy: zone.position_strategy,
        })
        .eq('zone_id', zone.zone_id);
      if (error) {
        // Rollback on failure
        set({ zones: prevZones, error: error.message });
        throw error;
      }
    });
    saver.debouncedSave(useCanvasStore.getState().version);
  },

  addZone: async (zone) => {
    // Guard: prevent mutations on a finalized project
    if (get().currentProject?.status === 'FINALIZED') return;
    if (rejectTemplateWrite(get, set)) return;

    try {
      const { data, error } = await fromTable('template_zone')
        .insert(zone)
        .select()
        .single();
      if (error) throw error;
      set({ zones: [...get().zones, data as TemplateZone] });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  removeZone: async (zoneId: string) => {
    // Guard: prevent mutations on a finalized project
    if (get().currentProject?.status === 'FINALIZED') return;
    if (rejectTemplateWrite(get, set)) return;

    const prevZones = get().zones;
    set({ zones: prevZones.filter((z) => z.zone_id !== zoneId) });

    try {
      const { error } = await fromTable('template_zone').delete().eq('zone_id', zoneId);
      if (error) throw error;
      // Also remove the SKU mapping
      const newSkuMap = new Map(get().zoneSku);
      newSkuMap.delete(zoneId);
      set({ zoneSku: newSkuMap });
    } catch (err) {
      set({ zones: prevZones, error: (err as Error).message });
    }
  },

  assignSku: async (zoneId: string, skuId: string) => {
    // Guard: prevent mutations on a finalized project
    if (get().currentProject?.status === 'FINALIZED') return;
    if (rejectTemplateWrite(get, set)) return;

    try {
      // Upsert zone-sku mapping
      const { error: zsErr } = await fromTable('template_zone_sku')
        .upsert({ zone_id: zoneId, sku_id: skuId }, { onConflict: 'zone_id' });
      if (zsErr) throw zsErr;

      // Fetch the SKU data
      const { data: sku, error: sErr } = await fromTable('sku_master')
        .select('*')
        .eq('sku_id', skuId)
        .single();
      if (sErr) throw sErr;

      const newSkuMap = new Map(get().zoneSku);
      newSkuMap.set(zoneId, sku as SkuMaster);
      set({ zoneSku: newSkuMap });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  removeSku: async (zoneId: string) => {
    // Guard: prevent mutations on a finalized project
    if (get().currentProject?.status === 'FINALIZED') return;
    if (rejectTemplateWrite(get, set)) return;

    const prevSkuMap = get().zoneSku;
    const newSkuMap = new Map(prevSkuMap);
    newSkuMap.delete(zoneId);
    set({ zoneSku: newSkuMap });

    try {
      const { error } = await fromTable('template_zone_sku').delete().eq('zone_id', zoneId);
      if (error) throw error;
    } catch (err) {
      // Rollback on failure
      set({ zoneSku: prevSkuMap, error: (err as Error).message });
    }
  },

  updateMeasurements: async (measurements: Partial<ProjectMeasurement>) => {
    // Guard: prevent mutations on a finalized project
    if (get().currentProject?.status === 'FINALIZED') return;

    const prev = get().measurements;
    const updated = { ...prev, ...measurements } as ProjectMeasurement;
    set({ measurements: updated });

    try {
      const { error } = await fromTable('project_measurement')
        .update(measurements)
        .eq('project_id', updated.project_id);
      if (error) throw error;
    } catch (err) {
      set({ measurements: prev, error: (err as Error).message });
    }
  },

  reset: () => set(initialState),

  setWallConfigAndFrames: (config: WallConfigInput, frames: PanelFrame[]) => {
    // Guard: prevent mutations on a finalized project
    if (get().currentProject?.status === 'FINALIZED') return;

    set({ wallConfig: config, panelFrames: frames });
    // Populate zones from frames
    get().populateZonesFromFrames(frames);
  },

  populateZonesFromFrames: (frames: PanelFrame[]) => {
    // Guard: prevent mutations on a finalized project
    if (get().currentProject?.status === 'FINALIZED') return;

    // Convert each PanelFrame to a TemplateZone-like object for canvas rendering.
    // Zones generated from panel frames are read-only (Rule 64, Rule 65).
    const zonesFromFrames: TemplateZone[] = frames.map((frame) => ({
      zone_id: frame.frame_id,
      template_id: get().currentTemplate?.template_id ?? '',
      segment: frame.segment,
      x_mm: frame.x_mm,
      y_mm: frame.y_mm,
      width_mm: frame.width_mm,
      height_mm: frame.height_mm,
      width_strategy: ZoneWidthStrategy.LOCKED,
      height_strategy: ZoneHeightStrategy.FIXED,
      position_strategy: ZonePositionStrategy.FIXED,
      created_at: new Date().toISOString(),
    }));
    set({ zones: zonesFromFrames });
  },
}));
