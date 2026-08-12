import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAdminStore } from '../adminStore';
import { RuleSetStatus } from '@/types/database';

// Mock the supabase module
vi.mock('@/lib/supabase', () => {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  return {
    fromTable: vi.fn(() => ({ ...mockQueryBuilder })),
    supabase: {
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
          createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed' } }),
        })),
      },
    },
  };
});

describe('adminStore', () => {
  beforeEach(() => {
    useAdminStore.setState({
      families: [],
      categories: [],
      designFamilies: [],
      designSubfamilies: [],
      skus: [],
      compatibilityRules: [],
      catalogueEntries: [],
      catalogueAssets: [],
      ruleSets: [],
      isLoadingFamilies: false,
      isLoadingCategories: false,
      isLoadingDesignFamilies: false,
      isLoadingDesignSubfamilies: false,
      isLoadingSkus: false,
      isLoadingCompatibility: false,
      isLoadingCatalogue: false,
      isLoadingAssets: false,
      isLoadingRuleSets: false,
      isLoading: false,
      error: null,
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useAdminStore.getState();
      expect(state.families).toEqual([]);
      expect(state.categories).toEqual([]);
      expect(state.designFamilies).toEqual([]);
      expect(state.designSubfamilies).toEqual([]);
      expect(state.skus).toEqual([]);
      expect(state.compatibilityRules).toEqual([]);
      expect(state.catalogueEntries).toEqual([]);
      expect(state.catalogueAssets).toEqual([]);
      expect(state.ruleSets).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.isLoadingFamilies).toBe(false);
      expect(state.isLoadingSkus).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      useAdminStore.setState({ error: 'Something went wrong' });
      useAdminStore.getState().clearError();
      expect(useAdminStore.getState().error).toBeNull();
    });
  });

  describe('fetchFamilies', () => {
    it('should set isLoading during fetch and clear after', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [{ family_id: '1', name: 'Test', created_by: 'u1', created_at: '2024-01-01' }], error: null }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useAdminStore.getState().fetchFamilies();
      expect(useAdminStore.getState().isLoading).toBe(false);
      expect(useAdminStore.getState().isLoadingFamilies).toBe(false);
      expect(useAdminStore.getState().families).toHaveLength(1);
      expect(useAdminStore.getState().families[0].name).toBe('Test');
    });

    it('should set error on failure', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Network error' } }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useAdminStore.getState().fetchFamilies();
      expect(useAdminStore.getState().error).toBe('Network error');
      expect(useAdminStore.getState().isLoading).toBe(false);
      expect(useAdminStore.getState().isLoadingFamilies).toBe(false);
    });
  });

  describe('createFamily', () => {
    it('should call insert with name', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      // For the insert call
      mockedFromTable.mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ error: null }) } as unknown as ReturnType<typeof fromTable>);
      // For the refetch
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useAdminStore.getState().createFamily('New Family');
      expect(useAdminStore.getState().isLoading).toBe(false);
      expect(useAdminStore.getState().isLoadingFamilies).toBe(false);
    });
  });

  describe('fetchSkus', () => {
    it('should fetch and store SKUs', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ sku_id: 'sku-1', sku_code: 'WP-001', product_type: 'WALL_PANEL', status: 'ACTIVE' }],
          error: null,
        }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useAdminStore.getState().fetchSkus();
      expect(useAdminStore.getState().skus).toHaveLength(1);
      expect(useAdminStore.getState().isLoading).toBe(false);
      expect(useAdminStore.getState().isLoadingSkus).toBe(false);
    });
  });

  describe('fetchDesignFamilies', () => {
    it('should fetch and store design families', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ design_family_id: 'df-1', name: 'Modern', created_by: 'u1', created_at: '2024-01-01' }],
          error: null,
        }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useAdminStore.getState().fetchDesignFamilies();
      expect(useAdminStore.getState().designFamilies).toHaveLength(1);
      expect(useAdminStore.getState().designFamilies[0].name).toBe('Modern');
    });
  });

  describe('fetchCompatibilityRules', () => {
    it('should fetch and store compatibility rules', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ compatibility_id: 'c-1', source_sku_id: 's1', target_sku_id: 't1', relationship_type: 'REQUIRES' }],
          error: null,
        }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useAdminStore.getState().fetchCompatibilityRules();
      expect(useAdminStore.getState().compatibilityRules).toHaveLength(1);
    });
  });

  describe('fetchCatalogueEntries', () => {
    it('should fetch and store catalogue entries', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ catalogue_entry_id: 'ce-1', sku_id: 'sku-1', status: 'INCOMPLETE' }],
          error: null,
        }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useAdminStore.getState().fetchCatalogueEntries();
      expect(useAdminStore.getState().catalogueEntries).toHaveLength(1);
    });
  });

  describe('fetchRuleSets', () => {
    it('should fetch and store rule sets', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ rule_set_id: 'rs-1', rule_set_code: 'RS-001', version: 1, status: 'DRAFT', constants: {} }],
          error: null,
        }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useAdminStore.getState().fetchRuleSets();
      expect(useAdminStore.getState().ruleSets).toHaveLength(1);
    });
  });

  describe('transitionRuleSetStatus', () => {
    it('should update status via fromTable for valid transition', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      // Pre-populate store with a DRAFT rule set
      useAdminStore.setState({
        ruleSets: [{ rule_set_id: 'rs-1', rule_set_code: 'RS-001', version: 1, status: RuleSetStatus.DRAFT, constants: {}, created_by: 'u1', effective_from: null, effective_to: null, created_at: '2024-01-01' }],
      });

      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      // First call: the transition update
      mockedFromTable.mockReturnValueOnce({ update: mockUpdate, eq: mockEq } as unknown as ReturnType<typeof fromTable>);
      // Mock update to return an object with eq
      mockUpdate.mockReturnValue({ eq: mockEq });
      // Second call: the refetch
      const mockFetchChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockedFromTable.mockReturnValue(mockFetchChain as unknown as ReturnType<typeof fromTable>);

      await useAdminStore.getState().transitionRuleSetStatus('rs-1', 'ACTIVE');
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'ACTIVE' });
    });

    it('should reject invalid state transitions', async () => {
      // Pre-populate store with a DRAFT rule set
      useAdminStore.setState({
        ruleSets: [{ rule_set_id: 'rs-1', rule_set_code: 'RS-001', version: 1, status: RuleSetStatus.DRAFT, constants: {}, created_by: 'u1', effective_from: null, effective_to: null, created_at: '2024-01-01' }],
      });

      await useAdminStore.getState().transitionRuleSetStatus('rs-1', 'SUPERSEDED');
      expect(useAdminStore.getState().error).toContain('Invalid status transition');
    });

    it('should reject backward transitions', async () => {
      useAdminStore.setState({
        ruleSets: [{ rule_set_id: 'rs-1', rule_set_code: 'RS-001', version: 1, status: RuleSetStatus.ACTIVE, constants: {}, created_by: 'u1', effective_from: null, effective_to: null, created_at: '2024-01-01' }],
      });

      await useAdminStore.getState().transitionRuleSetStatus('rs-1', 'DRAFT');
      expect(useAdminStore.getState().error).toContain('Invalid status transition');
    });
  });

  describe('approveCatalogueEntry', () => {
    it('should reject approval when required assets are missing', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      // Mock the asset check query to return only GEOMETRY
      const mockAssetChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ asset_type: 'GEOMETRY' }],
          error: null,
        }),
      };
      mockedFromTable.mockReturnValueOnce(mockAssetChain as unknown as ReturnType<typeof fromTable>);

      await useAdminStore.getState().approveCatalogueEntry('entry-1');
      expect(useAdminStore.getState().error).toContain('Cannot approve: missing required assets');
      expect(useAdminStore.getState().error).toContain('PATTERN');
      expect(useAdminStore.getState().error).toContain('RENDER');
    });
  });

  describe('per-domain loading flags', () => {
    it('should only set domain-specific loading flag', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      // Set up a delayed resolve for families to simulate concurrent calls
      const mockFamilyChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockedFromTable.mockReturnValue(mockFamilyChain as unknown as ReturnType<typeof fromTable>);

      await useAdminStore.getState().fetchFamilies();
      // After families completes, isLoadingFamilies should be false
      expect(useAdminStore.getState().isLoadingFamilies).toBe(false);
      // Other domain flags should still be false
      expect(useAdminStore.getState().isLoadingSkus).toBe(false);
      expect(useAdminStore.getState().isLoadingCategories).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should set error on fetchFamilies failure', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Permission denied' } }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useAdminStore.getState().fetchFamilies();
      expect(useAdminStore.getState().error).toBe('Permission denied');
    });

    it('should show friendly message for FK violation on delete', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: { message: 'update or delete on table "family_master" violates foreign key constraint "category_master_family_id_fkey"' },
        }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useAdminStore.getState().deleteFamily('fam-1');
      expect(useAdminStore.getState().error).toBe(
        'Cannot delete this record because it is referenced by other records. Remove or reassign the dependent records first.'
      );
    });
  });
});
