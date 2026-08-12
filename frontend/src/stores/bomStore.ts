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
import { fromTable } from '@/lib/supabase';

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
}

export interface BomActions {
  fetchMasterBom: (templateId: string) => Promise<void>;
  fetchActualBom: (projectId: string) => Promise<void>;
  fetchFinalBom: (projectId: string) => Promise<void>;
  computeReconciliation: () => void;
  openBomPanel: () => void;
  closeBomPanel: () => void;
  resetBom: () => void;
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

  openBomPanel: () => {
    set({ isBomPanelOpen: true });
  },

  closeBomPanel: () => {
    set({ isBomPanelOpen: false });
  },

  resetBom: () => {
    set({ ...initialState });
  },
}));
