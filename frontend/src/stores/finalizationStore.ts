import { create } from 'zustand';
import { supabase, fromTable } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { sortKeysDeep } from '@/lib/snapshotBuilder';
import type { Project } from '@/types/database';

// --- Finalization Step Enum ---

export enum FinalizationStep {
  IDLE = 'IDLE',
  CONFIRMING = 'CONFIRMING',
  FINALIZING = 'FINALIZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

// --- State / Actions / Store types ---

export interface FinalizationState {
  finalizationStep: FinalizationStep;
  finalBomId: string | null;
  finalBomHash: string | null;
  finalizedAt: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface FinalizationActions {
  startFinalization: () => void;
  confirmFinalization: (projectId: string, finalizationKey: string) => Promise<void>;
  cancelFinalization: () => void;
  reset: () => void;
}

export type FinalizationStore = FinalizationState & FinalizationActions;

const initialState: FinalizationState = {
  finalizationStep: FinalizationStep.IDLE,
  finalBomId: null,
  finalBomHash: null,
  finalizedAt: null,
  isLoading: false,
  error: null,
};

/**
 * Compute a SHA-256 hash of the input string.
 * Uses the Web Crypto API (available in modern browsers).
 */
async function computeSha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute the canonical hash from actual_bom_line rows fetched from DB.
 * Mirrors the server-side computation: JSON of selected fields per line,
 * concatenated with commas, ordered by actual_bom_line_id.
 */
async function computeHashFromLines(lines: Record<string, unknown>[]): Promise<string> {
  // Build canonical representation matching server-side row_to_json output.
  // Select the same columns used in the server-side hash computation.
  const canonicalParts = lines.map((line) => {
    const subset = {
      actual_bom_line_id: line.actual_bom_line_id,
      sku_id: line.sku_id,
      sku_code: line.sku_code,
      product_type: line.product_type,
      quantity: line.quantity,
      required_quantity: line.required_quantity,
      waste_quantity: line.waste_quantity,
      unit_of_measure: line.unit_of_measure,
      resolved_dimensions: line.resolved_dimensions,
      source_zone_id: line.source_zone_id ?? line.component_id,
      source_trace: {
        snapshot_id: line.snapshot_id ?? null,
        configuration_id: line.configuration_id ?? null,
        actual_bom_id: line.actual_bom_id,
        actual_bom_line_id: line.actual_bom_line_id,
        rule_set_id: line.rule_set_id ?? null,
        zone_id: line.component_id,
      },
    };
    return JSON.stringify(sortKeysDeep(subset));
  });
  const canonical = canonicalParts.join(',');
  return computeSha256(canonical);
}

export const useFinalizationStore = create<FinalizationStore>((set, get) => ({
  ...initialState,

  startFinalization: () => {
    set({ finalizationStep: FinalizationStep.CONFIRMING, error: null });
  },

  confirmFinalization: async (projectId: string, finalizationKey: string) => {
    // Guard: prevent double-submit while already finalizing
    if (get().finalizationStep === FinalizationStep.FINALIZING) return;

    set({ finalizationStep: FinalizationStep.FINALIZING, isLoading: true, error: null });

    try {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Precondition: project must be VALIDATED with a current_actual_bom_id
      const project = useProjectStore.getState().currentProject;
      if (!project || project.status !== 'VALIDATED') {
        throw new Error('Project must be in VALIDATED status to finalize');
      }
      if (!project.current_actual_bom_id) {
        throw new Error('Project has no current actual BOM');
      }

      // Fetch persisted actual_bom_line rows from DB for hash computation
      const { data: bomLines, error: linesError } = await fromTable('actual_bom_line')
        .select('*')
        .eq('actual_bom_id', project.current_actual_bom_id)
        .order('actual_bom_line_id');

      if (linesError) throw linesError;
      if (!bomLines || bomLines.length === 0) {
        throw new Error('No BOM lines found for the current actual BOM');
      }

      // Fetch actual_bom metadata for lineage fields
      const { data: actualBom, error: bomError } = await fromTable('actual_bom')
        .select('actual_bom_id, configuration_id, rule_set_id')
        .eq('actual_bom_id', project.current_actual_bom_id)
        .single();

      if (bomError) throw bomError;

      // Enrich lines with lineage metadata for hash computation
      const enrichedLines = bomLines.map((line: Record<string, unknown>) => ({
        ...line,
        snapshot_id: project.snapshot_id,
        configuration_id: actualBom?.configuration_id ?? null,
        rule_set_id: actualBom?.rule_set_id ?? null,
      }));

      // Compute hash from the persisted DB rows (not from Zustand memory)
      const computedHash = await computeHashFromLines(enrichedLines);

      const { data, error } = await supabase.rpc('finalize_project', {
        p_project_id: projectId,
        p_user_id: userId,
        p_finalization_key: finalizationKey,
        p_computed_final_hash: computedHash,
      });

      if (error) throw error;

      // Validate RPC response shape
      if (!data || typeof data !== 'string') {
        throw new Error('Unexpected response from finalize_project');
      }

      const finalBomId = data;
      const finalizedAt = new Date().toISOString();

      // Update the project status in projectStore to FINALIZED
      const projectState = useProjectStore.getState();
      if (projectState.currentProject?.project_id === projectId) {
        useProjectStore.setState({
          currentProject: {
            ...projectState.currentProject,
            status: 'FINALIZED' as Project['status'],
          },
        });
      }

      set({
        finalizationStep: FinalizationStep.SUCCESS,
        finalBomId,
        finalBomHash: computedHash,
        finalizedAt,
        isLoading: false,
      });
    } catch (err) {
      set({
        finalizationStep: FinalizationStep.ERROR,
        error: (err as Error).message,
        isLoading: false,
      });
    }
  },

  cancelFinalization: () => {
    set({ ...initialState });
  },

  reset: () => {
    set({ ...initialState });
  },
}));
