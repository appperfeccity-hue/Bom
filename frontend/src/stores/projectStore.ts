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
  WallGeometry,
} from '@/types/database';
import { fromTable } from '@/lib/supabase';
import { createDebouncedSave } from '@/lib/autosave';
import type { SaveStatus } from '@/types/canvas';
import { useCanvasStore } from '@/stores/canvasStore';

export interface ProjectState {
  currentTemplate: Template | null;
  currentProject: Project | null;
  currentSnapshot: ProjectSnapshot | null;
  zones: TemplateZone[];
  zoneSku: Map<string, SkuMaster>;
  lighting: TemplateLighting[];
  furniture: TemplateFurniture[];
  trims: TemplateTrim[];
  measurements: ProjectMeasurement | null;
  wallGeometry: WallGeometry;
  isLoading: boolean;
  error: string | null;
}

export interface ProjectActions {
  loadTemplate: (id: string) => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  updateZone: (zone: TemplateZone) => Promise<void>;
  addZone: (zone: Omit<TemplateZone, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  removeZone: (id: string) => Promise<void>;
  assignSku: (zoneId: string, skuId: string) => Promise<void>;
  updateMeasurements: (measurements: Partial<ProjectMeasurement>) => Promise<void>;
  reset: () => void;
}

export type ProjectStore = ProjectState & ProjectActions;

const initialState: ProjectState = {
  currentTemplate: null,
  currentProject: null,
  currentSnapshot: null,
  zones: [],
  zoneSku: new Map(),
  lighting: [],
  furniture: [],
  trims: [],
  measurements: null,
  wallGeometry: 'STRAIGHT',
  isLoading: false,
  error: null,
};

/**
 * Module-level autosave debouncer instance, created lazily.
 * Wraps zone-persistence calls with debounce and save-status transitions.
 */
let autosaver: ReturnType<typeof createDebouncedSave> | null = null;
let pendingZoneUpdate: (() => Promise<void>) | null = null;

function getAutosaver(onStatusChange: (status: SaveStatus) => void): ReturnType<typeof createDebouncedSave> {
  if (!autosaver) {
    autosaver = createDebouncedSave(
      async (version: number) => {
        if (pendingZoneUpdate) {
          await pendingZoneUpdate();
          pendingZoneUpdate = null;
        }
        return { version: version + 1 };
      },
      onStatusChange,
      2000,
    );
  }
  return autosaver;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  ...initialState,

  loadTemplate: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: template, error: tErr } = await fromTable('template')
        .select('*')
        .eq('id', id)
        .single();
      if (tErr) throw tErr;

      const { data: zones, error: zErr } = await fromTable('template_zone')
        .select('*')
        .eq('template_id', id)
        .order('z_index');
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
        wallGeometry: (template as Template).wall_geometry,
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
        .eq('id', id)
        .single();
      if (pErr) throw pErr;

      const { data: measurements, error: mErr } = await fromTable('project_measurement')
        .select('*')
        .eq('project_id', id)
        .single();
      if (mErr && mErr.code !== 'PGRST116') throw mErr;

      set({
        currentProject: project as Project,
        measurements: (measurements as ProjectMeasurement) ?? null,
        wallGeometry: measurements
          ? (measurements as ProjectMeasurement).wall_geometry
          : get().wallGeometry,
        isLoading: false,
      });

      // Load associated template
      await get().loadTemplate((project as Project).template_id);
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  updateZone: async (zone: TemplateZone) => {
    // Optimistic update
    const prevZones = get().zones;
    set({
      zones: prevZones.map((z) => (z.id === zone.id ? zone : z)),
    });

    // Schedule debounced persistence with save-status transitions
    const saver = getAutosaver((status) => useCanvasStore.getState().setSaveStatus(status));
    pendingZoneUpdate = async () => {
      const { error } = await fromTable('template_zone')
        .update({
          x_mm: zone.x_mm,
          y_mm: zone.y_mm,
          width_mm: zone.width_mm,
          height_mm: zone.height_mm,
          name: zone.name,
          width_strategy: zone.width_strategy,
          height_strategy: zone.height_strategy,
          position_strategy: zone.position_strategy,
          z_index: zone.z_index,
        })
        .eq('id', zone.id);
      if (error) {
        // Rollback on failure
        set({ zones: prevZones, error: error.message });
        throw error;
      }
    };
    saver.debouncedSave(useCanvasStore.getState().version);
  },

  addZone: async (zone) => {
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

  removeZone: async (id: string) => {
    const prevZones = get().zones;
    set({ zones: prevZones.filter((z) => z.id !== id) });

    try {
      const { error } = await fromTable('template_zone').delete().eq('id', id);
      if (error) throw error;
      // Also remove the SKU mapping
      const newSkuMap = new Map(get().zoneSku);
      newSkuMap.delete(id);
      set({ zoneSku: newSkuMap });
    } catch (err) {
      set({ zones: prevZones, error: (err as Error).message });
    }
  },

  assignSku: async (zoneId: string, skuId: string) => {
    try {
      // Upsert zone-sku mapping
      const { error: zsErr } = await fromTable('template_zone_sku')
        .upsert({ zone_id: zoneId, sku_id: skuId }, { onConflict: 'zone_id' });
      if (zsErr) throw zsErr;

      // Fetch the SKU data
      const { data: sku, error: sErr } = await fromTable('sku_master')
        .select('*')
        .eq('id', skuId)
        .single();
      if (sErr) throw sErr;

      const newSkuMap = new Map(get().zoneSku);
      newSkuMap.set(zoneId, sku as SkuMaster);
      set({ zoneSku: newSkuMap });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  updateMeasurements: async (measurements: Partial<ProjectMeasurement>) => {
    const prev = get().measurements;
    const updated = { ...prev, ...measurements } as ProjectMeasurement;
    set({ measurements: updated });

    try {
      const { error } = await fromTable('project_measurement')
        .update(measurements)
        .eq('id', updated.id);
      if (error) throw error;
    } catch (err) {
      set({ measurements: prev, error: (err as Error).message });
    }
  },

  reset: () => set(initialState),
}));
