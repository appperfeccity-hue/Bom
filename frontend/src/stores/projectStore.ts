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
  ProjectWallConfiguration,
  ProjectObstruction,
  SkuMaster,
  WallGeometry,
  WallGeometryType,
  TemplateConsultantPermission,
} from '@/types/database';
import type { WallConfigInput, PanelFrame } from '@/engines/types';
import { fromTable } from '@/lib/supabase';
import { assignSegment } from '@/canvas/utils/segmentAssignment';
import { isLShape } from '@/engines/wallType';
import {
  MAX_ZONES_PER_WALL,
  canAddZone,
  isZoneWithinInstallationArea,
  resolveInstallationArea,
} from '@/engines/installationArea';
import type { InstallationArea } from '@/engines/types';
import { ErrorCode, createPipelineError } from '@/engines/errorCatalogue';
import { ZoneWidthStrategy, ZoneHeightStrategy, ZonePositionStrategy } from '@/types/database';

// --- Permission checking types ---

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

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
  obstructions: ProjectObstruction[];
  wallGeometry: WallGeometryType;
  /** Wall configuration from Amendment 001 */
  wallConfig: WallConfigInput | null;
  /** Generated panel frames from wall config engine */
  panelFrames: PanelFrame[];
  /**
   * Installation area authored for this wall. Null means FULL wall coverage.
   * Zones are bounded by its outer edge, not by the wall itself.
   */
  installationArea: InstallationArea | null;
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
  /** Save wall configuration to project_wall_configuration table */
  saveWallConfig: (config: Omit<ProjectWallConfiguration, 'project_wall_config_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  /** Load obstructions for the current project */
  loadObstructions: (projectId: string) => Promise<void>;
  /** Add an obstruction */
  addObstruction: (obstruction: Omit<ProjectObstruction, 'obstruction_id' | 'created_at'>) => Promise<void>;
  /** Update an existing obstruction */
  updateObstruction: (obstruction: ProjectObstruction) => Promise<void>;
  /** Remove an obstruction */
  removeObstruction: (obstructionId: string) => Promise<void>;
  /** Check consultant permission for a parameter */
  checkPermission: (parameterKey: string, value: unknown) => PermissionCheckResult;
  /** Set the installation area (parent boundary of all zones) */
  setInstallationArea: (area: InstallationArea | null) => void;
  /** Resolve the effective installation area against the current wall size */
  getInstallationArea: () => InstallationArea;
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
  lighting: [],
  furniture: [],
  trims: [],
  measurements: null,
  obstructions: [],
  wallGeometry: 'STRAIGHT',
  wallConfig: null,
  panelFrames: [],
  installationArea: null,
  isLoading: false,
  error: null,
};

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

      const typedProject = project as Project;

      // Fetch snapshot by snapshot_id (if present)
      let snapshot: ProjectSnapshot | null = null;
      if (typedProject.snapshot_id) {
        const { data: snapshotData, error: sErr } = await fromTable('project_snapshot')
          .select('*')
          .eq('snapshot_id', typedProject.snapshot_id)
          .single();
        if (sErr && sErr.code !== 'PGRST116') throw sErr;
        snapshot = (snapshotData as ProjectSnapshot) ?? null;
      }

      // Fetch project measurement
      const { data: measurements, error: mErr } = await fromTable('project_measurement')
        .select('*')
        .eq('project_id', id)
        .single();
      if (mErr && mErr.code !== 'PGRST116') throw mErr;

      // Hydrate zones/lighting/furniture/trims from snapshot_data if available
      const snapshotPayload = snapshot?.snapshot_data as Record<string, unknown> | undefined;
      let hydratedZones: TemplateZone[] = [];
      let hydratedLighting: TemplateLighting[] = [];
      let hydratedFurniture: TemplateFurniture[] = [];
      let hydratedTrims: TemplateTrim[] = [];
      let hydratedZoneSku = new Map<string, SkuMaster>();
      let hydratedWallGeometry: WallGeometryType = 'STRAIGHT';

      if (snapshotPayload) {
        // Hydrate zones
        const rawZones = (snapshotPayload.zones as Array<Record<string, unknown>>) ?? [];
        hydratedZones = rawZones.map((z) => ({
          zone_id: z.zone_id as string,
          template_id: typedProject.template_id,
          segment: (z.segment as TemplateZone['segment']) ?? null,
          x_mm: z.x_mm as number,
          y_mm: z.y_mm as number,
          width_mm: z.width_mm as number,
          height_mm: z.height_mm as number,
          width_strategy: (z.width_strategy as string) as ZoneWidthStrategy,
          height_strategy: (z.height_strategy as string) as ZoneHeightStrategy,
          position_strategy: (z.position_strategy as string) as ZonePositionStrategy,
          created_at: '',
        }));

        // Hydrate zone SKU map
        for (const z of rawZones) {
          if (z.primary_sku) {
            hydratedZoneSku.set(z.zone_id as string, z.primary_sku as unknown as SkuMaster);
          }
        }

        // Hydrate lighting/furniture/trims
        hydratedLighting = ((snapshotPayload.lighting as TemplateLighting[]) ?? []);
        hydratedFurniture = ((snapshotPayload.furniture as TemplateFurniture[]) ?? []);
        hydratedTrims = ((snapshotPayload.trims as TemplateTrim[]) ?? []);

        // Hydrate wall geometry
        const wallGeo = snapshotPayload.wall_geometry as WallGeometry | undefined;
        if (wallGeo) {
          hydratedWallGeometry = wallGeo.type;
        }
      }

      set({
        currentProject: typedProject,
        currentSnapshot: snapshot,
        zones: hydratedZones,
        zoneSku: hydratedZoneSku,
        lighting: hydratedLighting,
        furniture: hydratedFurniture,
        trims: hydratedTrims,
        measurements: (measurements as ProjectMeasurement) ?? null,
        wallGeometry: hydratedWallGeometry,
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  updateZone: async (zone: TemplateZone) => {
    // Guard: prevent mutations on a finalized project
    if (get().currentProject?.status === 'FINALIZED') return;

    // Auto-compute segment based on position for L_SHAPE (legacy L_CORNER) walls
    const { wallGeometry, measurements } = get();
    if (isLShape(wallGeometry) && measurements?.segment_a_width_mm != null) {
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

    // In-memory only update (project-scoped, no template_zone writes).
    // Zone changes are persisted via Phase 4's save_actual_bom as part of configuration_data.
    set({
      zones: get().zones.map((z) => (z.zone_id === zone.zone_id ? zone : z)),
    });
  },

  addZone: async (zone) => {
    // Guard: prevent mutations on a finalized project
    if (get().currentProject?.status === 'FINALIZED') return;

    // Spec sections 11/14: at most three zones per wall. Mirrors the
    // trg_template_zone_max_count DB guard added in v1.2.4.
    if (!canAddZone(get().zones.length)) {
      set({
        error: createPipelineError(ErrorCode.GEO_ZONE_COUNT_EXCEEDED, {
          count: get().zones.length + 1,
          maxAllowed: MAX_ZONES_PER_WALL,
        }).message,
      });
      return;
    }

    // Zones are bounded by the installation-area outer edge, not the full wall.
    const area = get().getInstallationArea();
    const bounded = area.outerEdge.width_mm > 0 && area.outerEdge.height_mm > 0;
    if (bounded && !isZoneWithinInstallationArea(zone, area)) {
      set({
        error: createPipelineError(ErrorCode.GEO_ZONE_OUTSIDE_WALL, {
          coverage: area.coverage,
          outerEdge: area.outerEdge,
        }).message,
      });
      return;
    }

    // In-memory only (project-scoped, no template_zone writes).
    // Zone changes are persisted via Phase 4's save_actual_bom as part of configuration_data.
    const newZone: TemplateZone = {
      ...zone,
      zone_id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    set({ zones: [...get().zones, newZone] });
  },

  removeZone: async (zoneId: string) => {
    // Guard: prevent mutations on a finalized project
    if (get().currentProject?.status === 'FINALIZED') return;

    // In-memory only (project-scoped, no template_zone writes).
    set({ zones: get().zones.filter((z) => z.zone_id !== zoneId) });
    // Also remove the SKU mapping
    const newSkuMap = new Map(get().zoneSku);
    newSkuMap.delete(zoneId);
    set({ zoneSku: newSkuMap });
  },

  assignSku: async (zoneId: string, skuId: string) => {
    // Guard: prevent mutations on a finalized project
    if (get().currentProject?.status === 'FINALIZED') return;

    // In-memory only (project-scoped, no template_zone_sku writes).
    // SKU substitutions are persisted via Phase 4's save_actual_bom as part of configuration_data.
    // Look up SKU data from snapshot sku_compatibility or zones alternatives
    const snapshotPayload = get().currentSnapshot?.snapshot_data as Record<string, unknown> | undefined;
    let skuData: SkuMaster | null = null;

    // Try to find SKU from snapshot zones primary_sku or alternatives
    if (snapshotPayload) {
      const rawZones = (snapshotPayload.zones as Array<Record<string, unknown>>) ?? [];
      for (const z of rawZones) {
        if ((z.primary_sku as Record<string, unknown>)?.sku_id === skuId) {
          skuData = z.primary_sku as unknown as SkuMaster;
          break;
        }
        const alternatives = (z.alternatives as Array<Record<string, unknown>>) ?? [];
        for (const alt of alternatives) {
          if (alt.sku_id === skuId) {
            skuData = alt as unknown as SkuMaster;
            break;
          }
        }
        if (skuData) break;
      }
    }

    // If not found in snapshot, create a minimal placeholder (will be resolved by BOM pipeline)
    if (!skuData) {
      skuData = { sku_id: skuId } as SkuMaster;
    }

    const newSkuMap = new Map(get().zoneSku);
    newSkuMap.set(zoneId, skuData);
    set({ zoneSku: newSkuMap });
  },

  removeSku: async (zoneId: string) => {
    // Guard: prevent mutations on a finalized project
    if (get().currentProject?.status === 'FINALIZED') return;

    // In-memory only (project-scoped, no template_zone_sku writes).
    const newSkuMap = new Map(get().zoneSku);
    newSkuMap.delete(zoneId);
    set({ zoneSku: newSkuMap });
  },

  updateMeasurements: async (measurements: Partial<ProjectMeasurement>) => {
    // Guard: prevent mutations on a finalized project
    if (get().currentProject?.status === 'FINALIZED') return;

    const prev = get().measurements;
    const projectId = get().currentProject?.project_id;
    if (!projectId) return;

    const updated = { ...prev, ...measurements, project_id: projectId } as ProjectMeasurement;
    set({ measurements: updated });

    try {
      // Use upsert with onConflict on project_id since the row may not exist yet
      const { error } = await fromTable('project_measurement')
        .upsert(
          {
            ...measurements,
            project_id: projectId,
          },
          { onConflict: 'project_id' },
        );
      if (error) throw error;
    } catch (err) {
      set({ measurements: prev, error: (err as Error).message });
    }
  },

  saveWallConfig: async (config) => {
    // Guard: prevent mutations on a finalized project
    if (get().currentProject?.status === 'FINALIZED') return;

    const projectId = get().currentProject?.project_id;
    if (!projectId) return;

    try {
      const { error } = await fromTable('project_wall_configuration')
        .upsert(
          {
            ...config,
            project_id: projectId,
          },
          { onConflict: 'project_id' },
        );
      if (error) throw error;
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  loadObstructions: async (projectId: string) => {
    try {
      const { data, error } = await fromTable('project_obstruction')
        .select('*')
        .eq('project_id', projectId);
      if (error) throw error;
      set({ obstructions: (data ?? []) as ProjectObstruction[] });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  addObstruction: async (obstruction) => {
    // Guard: prevent mutations on a finalized project
    if (get().currentProject?.status === 'FINALIZED') return;

    try {
      const { data, error } = await fromTable('project_obstruction')
        .insert(obstruction)
        .select()
        .single();
      if (error) throw error;
      set({ obstructions: [...get().obstructions, data as ProjectObstruction] });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  updateObstruction: async (obstruction: ProjectObstruction) => {
    // Guard: prevent mutations on a finalized project
    if (get().currentProject?.status === 'FINALIZED') return;

    const prev = get().obstructions;
    set({
      obstructions: prev.map((o) =>
        o.obstruction_id === obstruction.obstruction_id ? obstruction : o,
      ),
    });

    try {
      const { error } = await fromTable('project_obstruction')
        .update({
          x_mm: obstruction.x_mm,
          y_mm: obstruction.y_mm,
          width_mm: obstruction.width_mm,
          height_mm: obstruction.height_mm,
          obstruction_type: obstruction.obstruction_type,
          label: obstruction.label,
        })
        .eq('obstruction_id', obstruction.obstruction_id);
      if (error) throw error;
    } catch (err) {
      set({ obstructions: prev, error: (err as Error).message });
    }
  },

  removeObstruction: async (obstructionId: string) => {
    // Guard: prevent mutations on a finalized project
    if (get().currentProject?.status === 'FINALIZED') return;

    const prev = get().obstructions;
    set({ obstructions: prev.filter((o) => o.obstruction_id !== obstructionId) });

    try {
      const { error } = await fromTable('project_obstruction')
        .delete()
        .eq('obstruction_id', obstructionId);
      if (error) throw error;
    } catch (err) {
      set({ obstructions: prev, error: (err as Error).message });
    }
  },

  checkPermission: (parameterKey: string, value: unknown): PermissionCheckResult => {
    const snapshot = get().currentSnapshot;
    if (!snapshot) {
      return { allowed: true };
    }

    const snapshotPayload = snapshot.snapshot_data as Record<string, unknown> | undefined;
    if (!snapshotPayload) {
      return { allowed: true };
    }

    const permissions = (snapshotPayload.consultant_permissions as TemplateConsultantPermission[]) ?? [];
    const permission = permissions.find((p) => p.parameter_key === parameterKey);

    // If no permission record exists for this parameter, default to allowed
    if (!permission) {
      return { allowed: true };
    }

    // Check edit_mode
    if (permission.edit_mode === 'LOCKED') {
      return { allowed: false, reason: `Parameter "${parameterKey}" is locked by the designer.` };
    }

    if (permission.edit_mode === 'RESTRICTED') {
      // Check allowed_values constraint
      if (permission.allowed_values && Array.isArray(permission.allowed_values)) {
        if (!permission.allowed_values.includes(value)) {
          return {
            allowed: false,
            reason: `Value for "${parameterKey}" must be one of: ${permission.allowed_values.join(', ')}`,
          };
        }
      }

      // Check min/max range constraint for numeric values
      if (typeof value === 'number') {
        if (permission.min_value != null && value < permission.min_value) {
          return {
            allowed: false,
            reason: `Value for "${parameterKey}" must be >= ${permission.min_value}`,
          };
        }
        if (permission.max_value != null && value > permission.max_value) {
          return {
            allowed: false,
            reason: `Value for "${parameterKey}" must be <= ${permission.max_value}`,
          };
        }
      }
    }

    // edit_mode === 'FREE' or RESTRICTED with valid value
    return { allowed: true };
  },

  reset: () => set(initialState),

  setInstallationArea: (area) => set({ installationArea: area }),

  getInstallationArea: () => {
    const state = get();
    const width =
      state.measurements?.wall_width_mm ?? state.wallConfig?.total_width_mm ?? 0;
    const height =
      state.measurements?.wall_height_mm ?? state.wallConfig?.total_height_mm ?? 0;
    return resolveInstallationArea(
      { width_mm: width, height_mm: height },
      state.installationArea,
    );
  },

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
