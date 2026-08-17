import { create } from 'zustand';
import type { MasterBom, MasterBomLine, Template } from '@/types/database';
import { fromTable, supabase } from '@/lib/supabase';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import {
  hasOverlap,
  isWithinWallBoundary,
  isValidZoneDimensions,
} from '@/canvas/utils/zoneConstraints';

// --- Publish Step Enum ---

export enum PublishStep {
  IDLE = 'IDLE',
  VALIDATING = 'VALIDATING',
  VALIDATION_RESULTS = 'VALIDATION_RESULTS',
  GENERATING_BOM = 'GENERATING_BOM',
  BOM_GENERATED = 'BOM_GENERATED',
  APPROVING_BOM = 'APPROVING_BOM',
  BOM_APPROVED = 'BOM_APPROVED',
  PUBLISHING = 'PUBLISHING',
  PUBLISHED = 'PUBLISHED',
  ERROR = 'ERROR',
}

// --- Validation Result ---

export interface ValidationResult {
  gate: string;
  passed: boolean;
  message: string;
}

// --- State / Actions / Store types ---

export interface PublishState {
  currentStep: PublishStep;
  validationResults: ValidationResult[];
  generatedBom: MasterBom | null;
  generatedBomLines: MasterBomLine[];
  isLoading: boolean;
  error: string | null;
}

export interface PublishActions {
  runValidation: (templateId: string) => Promise<void>;
  rerunValidation: (templateId: string) => Promise<void>;
  generateMasterBom: (templateId: string) => Promise<void>;
  approveMasterBom: (bomId: string) => Promise<void>;
  publishTemplate: (templateId: string) => Promise<void>;
  reset: () => void;
}

export type PublishStore = PublishState & PublishActions;

const initialState: PublishState = {
  currentStep: PublishStep.IDLE,
  validationResults: [],
  generatedBom: null,
  generatedBomLines: [],
  isLoading: false,
  error: null,
};

/**
 * Selector helper: returns true when the current step is BOM_APPROVED,
 * meaning the template is eligible to be published.
 */
export const canPublish = (state: PublishState): boolean =>
  state.currentStep === PublishStep.BOM_APPROVED;

export const usePublishStore = create<PublishStore>((set) => ({
  ...initialState,

  runValidation: async (_templateId: string) => {
    set({ currentStep: PublishStep.VALIDATING, isLoading: true, error: null });

    try {
      const { zones, zoneSku, currentTemplate } = useProjectStore.getState();
      const results: ValidationResult[] = [];

      // Gate 1: All zones have a primary SKU assigned
      const zonesWithoutSku = zones.filter((z) => !zoneSku.has(z.zone_id));
      results.push({
        gate: 'Zone SKU Assignment',
        passed: zonesWithoutSku.length === 0,
        message:
          zonesWithoutSku.length === 0
            ? 'All zones have a primary SKU assigned'
            : `${zonesWithoutSku.length} zone(s) missing a primary SKU assignment`,
      });

      // Gate 2: All assigned SKUs are ACTIVE with catalogue READY
      const skuIds = Array.from(zoneSku.values()).map((sku) => sku.sku_id);
      let skuGatePassed = true;
      let skuGateMessage = 'All assigned SKUs are ACTIVE with catalogue READY';

      if (skuIds.length > 0) {
        const { data: catalogueEntries, error: catErr } = await fromTable('catalogue_entry')
          .select('sku_id, status')
          .in('sku_id', skuIds);

        if (catErr) {
          skuGatePassed = false;
          skuGateMessage = `Failed to check catalogue status: ${catErr.message}`;
        } else {
          // Check all SKUs are ACTIVE (already stored in zoneSku as SkuMaster)
          const inactiveSkus = Array.from(zoneSku.values()).filter(
            (sku) => sku.status !== 'ACTIVE',
          );

          // Check catalogue entries are READY
          const catalogueMap = new Map(
            (catalogueEntries ?? []).map((e: { sku_id: string; status: string }) => [
              e.sku_id,
              e.status,
            ]),
          );
          const notReadySkus = skuIds.filter((id) => catalogueMap.get(id) !== 'READY');

          if (inactiveSkus.length > 0 || notReadySkus.length > 0) {
            skuGatePassed = false;
            const issues: string[] = [];
            if (inactiveSkus.length > 0) {
              issues.push(`${inactiveSkus.length} SKU(s) are not ACTIVE`);
            }
            if (notReadySkus.length > 0) {
              issues.push(`${notReadySkus.length} SKU(s) do not have catalogue READY`);
            }
            skuGateMessage = issues.join('; ');
          }
        }
      }

      results.push({
        gate: 'SKU Catalogue Status',
        passed: skuGatePassed,
        message: skuGateMessage,
      });

      // Gate 3: No zone overlaps
      let overlapDetected = false;
      for (const zone of zones) {
        const box = {
          x: zone.x_mm,
          y: zone.y_mm,
          width: zone.width_mm,
          height: zone.height_mm,
        };
        if (hasOverlap(box, zones, zone.zone_id)) {
          overlapDetected = true;
          break;
        }
      }
      results.push({
        gate: 'Zone Overlaps',
        passed: !overlapDetected,
        message: overlapDetected
          ? 'One or more zones overlap with each other'
          : 'No zone overlaps detected',
      });

      // Gate 4: Zone constraints (within wall boundary and valid dimensions)
      const wallWidth = currentTemplate?.wall_geometry.base_width_mm ?? 0;
      const wallHeight = currentTemplate?.wall_geometry.base_height_mm ?? 0;
      const constraintViolations: string[] = [];

      for (const zone of zones) {
        const box = {
          x: zone.x_mm,
          y: zone.y_mm,
          width: zone.width_mm,
          height: zone.height_mm,
        };
        if (!isWithinWallBoundary(box, wallWidth, wallHeight)) {
          constraintViolations.push(`Zone "${zone.zone_id}" exceeds wall boundary`);
        }
        if (!isValidZoneDimensions(zone.width_mm, zone.height_mm)) {
          constraintViolations.push(`Zone "${zone.zone_id}" has invalid dimensions`);
        }
      }

      results.push({
        gate: 'Zone Constraints',
        passed: constraintViolations.length === 0,
        message:
          constraintViolations.length === 0
            ? 'All zones meet dimensional and boundary constraints'
            : constraintViolations.join('; '),
      });

      // Gate 5: Metadata complete (template name is non-empty)
      const metadataPassed = Boolean(currentTemplate?.name && currentTemplate.name.trim().length > 0);
      results.push({
        gate: 'Metadata Complete',
        passed: metadataPassed,
        message: metadataPassed
          ? 'Template metadata is complete'
          : 'Template name is missing or empty',
      });

      set({
        currentStep: PublishStep.VALIDATION_RESULTS,
        validationResults: results,
        isLoading: false,
      });
    } catch (err) {
      set({
        currentStep: PublishStep.ERROR,
        error: (err as Error).message,
        isLoading: false,
      });
    }
  },

  rerunValidation: async (templateId: string) => {
    // Reset BOM-related state and re-run validation from scratch.
    // Allows users to go back after making template changes without
    // closing and reopening the workflow panel.
    set({
      generatedBom: null,
      generatedBomLines: [],
      error: null,
    });
    await usePublishStore.getState().runValidation(templateId);
  },

  generateMasterBom: async (templateId: string) => {
    set({ currentStep: PublishStep.GENERATING_BOM, isLoading: true, error: null });

    try {
      const { data, error } = await fromTable('master_bom')
        .insert({
          template_id: templateId,
          status: 'GENERATED',
          engine_version: '1.0',
          rule_set_id: 'default',
          generated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      const masterBom = data as unknown as MasterBom;

      set({
        currentStep: PublishStep.BOM_GENERATED,
        generatedBom: masterBom,
        generatedBomLines: [],
        isLoading: false,
      });
    } catch (err) {
      set({
        currentStep: PublishStep.ERROR,
        error: (err as Error).message,
        isLoading: false,
      });
    }
  },

  approveMasterBom: async (bomId: string) => {
    set({ currentStep: PublishStep.APPROVING_BOM, isLoading: true, error: null });

    try {
      // Authorization note: The client does not perform role/permission checks here.
      // Supabase Row-Level Security (RLS) policies enforce that only users with the
      // appropriate role can update master_bom.approved_by. If an unauthorized user
      // attempts this action, the RLS policy will reject the request and the error
      // handler below will surface a clear message to the user.
      const userId = useAuthStore.getState().user?.id;

      const { error } = await fromTable('master_bom')
        .update({
          status: 'APPROVED',
          approved_by: userId,
          approved_at: new Date().toISOString(),
        })
        .eq('master_bom_id', bomId);

      if (error) {
        // Surface permission-denied errors with a clear message
        const message = error.message.toLowerCase().includes('permission')
          || error.message.toLowerCase().includes('policy')
          ? 'You do not have permission to approve this BOM. Only authorized roles can approve.'
          : error.message;
        throw new Error(message);
      }

      set({
        currentStep: PublishStep.BOM_APPROVED,
        isLoading: false,
      });
    } catch (err) {
      set({
        currentStep: PublishStep.ERROR,
        error: (err as Error).message,
        isLoading: false,
      });
    }
  },

  publishTemplate: async (templateId: string) => {
    set({ currentStep: PublishStep.PUBLISHING, isLoading: true, error: null });

    try {
      const userId = useAuthStore.getState().user?.id;

      const { data, error } = await supabase.rpc('publish_template', {
        p_template_id: templateId,
        p_user_id: userId,
      });

      if (error) {
        set({
          currentStep: PublishStep.ERROR,
          error: error.message,
          isLoading: false,
        });
        return;
      }

      // Sync local projectStore state so the UI reflects the template is now ACTIVE.
      // This prevents the "Publish Template" button from remaining visible after publish.
      const projectState = useProjectStore.getState();
      if (projectState.currentTemplate?.template_id === templateId) {
        useProjectStore.setState({
          currentTemplate: {
            ...projectState.currentTemplate,
            status: 'ACTIVE' as Template['status'],
          },
        });
      }

      set({
        currentStep: PublishStep.PUBLISHED,
        isLoading: false,
      });
    } catch (err) {
      set({
        currentStep: PublishStep.ERROR,
        error: (err as Error).message,
        isLoading: false,
      });
    }
  },

  reset: () => {
    set({ ...initialState });
  },
}));
