import { create } from 'zustand';
import type {
  MasterBom,
  MasterBomLine,
  ActualBom,
  ActualBomLine,
  FinalBom,
  FinalBomLine,
  ReconciliationLine,
} from '@/types/database';
import { ReconciliationResultType } from '@/types/database';
import { fromTable, supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { calculateWallPanels } from '@/engines/wallPanelEngine';
import { calculateLights } from '@/engines/lightEngine';
import { calculateFurniture } from '@/engines/furnitureEngine';
import { calculateHiddenComponent } from '@/engines/hiddenComponentEngine';
import { EngineError } from '@/engines/types';
import type {
  WallPanelInput,
  LightInput,
  FurnitureInput,
  HiddenComponentInput,
} from '@/engines/types';
import type { PipelineError } from '@/engines/errorCatalogue';
import { ErrorCode, ErrorSeverity, ErrorCategory } from '@/engines/errorCatalogue';
import { runBomPipeline } from '@/engines/bomPipeline';
import type { BomPipelineInput, BomOutputLine } from '@/engines/bomPipeline';
import type { SnapshotData } from '@/lib/snapshotBuilder';
import {
  mapSnapshotToPipeline,
  mapPermissions,
  mapCompatibility,
  mapRuleSet,
  mapSnapshotV1ToPipeline,
  mapPermissionsV1,
  mapCompatibilityV1,
  mapRuleSetV1,
} from '@/lib/snapshotMapper';
import { BOM_ENGINE_VERSION } from '@/lib/bomEngine/version';
import { computeInputHash } from '@/lib/inputHash';

export interface BomState {
  masterBom: MasterBom | null;
  masterBomLines: MasterBomLine[];
  actualBom: ActualBom | null;
  actualBomLines: ActualBomLine[];
  finalBom: FinalBom | null;
  finalBomLines: FinalBomLine[];
  reconciliation: ReconciliationLine[];
  isMasterBomLoading: boolean;
  isActualBomLoading: boolean;
  isFinalBomLoading: boolean;
  isLoading: boolean;
  error: string | null;
  isBomPanelOpen: boolean;
  pipelineStatus: 'idle' | 'running' | 'success' | 'blocked';
  pipelineErrors: PipelineError[];
  pipelineWarnings: PipelineError[];
  pipelineProgress: string | null;
  pipelineOutputLines: BomOutputLine[];
  isSaving: boolean;
  saveError: string | null;
}

export interface BomActions {
  fetchMasterBom: (templateId: string) => Promise<void>;
  fetchActualBom: (projectId: string) => Promise<void>;
  fetchFinalBom: (projectId: string) => Promise<void>;
  computeReconciliation: () => void;
  /** @deprecated Use runPipeline instead */
  generateActualBom: (input: GenerateActualBomInput) => GenerateActualBomOutput;
  runPipeline: (projectId: string, snapshotId: string) => Promise<void>;
  saveBomToServer: (projectId: string, snapshotHash: string) => Promise<string>;
  resetPipeline: () => void;
  openBomPanel: () => void;
  closeBomPanel: () => void;
  resetBom: () => void;
}

/** Input for the generateActualBom orchestration method */
export interface GenerateActualBomInput {
  wallPanels: WallPanelInput[];
  lights: LightInput[];
  furniture: FurnitureInput[];
  hiddenComponents: HiddenComponentInput[];
}

/** A single result line from the BOM generation pipeline */
export interface GeneratedBomLine {
  productType: 'WALL_PANEL' | 'LIGHT' | 'FURNITURE' | 'HIDDEN_COMPONENT';
  quantity: number;
  omitted?: boolean;
  included?: boolean;
  details: Record<string, unknown>;
}

/** A single engine error captured during BOM generation */
export interface GenerationError {
  productType: 'WALL_PANEL' | 'LIGHT' | 'FURNITURE' | 'HIDDEN_COMPONENT';
  index: number;
  message: string;
}

/** Output of the generateActualBom orchestration method */
export interface GenerateActualBomOutput {
  lines: GeneratedBomLine[];
  errors: GenerationError[];
}

export type BomStore = BomState & BomActions;

const initialState: BomState = {
  masterBom: null,
  masterBomLines: [],
  actualBom: null,
  actualBomLines: [],
  finalBom: null,
  finalBomLines: [],
  reconciliation: [],
  isMasterBomLoading: false,
  isActualBomLoading: false,
  isFinalBomLoading: false,
  isLoading: false,
  error: null,
  isBomPanelOpen: false,
  pipelineStatus: 'idle',
  pipelineErrors: [],
  pipelineWarnings: [],
  pipelineProgress: null,
  pipelineOutputLines: [],
  isSaving: false,
  saveError: null,
};

export const useBomStore = create<BomStore>((set, get) => ({
  ...initialState,

  fetchMasterBom: async (templateId: string) => {
    set({ isMasterBomLoading: true, isLoading: true, error: null });
    try {
      // Fetch the approved master BOM for the template
      const { data: bomData, error: bomErr } = await fromTable('master_bom')
        .select('*')
        .eq('template_id', templateId)
        .eq('status', 'APPROVED')
        .limit(1)
        .single();

      if (bomErr) throw bomErr;
      if (!bomData) {
        const { isActualBomLoading, isFinalBomLoading } = get();
        set({
          masterBom: null,
          masterBomLines: [],
          isMasterBomLoading: false,
          isLoading: isActualBomLoading || isFinalBomLoading,
        });
        return;
      }

      const masterBom = bomData as unknown as MasterBom;

      // Fetch lines for this master BOM
      const { data: lineData, error: lineErr } = await fromTable('master_bom_line')
        .select('*')
        .eq('master_bom_id', masterBom.master_bom_id)
        .order('product_type');

      if (lineErr) throw lineErr;

      const { isActualBomLoading, isFinalBomLoading } = get();
      set({
        masterBom,
        masterBomLines: (lineData ?? []) as unknown as MasterBomLine[],
        isMasterBomLoading: false,
        isLoading: isActualBomLoading || isFinalBomLoading,
      });
    } catch (err) {
      const { isActualBomLoading, isFinalBomLoading } = get();
      set({
        error: (err as Error).message,
        isMasterBomLoading: false,
        isLoading: isActualBomLoading || isFinalBomLoading,
      });
    }
  },

  fetchActualBom: async (projectId: string) => {
    set({ isActualBomLoading: true, isLoading: true, error: null });
    try {
      // Fetch the most recent non-superseded actual BOM
      const { data: bomData, error: bomErr } = await fromTable('actual_bom')
        .select('*')
        .eq('project_id', projectId)
        .neq('status', 'SUPERSEDED')
        .order('calculation_timestamp', { ascending: false })
        .limit(1)
        .single();

      if (bomErr) throw bomErr;
      if (!bomData) {
        const { isMasterBomLoading, isFinalBomLoading } = get();
        set({
          actualBom: null,
          actualBomLines: [],
          isActualBomLoading: false,
          isLoading: isMasterBomLoading || isFinalBomLoading,
        });
        return;
      }

      const actualBom = bomData as unknown as ActualBom;

      // Fetch lines for this actual BOM
      const { data: lineData, error: lineErr } = await fromTable('actual_bom_line')
        .select('*')
        .eq('actual_bom_id', actualBom.actual_bom_id)
        .order('product_type');

      if (lineErr) throw lineErr;

      const { isMasterBomLoading, isFinalBomLoading } = get();
      set({
        actualBom,
        actualBomLines: (lineData ?? []) as unknown as ActualBomLine[],
        isActualBomLoading: false,
        isLoading: isMasterBomLoading || isFinalBomLoading,
      });
    } catch (err) {
      const { isMasterBomLoading, isFinalBomLoading } = get();
      set({
        error: (err as Error).message,
        isActualBomLoading: false,
        isLoading: isMasterBomLoading || isFinalBomLoading,
      });
    }
  },

  fetchFinalBom: async (projectId: string) => {
    set({ isFinalBomLoading: true, isLoading: true, error: null });
    try {
      // Fetch the final BOM (unique per project)
      const { data: bomData, error: bomErr } = await fromTable('final_bom')
        .select('*')
        .eq('project_id', projectId)
        .single();

      if (bomErr) throw bomErr;
      if (!bomData) {
        const { isMasterBomLoading, isActualBomLoading } = get();
        set({
          finalBom: null,
          finalBomLines: [],
          isFinalBomLoading: false,
          isLoading: isMasterBomLoading || isActualBomLoading,
        });
        return;
      }

      const finalBom = bomData as unknown as FinalBom;

      // Fetch lines for this final BOM
      const { data: lineData, error: lineErr } = await fromTable('final_bom_line')
        .select('*')
        .eq('final_bom_id', finalBom.final_bom_id)
        .order('product_type');

      if (lineErr) throw lineErr;

      const { isMasterBomLoading, isActualBomLoading } = get();
      set({
        finalBom,
        finalBomLines: (lineData ?? []) as unknown as FinalBomLine[],
        isFinalBomLoading: false,
        isLoading: isMasterBomLoading || isActualBomLoading,
      });
    } catch (err) {
      const { isMasterBomLoading, isActualBomLoading } = get();
      set({
        error: (err as Error).message,
        isFinalBomLoading: false,
        isLoading: isMasterBomLoading || isActualBomLoading,
      });
    }
  },

  computeReconciliation: () => {
    const { masterBomLines, actualBomLines } = get();
    const reconciliation: ReconciliationLine[] = [];

    // Build a map of actual lines by master_bom_line_id
    const actualByMasterLineId = new Map<string, ActualBomLine>();
    const unmatchedActualLines: ActualBomLine[] = [];

    for (const actualLine of actualBomLines) {
      if (actualLine.master_bom_line_id) {
        actualByMasterLineId.set(actualLine.master_bom_line_id, actualLine);
      } else {
        unmatchedActualLines.push(actualLine);
      }
    }

    // Compare each master line to its matching actual line
    for (const masterLine of masterBomLines) {
      const actualLine = actualByMasterLineId.get(masterLine.master_bom_line_id);

      if (!actualLine) {
        // Master line exists but no actual line - REMOVED
        reconciliation.push({
          master_line: masterLine,
          actual_line: null,
          result_type: ReconciliationResultType.REMOVED,
        });
      } else if (actualLine.sku_id !== masterLine.sku_id) {
        // SKU changed
        reconciliation.push({
          master_line: masterLine,
          actual_line: actualLine,
          result_type: ReconciliationResultType.SKU_CHANGED,
        });
        // Remove from map so we don't double-count
        actualByMasterLineId.delete(masterLine.master_bom_line_id);
      } else if (Math.abs(actualLine.quantity - masterLine.default_quantity) > 0.001) {
        // Quantity changed (using tolerance for floating-point comparison)
        reconciliation.push({
          master_line: masterLine,
          actual_line: actualLine,
          result_type: ReconciliationResultType.QUANTITY_CHANGED,
        });
        actualByMasterLineId.delete(masterLine.master_bom_line_id);
      } else {
        // Unchanged
        reconciliation.push({
          master_line: masterLine,
          actual_line: actualLine,
          result_type: ReconciliationResultType.UNCHANGED,
        });
        actualByMasterLineId.delete(masterLine.master_bom_line_id);
      }
    }

    // Any actual lines with a master_bom_line_id that was not in masterBomLines
    // are UNEXPECTED
    for (const [, actualLine] of actualByMasterLineId) {
      reconciliation.push({
        master_line: null,
        actual_line: actualLine,
        result_type: ReconciliationResultType.UNEXPECTED,
      });
    }

    // Actual lines with no master_bom_line_id are ADDED_BY_TRIGGER
    for (const actualLine of unmatchedActualLines) {
      reconciliation.push({
        master_line: null,
        actual_line: actualLine,
        result_type: ReconciliationResultType.ADDED_BY_TRIGGER,
      });
    }

    set({ reconciliation });
  },

  generateActualBom: (input: GenerateActualBomInput): GenerateActualBomOutput => {
    const lines: GeneratedBomLine[] = [];
    const errors: GenerationError[] = [];

    // 1. Wall panel engine
    for (let i = 0; i < input.wallPanels.length; i++) {
      try {
        const result = calculateWallPanels(input.wallPanels[i]);
        lines.push({
          productType: 'WALL_PANEL',
          quantity: result.procurementQuantity,
          details: {
            Ncol: result.Ncol,
            Nrow: result.Nrow,
            requiredQuantity: result.requiredQuantity,
            procurementQuantity: result.procurementQuantity,
            wasteQuantity: result.wasteQuantity,
            trimWidth: result.trimWidth,
            retainedWidth: result.retainedWidth,
            trimHeight: result.trimHeight,
            retainedHeight: result.retainedHeight,
          },
        });
      } catch (err) {
        if (err instanceof EngineError) {
          errors.push({ productType: 'WALL_PANEL', index: i, message: err.message });
        } else {
          throw err;
        }
      }
    }

    // 2. Light engine
    for (let i = 0; i < input.lights.length; i++) {
      try {
        const result = calculateLights(input.lights[i]);
        lines.push({
          productType: 'LIGHT',
          quantity: result.quantity,
          details: {
            totalLength: result.totalLength,
            driverCount: result.driverCount,
            wireLength: result.wireLength,
          },
        });
      } catch (err) {
        if (err instanceof EngineError) {
          errors.push({ productType: 'LIGHT', index: i, message: err.message });
        } else {
          throw err;
        }
      }
    }

    // 3. Furniture engine
    for (let i = 0; i < input.furniture.length; i++) {
      try {
        const result = calculateFurniture(input.furniture[i]);
        lines.push({
          productType: 'FURNITURE',
          quantity: result.quantity,
          omitted: result.omitted,
          details: {},
        });
      } catch (err) {
        if (err instanceof EngineError) {
          errors.push({ productType: 'FURNITURE', index: i, message: err.message });
        } else {
          throw err;
        }
      }
    }

    // 4. Hidden component engine
    for (let i = 0; i < input.hiddenComponents.length; i++) {
      try {
        const result = calculateHiddenComponent(input.hiddenComponents[i]);
        lines.push({
          productType: 'HIDDEN_COMPONENT',
          quantity: result.quantity,
          included: result.included,
          details: {},
        });
      } catch (err) {
        if (err instanceof EngineError) {
          errors.push({ productType: 'HIDDEN_COMPONENT', index: i, message: err.message });
        } else {
          throw err;
        }
      }
    }

    return { lines, errors };
  },

  openBomPanel: () => {
    set({ isBomPanelOpen: true });
  },

  closeBomPanel: () => {
    set({ isBomPanelOpen: false });
  },

  resetPipeline: () => {
    set({
      pipelineStatus: 'idle',
      pipelineErrors: [],
      pipelineWarnings: [],
      pipelineProgress: null,
      pipelineOutputLines: [],
    });
  },

  saveBomToServer: async (projectId: string, snapshotHash: string): Promise<string> => {
    set({ isSaving: true, saveError: null });

    try {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { pipelineStatus, pipelineOutputLines } = get();
      if (pipelineStatus !== 'success') {
        throw new Error('Pipeline must complete successfully before saving');
      }

      // Generate idempotency key
      const idempotencyKey = crypto.randomUUID();

      // Get configuration from the latest project_configuration
      const { data: configData } = await fromTable('project_configuration')
        .select('*')
        .eq('project_id', projectId)
        .order('configuration_version', { ascending: false })
        .limit(1)
        .single();

      const configurationData = (configData as Record<string, unknown>)?.configuration_data ?? {};

      // Get measurements
      const { data: measurementData } = await fromTable('project_measurement')
        .select('*')
        .eq('project_id', projectId)
        .single();

      const measurements = (measurementData ?? {}) as Record<string, unknown>;

      // Compute input_hash = sha256(canonical({snapshotHash, measurements, configuration}))
      const inputHash = await computeInputHash(
        snapshotHash,
        measurements,
        configurationData as Record<string, unknown>,
      );

      // Map pipeline output lines to the JSONB format expected by the RPC
      const bomLines = pipelineOutputLines.map((line) => ({
        component_id: line.componentId,
        sku_id: line.skuId,
        product_type: line.productType,
        quantity: line.quantity,
        required_quantity: line.requiredQuantity,
        waste_quantity: line.wasteQuantity,
        unit_of_measure: line.unitOfMeasure,
        calculation_rule: line.calculationRule,
        waste_factor: line.wasteQuantity > 0 && line.requiredQuantity > 0
          ? Math.round((line.wasteQuantity / line.requiredQuantity) * 100) / 100
          : 0,
        resolved_dimensions: {},
        calculation_inputs: {},
      }));

      // Call the RPC
      const { data, error } = await supabase.rpc('save_actual_bom', {
        p_project_id: projectId,
        p_user_id: userId,
        p_idempotency_key: idempotencyKey,
        p_configuration_data: configurationData,
        p_bom_lines: bomLines,
        p_engine_version: BOM_ENGINE_VERSION,
        p_input_hash: inputHash,
      });

      if (error) {
        // Surface DB validation errors verbatim
        throw new Error(error.message);
      }

      const actualBomId = data as string;

      // Refresh actual BOM state
      await get().fetchActualBom(projectId);

      set({ isSaving: false, saveError: null });
      return actualBomId;
    } catch (err) {
      const errorMessage = (err as Error).message;
      set({ isSaving: false, saveError: errorMessage });
      throw err;
    }
  },

  runPipeline: async (projectId: string, snapshotId: string) => {
    set({ pipelineStatus: 'running', pipelineErrors: [], pipelineWarnings: [], pipelineProgress: 'Fetching data', pipelineOutputLines: [] });

    try {
      // Fetch snapshot data
      set({ pipelineProgress: 'Loading snapshot' });
      const { data: snapshotData, error: snapErr } = await fromTable('project_snapshot')
        .select('*')
        .eq('snapshot_id', snapshotId)
        .eq('project_id', projectId)
        .single();

      if (snapErr) throw new Error(snapErr.message ?? 'Failed to fetch snapshot');

      // Fetch measurements
      set({ pipelineProgress: 'Loading measurements' });
      const { data: measurementData, error: measErr } = await fromTable('project_measurement')
        .select('*')
        .eq('project_id', projectId)
        .single();

      if (measErr) throw new Error(measErr.message ?? 'Failed to fetch measurements');

      // Fetch project configuration (latest version)
      set({ pipelineProgress: 'Loading configuration' });
      const { data: configData } = await fromTable('project_configuration')
        .select('*')
        .eq('project_id', projectId)
        .order('configuration_version', { ascending: false })
        .limit(1)
        .single();

      // Fetch project obstructions
      set({ pipelineProgress: 'Loading obstructions' });
      await fromTable('project_obstruction')
        .select('*')
        .eq('project_id', projectId);

      // Build pipeline input
      set({ pipelineProgress: 'Running pipeline' });
      const snapshot = snapshotData as Record<string, unknown>;
      const measurement = measurementData as Record<string, unknown>;
      const snapshotDataObj = (snapshot?.snapshot_data ?? { zones: [] }) as Record<string, unknown>;
      const snapshotVersion = (snapshotDataObj?.snapshot_version as number) ?? undefined;

      // Determine measurements using correct DB column names
      const wallWidthMm = (measurement?.wall_width_mm as number) ?? 0;
      const wallHeightMm = (measurement?.wall_height_mm as number) ?? 0;

      // Template dimensions come from snapshot_data.base_dimensions
      const baseDimensions = (snapshotDataObj?.base_dimensions as Record<string, unknown>) ?? {};
      const templateWallWidth = (baseDimensions?.width_mm as number) ?? wallWidthMm;
      const templateWallHeight = (baseDimensions?.height_mm as number) ?? undefined;

      // Version branch: v2 mapper or v1 legacy mapper
      let pipelineSnapshotData: BomPipelineInput['snapshotData'];
      let permissions: BomPipelineInput['permissions'];
      let compatibilityRules: BomPipelineInput['compatibilityRules'];
      let ruleSet: BomPipelineInput['ruleSet'];

      if (snapshotVersion === 2) {
        const typedSnapshot = snapshotDataObj as unknown as SnapshotData;
        pipelineSnapshotData = mapSnapshotToPipeline(typedSnapshot);
        permissions = mapPermissions(typedSnapshot);
        compatibilityRules = mapCompatibility(typedSnapshot);
        ruleSet = mapRuleSet(typedSnapshot);
      } else {
        // V1 legacy path
        pipelineSnapshotData = mapSnapshotV1ToPipeline(snapshotDataObj);
        permissions = mapPermissionsV1();
        compatibilityRules = mapCompatibilityV1();
        ruleSet = mapRuleSetV1();
      }

      // Build configuration from project_configuration data
      const configurationData = (configData as Record<string, unknown>)?.configuration_data as Record<string, unknown> | undefined;
      const configuration = (configurationData ?? {}) as BomPipelineInput['configuration'];

      const pipelineInput: BomPipelineInput = {
        snapshotData: pipelineSnapshotData,
        measurements: {
          wallWidth: wallWidthMm,
          wallHeight: wallHeightMm,
          templateWallWidth,
          templateWallHeight,
        },
        configuration,
        ruleSet,
        permissions,
        compatibilityRules,
      };

      // Execute pipeline
      const result = runBomPipeline(pipelineInput);

      set({
        pipelineStatus: result.status === 'SUCCESS' ? 'success' : 'blocked',
        pipelineErrors: result.errors,
        pipelineWarnings: result.warnings,
        pipelineOutputLines: result.actualBomLines,
        pipelineProgress: null,
      });
    } catch (err) {
      const errorMessage = (err as Error).message;
      set({
        pipelineStatus: 'blocked',
        pipelineErrors: [{
          code: ErrorCode.GEO_WALL_DIMENSION_INVALID,
          severity: ErrorSeverity.BLOCKING,
          category: ErrorCategory.GEOMETRY,
          message: `Pipeline failed: ${errorMessage}`,
          context: { source: 'supabase_fetch', originalError: errorMessage },
        }],
        pipelineWarnings: [],
        pipelineProgress: null,
        pipelineOutputLines: [],
        error: errorMessage,
      });
    }
  },

  resetBom: () => {
    set({ ...initialState });
  },
}));
