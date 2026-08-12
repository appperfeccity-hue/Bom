import { create } from 'zustand';
import type { Template, TemplateZone, TemplateLighting, TemplateFurniture, TemplateTrim, SkuMaster } from '@/types/database';
import { CanvasMode } from '@/types/database';
import { fromTable, supabase } from '@/lib/supabase';
import { buildSnapshotData, computeSnapshotHash } from '@/lib/snapshotBuilder';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCanvasStore } from '@/stores/canvasStore';

// --- Creation Step Enum ---

export enum CreationStep {
  IDLE = 'IDLE',
  BROWSE_TEMPLATES = 'BROWSE_TEMPLATES',
  PROJECT_DETAILS = 'PROJECT_DETAILS',
  CREATING = 'CREATING',
  CREATED = 'CREATED',
  ERROR = 'ERROR',
}

// --- State / Actions / Store types ---

export interface ProjectCreationState {
  step: CreationStep;
  availableTemplates: Template[];
  selectedTemplate: Template | null;
  customerReference: string;
  siteReference: string;
  createdProjectId: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface ProjectCreationActions {
  fetchAvailableTemplates: () => Promise<void>;
  selectTemplate: (template: Template) => void;
  setCustomerReference: (val: string) => void;
  setSiteReference: (val: string) => void;
  createProject: () => Promise<void>;
  reset: () => void;
}

export type ProjectCreationStore = ProjectCreationState & ProjectCreationActions;

const initialState: ProjectCreationState = {
  step: CreationStep.IDLE,
  availableTemplates: [],
  selectedTemplate: null,
  customerReference: '',
  siteReference: '',
  createdProjectId: null,
  isLoading: false,
  error: null,
};

export const useProjectCreationStore = create<ProjectCreationStore>((set, get) => ({
  ...initialState,

  fetchAvailableTemplates: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await fromTable('template')
        .select('*')
        .eq('status', 'ACTIVE');
      if (error) throw error;
      set({
        availableTemplates: (data ?? []) as Template[],
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  selectTemplate: (template: Template) => {
    set({ selectedTemplate: template, step: CreationStep.PROJECT_DETAILS });
  },

  setCustomerReference: (val: string) => {
    set({ customerReference: val });
  },

  setSiteReference: (val: string) => {
    set({ siteReference: val });
  },

  createProject: async () => {
    const { selectedTemplate } = get();
    if (!selectedTemplate) return;

    set({ step: CreationStep.CREATING, isLoading: true, error: null });

    try {
      const templateId = selectedTemplate.id;

      // Load full template data (zones, lighting, furniture, trims, zone SKUs)
      const { data: zones, error: zErr } = await fromTable('template_zone')
        .select('*')
        .eq('template_id', templateId)
        .order('z_index');
      if (zErr) throw zErr;

      const { data: lighting, error: lErr } = await fromTable('template_lighting')
        .select('*')
        .eq('template_id', templateId);
      if (lErr) throw lErr;

      const { data: furniture, error: fErr } = await fromTable('template_furniture')
        .select('*')
        .eq('template_id', templateId);
      if (fErr) throw fErr;

      const { data: trims, error: trErr } = await fromTable('template_trim')
        .select('*')
        .eq('template_id', templateId);
      if (trErr) throw trErr;

      // Load zone SKU mappings
      const typedZones = (zones ?? []) as TemplateZone[];
      const zoneIds = typedZones.map((z) => z.id);
      const zoneSku = new Map<string, SkuMaster>();

      if (zoneIds.length > 0) {
        const { data: zoneSkuData, error: zsErr } = await fromTable('template_zone_sku')
          .select('zone_id, sku_id')
          .in('zone_id', zoneIds);
        if (zsErr) throw zsErr;

        if (zoneSkuData && zoneSkuData.length > 0) {
          const skuIds = (zoneSkuData as Array<{ zone_id: string; sku_id: string }>).map((zs) => zs.sku_id);
          const { data: skus, error: sErr } = await fromTable('sku_master')
            .select('*')
            .in('sku_id', skuIds);
          if (sErr) throw sErr;

          const skuMap = new Map<string, SkuMaster>();
          for (const sku of (skus ?? []) as SkuMaster[]) {
            skuMap.set(sku.sku_id, sku);
          }

          for (const zs of zoneSkuData as Array<{ zone_id: string; sku_id: string }>) {
            const sku = skuMap.get(zs.sku_id);
            if (sku) {
              zoneSku.set(zs.zone_id, sku);
            }
          }
        }
      }

      // Build snapshot data
      const snapshotData = buildSnapshotData(
        selectedTemplate,
        typedZones,
        (lighting ?? []) as TemplateLighting[],
        (furniture ?? []) as TemplateFurniture[],
        (trims ?? []) as TemplateTrim[],
        zoneSku,
      );

      // Compute hash
      const snapshotHash = await computeSnapshotHash(snapshotData);

      // Get current user id
      const userId = useAuthStore.getState().user?.id;
      if (!userId) throw new Error('User not authenticated');

      // Generate idempotency key
      const idempotencyKey = `${userId}-${templateId}-${Date.now()}`;

      // Call RPC to create project atomically
      const { data: projectId, error: rpcErr } = await supabase.rpc('create_project', {
        p_template_id: templateId,
        p_user_id: userId,
        p_idempotency_key: idempotencyKey,
        p_snapshot_data: snapshotData,
        p_snapshot_hash: snapshotHash,
        p_rule_set_id: null,
      });
      if (rpcErr) throw rpcErr;

      set({
        createdProjectId: projectId as string,
        step: CreationStep.CREATED,
        isLoading: false,
      });

      // Load the project and switch to consultant mode
      await useProjectStore.getState().loadProject(projectId as string);
      useCanvasStore.getState().setMode(CanvasMode.CONSULTANT);
    } catch (err) {
      set({
        step: CreationStep.ERROR,
        error: (err as Error).message,
        isLoading: false,
      });
    }
  },

  reset: () => {
    set({ ...initialState });
  },
}));
