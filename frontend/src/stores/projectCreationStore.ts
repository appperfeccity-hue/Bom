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
  idempotencyKey: string | null;
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
  idempotencyKey: null,
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
    const { selectedTemplate, customerReference, siteReference } = get();
    if (!selectedTemplate) return;

    set({ step: CreationStep.CREATING, isLoading: true, error: null });

    try {
      const templateId = selectedTemplate.id;

      // Get current user id
      const userId = useAuthStore.getState().user?.id;
      if (!userId) throw new Error('User not authenticated');

      // Generate idempotency key once and store it (reuse on retry)
      let { idempotencyKey } = get();
      if (!idempotencyKey) {
        idempotencyKey = `${userId}-${templateId}-${Date.now()}`;
        set({ idempotencyKey });
      }

      // Load full template data in parallel (zones, lighting, furniture, trims)
      const [zonesResult, lightingResult, furnitureResult, trimsResult] = await Promise.all([
        fromTable('template_zone')
          .select('*')
          .eq('template_id', templateId)
          .order('z_index'),
        fromTable('template_lighting')
          .select('*')
          .eq('template_id', templateId),
        fromTable('template_furniture')
          .select('*')
          .eq('template_id', templateId),
        fromTable('template_trim')
          .select('*')
          .eq('template_id', templateId),
      ]);

      if (zonesResult.error) throw zonesResult.error;
      if (lightingResult.error) throw lightingResult.error;
      if (furnitureResult.error) throw furnitureResult.error;
      if (trimsResult.error) throw trimsResult.error;

      // Load zone SKU mappings
      const typedZones = (zonesResult.data ?? []) as TemplateZone[];
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

      // Build snapshot data (include project metadata with customer/site references)
      const snapshotData = buildSnapshotData(
        selectedTemplate,
        typedZones,
        (lightingResult.data ?? []) as TemplateLighting[],
        (furnitureResult.data ?? []) as TemplateFurniture[],
        (trimsResult.data ?? []) as TemplateTrim[],
        zoneSku,
      );

      // Embed project metadata (customer/site references) in snapshot
      const snapshotWithMetadata = {
        ...snapshotData,
        project_metadata: {
          customer_reference: customerReference,
          site_reference: siteReference,
        },
      };

      // Compute hash over the design freeze only (excludes project_metadata).
      // The hash is a content-addressable identifier for the template geometry/materials,
      // not the full payload. project_metadata (customer/site refs) is mutable context.
      const snapshotHash = await computeSnapshotHash(snapshotData);

      // Call RPC to create project atomically
      const { data: projectId, error: rpcErr } = await supabase.rpc('create_project', {
        p_template_id: templateId,
        p_user_id: userId,
        p_idempotency_key: idempotencyKey,
        p_snapshot_data: snapshotWithMetadata,
        p_snapshot_hash: snapshotHash,
        p_rule_set_id: null,
      });
      if (rpcErr) throw rpcErr;

      set({
        createdProjectId: projectId as string,
        step: CreationStep.CREATED,
        isLoading: false,
        idempotencyKey: null,
      });

      // Load the project and switch to consultant mode.
      // If this fails, the project was already created successfully - show a different message.
      try {
        await useProjectStore.getState().loadProject(projectId as string);
        useCanvasStore.getState().setMode(CanvasMode.CONSULTANT);
      } catch {
        set({
          step: CreationStep.ERROR,
          error: 'Project created but failed to load. Please navigate to it manually.',
          isLoading: false,
          createdProjectId: projectId as string,
        });
      }
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
