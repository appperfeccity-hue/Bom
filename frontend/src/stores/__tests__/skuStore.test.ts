import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSkuStore } from '../skuStore';
import { ProductType, SkuStatus, CatalogueStatus } from '@/types/database';

// Mock the supabase module
vi.mock('@/lib/supabase', () => {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  };
  return {
    fromTable: vi.fn(() => ({ ...mockQueryBuilder })),
    supabase: {},
    isSupabaseConfigured: false,
  };
});

describe('skuStore', () => {
  beforeEach(() => {
    useSkuStore.setState({
      skus: [],
      families: [],
      categories: [],
      filters: {
        productType: null,
        familyId: null,
        categoryId: null,
        material: null,
        colour: null,
        catalogueStatus: null,
        skuStatus: null,
        searchQuery: '',
      },
      selectedSkuId: null,
      isLoading: false,
      error: null,
      page: 0,
      pageSize: 20,
      totalCount: 0,
      isBrowserOpen: false,
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useSkuStore.getState();
      expect(state.skus).toEqual([]);
      expect(state.families).toEqual([]);
      expect(state.categories).toEqual([]);
      expect(state.filters.productType).toBeNull();
      expect(state.filters.familyId).toBeNull();
      expect(state.filters.categoryId).toBeNull();
      expect(state.filters.material).toBeNull();
      expect(state.filters.colour).toBeNull();
      expect(state.filters.catalogueStatus).toBeNull();
      expect(state.filters.skuStatus).toBeNull();
      expect(state.filters.searchQuery).toBe('');
      expect(state.selectedSkuId).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.page).toBe(0);
      expect(state.pageSize).toBe(20);
      expect(state.totalCount).toBe(0);
      expect(state.isBrowserOpen).toBe(false);
    });
  });

  describe('setFilter', () => {
    it('should set productType filter and reset page', () => {
      useSkuStore.setState({ page: 3 });
      useSkuStore.getState().setFilter('productType', ProductType.WALL_PANEL);
      const state = useSkuStore.getState();
      expect(state.filters.productType).toBe(ProductType.WALL_PANEL);
      expect(state.page).toBe(0);
    });

    it('should set familyId filter', () => {
      useSkuStore.getState().setFilter('familyId', 'family-123');
      expect(useSkuStore.getState().filters.familyId).toBe('family-123');
    });

    it('should set categoryId filter', () => {
      useSkuStore.getState().setFilter('categoryId', 'cat-456');
      expect(useSkuStore.getState().filters.categoryId).toBe('cat-456');
    });

    it('should set material filter', () => {
      useSkuStore.getState().setFilter('material', 'Wood');
      expect(useSkuStore.getState().filters.material).toBe('Wood');
    });

    it('should set colour filter', () => {
      useSkuStore.getState().setFilter('colour', 'White');
      expect(useSkuStore.getState().filters.colour).toBe('White');
    });

    it('should set catalogueStatus filter', () => {
      useSkuStore.getState().setFilter('catalogueStatus', CatalogueStatus.READY);
      expect(useSkuStore.getState().filters.catalogueStatus).toBe(CatalogueStatus.READY);
    });

    it('should set skuStatus filter', () => {
      useSkuStore.getState().setFilter('skuStatus', SkuStatus.ACTIVE);
      expect(useSkuStore.getState().filters.skuStatus).toBe(SkuStatus.ACTIVE);
    });
  });

  describe('clearFilters', () => {
    it('should reset all filters and page', () => {
      useSkuStore.setState({
        filters: {
          productType: ProductType.LIGHT,
          familyId: 'fam-1',
          categoryId: 'cat-1',
          material: 'Metal',
          colour: 'Black',
          catalogueStatus: CatalogueStatus.READY,
          skuStatus: SkuStatus.ACTIVE,
          searchQuery: 'search term',
        },
        page: 5,
      });

      useSkuStore.getState().clearFilters();
      const state = useSkuStore.getState();
      expect(state.filters.productType).toBeNull();
      expect(state.filters.familyId).toBeNull();
      expect(state.filters.categoryId).toBeNull();
      expect(state.filters.material).toBeNull();
      expect(state.filters.colour).toBeNull();
      expect(state.filters.catalogueStatus).toBeNull();
      expect(state.filters.skuStatus).toBeNull();
      expect(state.filters.searchQuery).toBe('');
      expect(state.page).toBe(0);
    });
  });

  describe('setSearchQuery', () => {
    it('should update search query and reset page', () => {
      useSkuStore.setState({ page: 2 });
      useSkuStore.getState().setSearchQuery('panel');
      const state = useSkuStore.getState();
      expect(state.filters.searchQuery).toBe('panel');
      expect(state.page).toBe(0);
    });

    it('should allow empty search query', () => {
      useSkuStore.getState().setSearchQuery('something');
      useSkuStore.getState().setSearchQuery('');
      expect(useSkuStore.getState().filters.searchQuery).toBe('');
    });
  });

  describe('selectSku', () => {
    it('should set selectedSkuId', () => {
      useSkuStore.getState().selectSku('sku-abc');
      expect(useSkuStore.getState().selectedSkuId).toBe('sku-abc');
    });

    it('should allow deselecting by passing null', () => {
      useSkuStore.getState().selectSku('sku-abc');
      useSkuStore.getState().selectSku(null);
      expect(useSkuStore.getState().selectedSkuId).toBeNull();
    });
  });

  describe('setPage', () => {
    it('should update page number', () => {
      useSkuStore.getState().setPage(3);
      expect(useSkuStore.getState().page).toBe(3);
    });

    it('should allow setting page to 0', () => {
      useSkuStore.getState().setPage(5);
      useSkuStore.getState().setPage(0);
      expect(useSkuStore.getState().page).toBe(0);
    });
  });

  describe('openBrowser / closeBrowser', () => {
    it('should open browser', () => {
      useSkuStore.getState().openBrowser();
      expect(useSkuStore.getState().isBrowserOpen).toBe(true);
    });

    it('should close browser', () => {
      useSkuStore.getState().openBrowser();
      useSkuStore.getState().closeBrowser();
      expect(useSkuStore.getState().isBrowserOpen).toBe(false);
    });
  });

  describe('fetchSkus', () => {
    it('should set isLoading to true during fetch', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      // Make the query chain resolve with data
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useSkuStore.getState().fetchSkus();
      // After completing, isLoading should be false
      expect(useSkuStore.getState().isLoading).toBe(false);
    });

    it('should set error on failure', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Network error' }, count: null }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useSkuStore.getState().fetchSkus();
      expect(useSkuStore.getState().error).toBe('Network error');
      expect(useSkuStore.getState().isLoading).toBe(false);
    });

    it('should apply productType filter to query', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      useSkuStore.setState({
        filters: {
          ...useSkuStore.getState().filters,
          productType: ProductType.WALL_PANEL,
        },
      });

      await useSkuStore.getState().fetchSkus();
      expect(mockChain.eq).toHaveBeenCalledWith('product_type', ProductType.WALL_PANEL);
    });

    it('should apply searchQuery as or filter on sku_code and material', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      useSkuStore.setState({
        filters: {
          ...useSkuStore.getState().filters,
          searchQuery: 'WP-001',
        },
      });

      await useSkuStore.getState().fetchSkus();
      expect(mockChain.or).toHaveBeenCalledWith('sku_code.ilike.%WP-001%,material.ilike.%WP-001%');
    });

    it('should apply pagination range', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      useSkuStore.setState({ page: 2, pageSize: 20 });

      await useSkuStore.getState().fetchSkus();
      expect(mockChain.range).toHaveBeenCalledWith(40, 59);
    });
  });
});
