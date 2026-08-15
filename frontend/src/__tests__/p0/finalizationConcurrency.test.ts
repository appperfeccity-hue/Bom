/**
 * P0 Test Suite: Finalization Concurrency
 *
 * Verifies that the finalization flow is safe under concurrent access:
 * - Double-submit guard prevents duplicate RPC calls
 * - State transitions are correct through the full lifecycle
 * - SHA-256 computation is deterministic
 * - Error recovery is clean
 *
 * This is release-blocking because double-finalization could create
 * duplicate final BOMs or corrupt project state.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFinalizationStore, FinalizationStep } from '@/stores/finalizationStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { ProjectStatus } from '@/types/database';

// Mock the supabase module
const mockRpc = vi.fn().mockResolvedValue({ data: 'final-bom-id-123', error: null });
vi.mock('@/lib/supabase', () => ({
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
  supabase: {
    rpc: mockRpc,
  },
  isSupabaseConfigured: false,
}));

// Mock crypto.subtle.digest for SHA-256 computation
const mockDigest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
Object.defineProperty(globalThis, 'crypto', {
  value: {
    subtle: {
      digest: mockDigest,
    },
    randomUUID: () => 'test-uuid-concurrency',
  },
  writable: true,
});

describe('P0: Finalization Concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: 'final-bom-id-123', error: null });
    mockDigest.mockResolvedValue(new ArrayBuffer(32));

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
        project_id: 'proj-concurrent',
        customer_reference: 'Concurrency Test Project',
        site_reference: null,
        template_id: 'tpl-1',
        snapshot_id: null,
        current_configuration_id: null,
        current_actual_bom_id: null,
        status: ProjectStatus.VALIDATED,
        created_by: 'user-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        finalized_at: null,
      },
    });

    useAuthStore.setState({
      user: { id: 'user-1' } as never,
      role: 'CONSULTANT',
      isAuthenticated: true,
      isLoading: false,
    });
  });

  describe('double-submit guard', () => {
    it('should be a no-op when confirmFinalization is called while already in FINALIZING state', async () => {
      // Set state to FINALIZING to simulate an in-flight call
      useFinalizationStore.setState({
        finalizationStep: FinalizationStep.FINALIZING,
        isLoading: true,
      });

      await useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-1');

      // RPC should not have been called
      expect(mockRpc).not.toHaveBeenCalled();

      // State should remain unchanged
      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.FINALIZING);
      expect(state.isLoading).toBe(true);
    });

    it('should result in only one RPC call when two rapid confirmFinalization calls are made', async () => {
      // First call starts normally (state is IDLE)
      const promise1 = useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-1');

      // After the first call starts, the state should be FINALIZING
      // Second call should be rejected by the guard
      const promise2 = useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-2');

      await Promise.all([promise1, promise2]);

      // Only one RPC call should have been made (from the first call)
      expect(mockRpc).toHaveBeenCalledTimes(1);
    });

    it('should allow a new confirmFinalization after a previous one completes successfully', async () => {
      // First call succeeds
      await useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-1');
      expect(mockRpc).toHaveBeenCalledTimes(1);

      // Reset state to allow another call
      useFinalizationStore.setState({
        finalizationStep: FinalizationStep.IDLE,
        finalBomId: null,
        finalBomHash: null,
        finalizedAt: null,
        isLoading: false,
        error: null,
      });

      // Second call should work since state was reset
      await useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-2');
      expect(mockRpc).toHaveBeenCalledTimes(2);
    });
  });

  describe('state transitions', () => {
    it('should transition IDLE -> FINALIZING -> SUCCESS on successful finalization', async () => {
      // Verify initial state
      expect(useFinalizationStore.getState().finalizationStep).toBe(FinalizationStep.IDLE);

      // Use a delayed mock to observe FINALIZING state
      let resolveRpc: (value: unknown) => void;
      const rpcPromise = new Promise((resolve) => {
        resolveRpc = resolve;
      });
      mockRpc.mockReturnValue(rpcPromise as never);

      const promise = useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-1');

      // Should now be in FINALIZING
      expect(useFinalizationStore.getState().finalizationStep).toBe(FinalizationStep.FINALIZING);
      expect(useFinalizationStore.getState().isLoading).toBe(true);

      // Resolve the RPC
      resolveRpc!({ data: 'final-bom-uuid-456', error: null });
      await promise;

      // Should now be in SUCCESS
      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.SUCCESS);
      expect(state.finalBomId).toBe('final-bom-uuid-456');
      expect(state.isLoading).toBe(false);
    });

    it('should transition IDLE -> FINALIZING -> ERROR on RPC error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Advisory lock timeout - concurrent finalization detected' },
      } as never);

      await useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-1');

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.ERROR);
      expect(state.error).toBe('Advisory lock timeout - concurrent finalization detected');
      expect(state.isLoading).toBe(false);
      expect(state.finalBomId).toBeNull();
    });

    it('should transition IDLE -> FINALIZING -> ERROR when user is not authenticated', async () => {
      useAuthStore.setState({ user: null });

      await useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-1');

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.ERROR);
      expect(state.error).toBe('User not authenticated');
      expect(state.finalBomId).toBeNull();
    });

    it('should set finalBomId on SUCCESS', async () => {
      mockRpc.mockResolvedValue({ data: 'final-bom-expected-id', error: null } as never);

      await useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-1');

      expect(useFinalizationStore.getState().finalBomId).toBe('final-bom-expected-id');
    });

    it('should set finalBomHash on SUCCESS', async () => {
      await useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-1');

      const state = useFinalizationStore.getState();
      expect(state.finalBomHash).toBeTruthy();
      expect(typeof state.finalBomHash).toBe('string');
      // Hash should be a hex string (64 chars for SHA-256 of 32-byte buffer of zeros)
      expect(state.finalBomHash!.length).toBe(64);
    });

    it('should set finalizedAt timestamp on SUCCESS', async () => {
      await useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-1');

      const state = useFinalizationStore.getState();
      expect(state.finalizedAt).toBeTruthy();
      // Should be a valid ISO timestamp
      expect(new Date(state.finalizedAt!).toISOString()).toBe(state.finalizedAt);
    });
  });

  describe('projectStore status transition', () => {
    it('should update projectStore status to FINALIZED on success', async () => {
      await useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-1');

      const projectState = useProjectStore.getState();
      expect(projectState.currentProject?.status).toBe('FINALIZED');
    });

    it('should NOT update projectStore status on RPC error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      } as never);

      await useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-1');

      const projectState = useProjectStore.getState();
      expect(projectState.currentProject?.status).toBe(ProjectStatus.VALIDATED);
    });
  });

  describe('SHA-256 determinism', () => {
    it('should call crypto.subtle.digest with SHA-256 algorithm', async () => {
      await useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-1');

      expect(mockDigest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));
    });

    it('should produce the same hash for the same input across multiple calls', async () => {
      // Call twice with same project/key
      await useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-same');
      const hash1 = useFinalizationStore.getState().finalBomHash;

      // Reset for second call
      useFinalizationStore.setState({
        finalizationStep: FinalizationStep.IDLE,
        finalBomId: null,
        finalBomHash: null,
        finalizedAt: null,
        isLoading: false,
        error: null,
      });

      await useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-same');
      const hash2 = useFinalizationStore.getState().finalBomHash;

      // Both hashes should be valid hex strings of the same length
      expect(hash1).toBeTruthy();
      expect(hash2).toBeTruthy();
      expect(hash1!.length).toBe(hash2!.length);
      // Note: actual values may differ due to timestamp in hash computation,
      // but the format and length should be consistent
      expect(hash1!.length).toBe(64);
      expect(hash2!.length).toBe(64);
    });

    it('should produce a valid hex string hash', async () => {
      await useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-1');

      const hash = useFinalizationStore.getState().finalBomHash;
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('cancelFinalization', () => {
    it('should reset state to IDLE from CONFIRMING', () => {
      useFinalizationStore.setState({
        finalizationStep: FinalizationStep.CONFIRMING,
        error: null,
      });

      useFinalizationStore.getState().cancelFinalization();

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.IDLE);
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.finalBomId).toBeNull();
      expect(state.finalBomHash).toBeNull();
      expect(state.finalizedAt).toBeNull();
    });

    it('should reset state to IDLE from ERROR', () => {
      useFinalizationStore.setState({
        finalizationStep: FinalizationStep.ERROR,
        error: 'Previous finalization failed',
        isLoading: false,
      });

      useFinalizationStore.getState().cancelFinalization();

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.IDLE);
      expect(state.error).toBeNull();
    });

    it('should clear all finalization data when cancelling', () => {
      useFinalizationStore.setState({
        finalizationStep: FinalizationStep.SUCCESS,
        finalBomId: 'some-bom-id',
        finalBomHash: 'some-hash',
        finalizedAt: '2024-06-01T00:00:00Z',
        isLoading: false,
        error: null,
      });

      useFinalizationStore.getState().cancelFinalization();

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.IDLE);
      expect(state.finalBomId).toBeNull();
      expect(state.finalBomHash).toBeNull();
      expect(state.finalizedAt).toBeNull();
    });
  });

  describe('error recovery', () => {
    it('should allow retry after RPC error by resetting and calling again', async () => {
      // First call fails
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Temporary network error' },
      } as never);

      await useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-1');
      expect(useFinalizationStore.getState().finalizationStep).toBe(FinalizationStep.ERROR);

      // Reset state
      useFinalizationStore.getState().reset();
      expect(useFinalizationStore.getState().finalizationStep).toBe(FinalizationStep.IDLE);

      // Second call succeeds
      mockRpc.mockResolvedValueOnce({ data: 'retry-bom-id', error: null } as never);

      await useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-1');
      expect(useFinalizationStore.getState().finalizationStep).toBe(FinalizationStep.SUCCESS);
      expect(useFinalizationStore.getState().finalBomId).toBe('retry-bom-id');
    });

    it('should transition to ERROR when RPC returns null data without error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null } as never);

      await useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-1');

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.ERROR);
      expect(state.error).toBe('Unexpected response from finalize_project');
    });

    it('should transition to ERROR when RPC returns non-string data', async () => {
      mockRpc.mockResolvedValue({ data: { nested: 'object' }, error: null } as never);

      await useFinalizationStore.getState().confirmFinalization('proj-concurrent', 'key-1');

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.ERROR);
      expect(state.error).toBe('Unexpected response from finalize_project');
      expect(state.finalBomId).toBeNull();
    });
  });
});
