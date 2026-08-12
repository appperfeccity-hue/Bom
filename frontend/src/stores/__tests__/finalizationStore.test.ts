import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFinalizationStore, FinalizationStep } from '../finalizationStore';
import { useProjectStore } from '../projectStore';
import { useAuthStore } from '../authStore';
import { ProjectStatus } from '@/types/database';

// Mock the supabase module
vi.mock('@/lib/supabase', () => {
  const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
  return {
    fromTable: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    supabase: {
      schema: vi.fn(() => ({
        rpc: mockRpc,
      })),
    },
    isSupabaseConfigured: false,
  };
});

// Mock crypto.subtle.digest for SHA-256 computation
const mockDigest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
Object.defineProperty(globalThis, 'crypto', {
  value: {
    subtle: {
      digest: mockDigest,
    },
    randomUUID: () => 'test-uuid-1234',
  },
  writable: true,
});

describe('finalizationStore', () => {
  beforeEach(() => {
    useFinalizationStore.setState({
      finalizationStep: FinalizationStep.IDLE,
      finalBomId: null,
      finalBomHash: null,
      finalizedAt: null,
      isLoading: false,
      error: null,
    });
    useProjectStore.setState({
      currentProject: {
        id: 'proj-1',
        name: 'Test Project',
        template_id: 'tpl-1',
        status: ProjectStatus.VALIDATED,
        client_name: 'Client',
        created_by: 'user-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        version: 1,
      },
    });
    useAuthStore.setState({
      user: { id: 'user-1' } as never,
      role: 'CONSULTANT',
      isAuthenticated: true,
      isLoading: false,
    });
    mockDigest.mockResolvedValue(new ArrayBuffer(32));
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      useFinalizationStore.getState().reset();
      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.IDLE);
      expect(state.finalBomId).toBeNull();
      expect(state.finalBomHash).toBeNull();
      expect(state.finalizedAt).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('startFinalization', () => {
    it('transitions to CONFIRMING step', () => {
      useFinalizationStore.getState().startFinalization();
      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.CONFIRMING);
      expect(state.error).toBeNull();
    });

    it('clears previous error when starting', () => {
      useFinalizationStore.setState({ error: 'previous error' });
      useFinalizationStore.getState().startFinalization();
      const state = useFinalizationStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('confirmFinalization', () => {
    it('calls supabase rpc and transitions to SUCCESS on success', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockRpc = vi.fn().mockResolvedValue({ data: 'final-bom-uuid-123', error: null });
      vi.mocked(supabase.schema).mockReturnValue({ rpc: mockRpc } as never);

      await useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-1');

      expect(supabase.schema).toHaveBeenCalledWith('perfecity');
      expect(mockRpc).toHaveBeenCalledWith('finalize_project', {
        p_project_id: 'proj-1',
        p_user_id: 'user-1',
        p_finalization_key: 'fin-key-1',
        p_computed_final_hash: expect.any(String),
      });

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.SUCCESS);
      expect(state.finalBomId).toBe('final-bom-uuid-123');
      expect(state.finalBomHash).toBeTruthy();
      expect(state.finalizedAt).toBeTruthy();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('updates projectStore status to FINALIZED on success', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockRpc = vi.fn().mockResolvedValue({ data: 'final-bom-uuid-123', error: null });
      vi.mocked(supabase.schema).mockReturnValue({ rpc: mockRpc } as never);

      await useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-1');

      const projectState = useProjectStore.getState();
      expect(projectState.currentProject?.status).toBe('FINALIZED');
    });

    it('transitions to ERROR on rpc failure', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Advisory lock timeout' },
      });
      vi.mocked(supabase.schema).mockReturnValue({ rpc: mockRpc } as never);

      await useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-1');

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.ERROR);
      expect(state.error).toBe('Advisory lock timeout');
      expect(state.isLoading).toBe(false);
      expect(state.finalBomId).toBeNull();
    });

    it('transitions to ERROR when user is not authenticated', async () => {
      useAuthStore.setState({ user: null });

      await useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-1');

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.ERROR);
      expect(state.error).toBe('User not authenticated');
    });

    it('sets isLoading true during finalization', async () => {
      const { supabase } = await import('@/lib/supabase');
      let resolveRpc: (value: unknown) => void;
      const rpcPromise = new Promise((resolve) => {
        resolveRpc = resolve;
      });
      const mockRpc = vi.fn().mockReturnValue(rpcPromise);
      vi.mocked(supabase.schema).mockReturnValue({ rpc: mockRpc } as never);

      const promise = useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-1');

      // During finalization, isLoading should be true
      expect(useFinalizationStore.getState().isLoading).toBe(true);
      expect(useFinalizationStore.getState().finalizationStep).toBe(FinalizationStep.FINALIZING);

      resolveRpc!({ data: 'final-bom-uuid', error: null });
      await promise;

      expect(useFinalizationStore.getState().isLoading).toBe(false);
    });

    it('idempotency - calling confirm twice with same key succeeds', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockRpc = vi.fn().mockResolvedValue({ data: 'final-bom-uuid-123', error: null });
      vi.mocked(supabase.schema).mockReturnValue({ rpc: mockRpc } as never);

      await useFinalizationStore.getState().confirmFinalization('proj-1', 'same-key');

      const firstState = useFinalizationStore.getState();
      expect(firstState.finalizationStep).toBe(FinalizationStep.SUCCESS);

      // Reset and call again with same key
      useFinalizationStore.setState({
        finalizationStep: FinalizationStep.IDLE,
        finalBomId: null,
        finalBomHash: null,
        finalizedAt: null,
        isLoading: false,
        error: null,
      });

      await useFinalizationStore.getState().confirmFinalization('proj-1', 'same-key');

      const secondState = useFinalizationStore.getState();
      expect(secondState.finalizationStep).toBe(FinalizationStep.SUCCESS);
      expect(secondState.finalBomId).toBe('final-bom-uuid-123');
    });

    it('guards against double-submit when step is already FINALIZING', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockRpc = vi.fn().mockResolvedValue({ data: 'final-bom-uuid-123', error: null });
      vi.mocked(supabase.schema).mockReturnValue({ rpc: mockRpc } as never);

      // Set state to FINALIZING to simulate in-flight call
      useFinalizationStore.setState({ finalizationStep: FinalizationStep.FINALIZING, isLoading: true });

      await useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-2');

      // Should not have called RPC
      expect(mockRpc).not.toHaveBeenCalled();
      // State should remain unchanged
      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.FINALIZING);
      expect(state.isLoading).toBe(true);
    });

    it('transitions to ERROR when RPC returns null data', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
      vi.mocked(supabase.schema).mockReturnValue({ rpc: mockRpc } as never);

      await useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-1');

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.ERROR);
      expect(state.error).toBe('Unexpected response from finalize_project');
      expect(state.finalBomId).toBeNull();
    });

    it('transitions to ERROR when RPC returns non-string data', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockRpc = vi.fn().mockResolvedValue({ data: { id: 'obj' }, error: null });
      vi.mocked(supabase.schema).mockReturnValue({ rpc: mockRpc } as never);

      await useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-1');

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.ERROR);
      expect(state.error).toBe('Unexpected response from finalize_project');
      expect(state.finalBomId).toBeNull();
    });
  });

  describe('cancelFinalization', () => {
    it('resets to IDLE state', () => {
      useFinalizationStore.setState({
        finalizationStep: FinalizationStep.CONFIRMING,
        error: 'some error',
      });

      useFinalizationStore.getState().cancelFinalization();

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.IDLE);
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('reset', () => {
    it('returns to initial state', () => {
      useFinalizationStore.setState({
        finalizationStep: FinalizationStep.SUCCESS,
        finalBomId: 'bom-1',
        finalBomHash: 'hash-abc',
        finalizedAt: '2024-01-01T00:00:00Z',
        isLoading: true,
        error: 'old error',
      });

      useFinalizationStore.getState().reset();

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.IDLE);
      expect(state.finalBomId).toBeNull();
      expect(state.finalBomHash).toBeNull();
      expect(state.finalizedAt).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
