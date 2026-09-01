import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFinalizationStore, FinalizationStep } from '../finalizationStore';
import { useProjectStore } from '../projectStore';
import { useAuthStore } from '../authStore';
import { ProjectStatus } from '@/types/database';

// Mock the supabase module - factory must not reference outer variables (hoisted)
vi.mock('@/lib/supabase', () => {
  const mockRpc = vi.fn().mockResolvedValue({ data: 'final-bom-id-123', error: null });
  const mockSingle = vi.fn().mockResolvedValue({
    data: { actual_bom_id: 'bom-1', configuration_id: 'config-1', rule_set_id: 'rs-1' },
    error: null,
  });
  const mockOrder = vi.fn().mockResolvedValue({
    data: [
      {
        actual_bom_line_id: 'line-1',
        actual_bom_id: 'bom-1',
        sku_id: 'sku-1',
        sku_code: 'SKU001',
        product_type: 'PANEL',
        component_id: 'zone-1',
        quantity: 10,
        required_quantity: 10,
        waste_quantity: 0,
        unit_of_measure: 'unit',
        resolved_dimensions: { width_mm: 100 },
      },
    ],
    error: null,
  });
  const mockEq = vi.fn().mockReturnThis();
  const mockSelect = vi.fn().mockReturnThis();

  const fromTableFn = vi.fn(() => ({
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    single: mockSingle,
  }));

  return {
    fromTable: fromTableFn,
    supabase: {
      rpc: mockRpc,
    },
    isSupabaseConfigured: false,
    // Expose mocks for test access
    __mocks: { mockRpc, mockSingle, mockOrder, mockEq, mockSelect, fromTableFn },
  };
});

// Mock sortKeysDeep
vi.mock('@/lib/snapshotBuilder', () => ({
  sortKeysDeep: (v: unknown) => v,
}));

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

// Helper to get mock functions from the hoisted mock module
async function getMocks() {
  const mod = await import('@/lib/supabase') as unknown as {
    __mocks: {
      mockRpc: ReturnType<typeof vi.fn>;
      mockSingle: ReturnType<typeof vi.fn>;
      mockOrder: ReturnType<typeof vi.fn>;
      mockEq: ReturnType<typeof vi.fn>;
      mockSelect: ReturnType<typeof vi.fn>;
      fromTableFn: ReturnType<typeof vi.fn>;
    };
    fromTable: ReturnType<typeof vi.fn>;
    supabase: { rpc: ReturnType<typeof vi.fn> };
  };
  return mod.__mocks;
}

describe('finalizationStore', () => {
  let mocks: Awaited<ReturnType<typeof getMocks>>;

  beforeEach(async () => {
    mocks = await getMocks();

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
        project_id: 'proj-1',
        customer_reference: 'Test Project',
        site_reference: null,
        template_id: 'tpl-1',
        snapshot_id: 'snap-1',
        current_configuration_id: 'config-1',
        current_actual_bom_id: 'bom-1',
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
    mockDigest.mockResolvedValue(new ArrayBuffer(32));
    mocks.mockRpc.mockResolvedValue({ data: 'final-bom-id-123', error: null });
    mocks.mockOrder.mockResolvedValue({
      data: [
        {
          actual_bom_line_id: 'line-1',
          actual_bom_id: 'bom-1',
          sku_id: 'sku-1',
          sku_code: 'SKU001',
          product_type: 'PANEL',
          component_id: 'zone-1',
          quantity: 10,
          required_quantity: 10,
          waste_quantity: 0,
          unit_of_measure: 'unit',
          resolved_dimensions: { width_mm: 100 },
        },
      ],
      error: null,
    });
    mocks.mockSingle.mockResolvedValue({
      data: { actual_bom_id: 'bom-1', configuration_id: 'config-1', rule_set_id: 'rs-1' },
      error: null,
    });
    mocks.mockSelect.mockReturnThis();
    mocks.mockEq.mockReturnThis();
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
      await useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-1');

      expect(mocks.mockRpc).toHaveBeenCalledWith('finalize_project', {
        p_project_id: 'proj-1',
        p_user_id: 'user-1',
        p_finalization_key: 'fin-key-1',
        p_computed_final_hash: expect.any(String),
      });

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.SUCCESS);
      expect(state.finalBomId).toBe('final-bom-id-123');
      expect(state.finalBomHash).toBeTruthy();
      expect(state.finalizedAt).toBeTruthy();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('fetches actual_bom_line rows from DB for hash computation', async () => {
      await useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-1');

      // Should have called fromTable to fetch actual_bom_line
      expect(mocks.fromTableFn).toHaveBeenCalledWith('actual_bom_line');
      // Should have called fromTable to fetch actual_bom metadata
      expect(mocks.fromTableFn).toHaveBeenCalledWith('actual_bom');
    });

    it('updates projectStore status to FINALIZED on success', async () => {
      await useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-1');

      const projectState = useProjectStore.getState();
      expect(projectState.currentProject?.status).toBe('FINALIZED');
    });

    it('transitions to ERROR on rpc failure', async () => {
      mocks.mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Advisory lock timeout' },
      });

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

    it('transitions to ERROR when project is not VALIDATED', async () => {
      useProjectStore.setState({
        currentProject: {
          project_id: 'proj-1',
          customer_reference: 'Test Project',
          site_reference: null,
          template_id: 'tpl-1',
          snapshot_id: 'snap-1',
          current_configuration_id: 'config-1',
          current_actual_bom_id: 'bom-1',
          status: ProjectStatus.DRAFT,
          created_by: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          finalized_at: null,
        },
      });

      await useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-1');

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.ERROR);
      expect(state.error).toBe('Project must be in VALIDATED status to finalize');
    });

    it('transitions to ERROR when project has no current_actual_bom_id', async () => {
      useProjectStore.setState({
        currentProject: {
          project_id: 'proj-1',
          customer_reference: 'Test Project',
          site_reference: null,
          template_id: 'tpl-1',
          snapshot_id: 'snap-1',
          current_configuration_id: 'config-1',
          current_actual_bom_id: null,
          status: ProjectStatus.VALIDATED,
          created_by: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          finalized_at: null,
        },
      });

      await useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-1');

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.ERROR);
      expect(state.error).toBe('Project has no current actual BOM');
    });

    it('transitions to ERROR when fetching BOM lines fails', async () => {
      mocks.mockOrder.mockResolvedValue({
        data: null,
        error: { message: 'Failed to fetch BOM lines' },
      });

      await useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-1');

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.ERROR);
      expect(state.error).toBe('Failed to fetch BOM lines');
    });

    it('transitions to ERROR when no BOM lines found', async () => {
      mocks.mockOrder.mockResolvedValue({
        data: [],
        error: null,
      });

      await useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-1');

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.ERROR);
      expect(state.error).toBe('No BOM lines found for the current actual BOM');
    });

    it('sets isLoading true during finalization', async () => {
      let resolveRpc: (value: unknown) => void;
      const rpcPromise = new Promise((resolve) => {
        resolveRpc = resolve;
      });
      mocks.mockRpc.mockReturnValue(rpcPromise as never);

      const promise = useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-1');

      // During finalization, isLoading should be true
      expect(useFinalizationStore.getState().isLoading).toBe(true);
      expect(useFinalizationStore.getState().finalizationStep).toBe(FinalizationStep.FINALIZING);

      resolveRpc!({ data: 'final-bom-uuid', error: null });
      await promise;

      expect(useFinalizationStore.getState().isLoading).toBe(false);
    });

    it('idempotency - calling confirm twice with same key succeeds', async () => {
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
      // Re-set project to VALIDATED for the second call
      useProjectStore.setState({
        currentProject: {
          project_id: 'proj-1',
          customer_reference: 'Test Project',
          site_reference: null,
          template_id: 'tpl-1',
          snapshot_id: 'snap-1',
          current_configuration_id: 'config-1',
          current_actual_bom_id: 'bom-1',
          status: ProjectStatus.VALIDATED,
          created_by: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          finalized_at: null,
        },
      });

      await useFinalizationStore.getState().confirmFinalization('proj-1', 'same-key');

      const secondState = useFinalizationStore.getState();
      expect(secondState.finalizationStep).toBe(FinalizationStep.SUCCESS);
      expect(secondState.finalBomId).toBe('final-bom-id-123');
    });

    it('guards against double-submit when step is already FINALIZING', async () => {
      // Clear any mock calls from previous tests
      mocks.mockRpc.mockClear();

      // Set state to FINALIZING to simulate in-flight call
      useFinalizationStore.setState({ finalizationStep: FinalizationStep.FINALIZING, isLoading: true });

      await useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-2');

      // Should not have called RPC
      expect(mocks.mockRpc).not.toHaveBeenCalled();
      // State should remain unchanged
      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.FINALIZING);
      expect(state.isLoading).toBe(true);
    });

    it('transitions to ERROR when RPC returns null data', async () => {
      mocks.mockRpc.mockResolvedValue({ data: null, error: null });

      await useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-1');

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.ERROR);
      expect(state.error).toBe('Unexpected response from finalize_project');
      expect(state.finalBomId).toBeNull();
    });

    it('transitions to ERROR when RPC returns non-string data', async () => {
      mocks.mockRpc.mockResolvedValue({ data: { id: 'obj' }, error: null });

      await useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-1');

      const state = useFinalizationStore.getState();
      expect(state.finalizationStep).toBe(FinalizationStep.ERROR);
      expect(state.error).toBe('Unexpected response from finalize_project');
      expect(state.finalBomId).toBeNull();
    });

    it('computes hash using crypto.subtle.digest (SHA-256)', async () => {
      mockDigest.mockClear();

      await useFinalizationStore.getState().confirmFinalization('proj-1', 'fin-key-1');

      // Should have called crypto.subtle.digest with SHA-256
      expect(mockDigest).toHaveBeenCalled();
      const [algorithm, data] = mockDigest.mock.calls[0];
      expect(algorithm).toBe('SHA-256');
      // Verify data is a Uint8Array-like (jsdom environment has separate realm)
      expect(data.constructor.name).toBe('Uint8Array');
      expect(data.length).toBeGreaterThan(0);
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
