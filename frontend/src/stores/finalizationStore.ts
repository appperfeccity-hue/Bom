import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
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

      const timestamp = new Date().toISOString();
      const computedHash = await computeSha256(projectId + finalizationKey + timestamp);

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

      // Use the client-computed timestamp as the approximate finalized_at.
      // The server records its own `now()` for the authoritative value;
      // this client timestamp is for immediate display only.
      const finalizedAt = timestamp;

      // Update the project status in projectStore to FINALIZED
      const projectState = useProjectStore.getState();
      if (projectState.currentProject?.id === projectId) {
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
