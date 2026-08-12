import { create } from 'zustand';
import type {
  SkuWithCatalogue,
  FamilyMaster,
  CategoryMaster,
} from '@/types/database';
import {
  ProductType,
  SkuStatus,
  CatalogueStatus,
} from '@/types/database';
import { fromTable } from '@/lib/supabase';

export interface SkuFilters {
  productType: ProductType | null;
  familyId: string | null;
  categoryId: string | null;
  material: string | null;
  colour: string | null;
  catalogueStatus: CatalogueStatus | null;
  skuStatus: SkuStatus | null;
  searchQuery: string;
}

export interface SkuState {
  skus: SkuWithCatalogue[];
  families: FamilyMaster[];
  categories: CategoryMaster[];
  filters: SkuFilters;
  selectedSkuId: string | null;
  isLoading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  totalCount: number;
  isBrowserOpen: boolean;
}

export interface SkuActions {
  fetchSkus: () => Promise<void>;
  fetchFamilies: () => Promise<void>;
  fetchCategories: (familyId?: string) => Promise<void>;
  setFilter: <K extends keyof SkuFilters>(key: K, value: SkuFilters[K]) => void;
  clearFilters: () => void;
  setSearchQuery: (query: string) => void;
  selectSku: (id: string | null) => void;
  setPage: (page: number) => void;
  openBrowser: () => void;
  closeBrowser: () => void;
}

export type SkuStore = SkuState & SkuActions;

const initialFilters: SkuFilters = {
  productType: null,
  familyId: null,
  categoryId: null,
  material: null,
  colour: null,
  catalogueStatus: null,
  skuStatus: null,
  searchQuery: '',
};

const initialState: SkuState = {
  skus: [],
  families: [],
  categories: [],
  filters: { ...initialFilters },
  selectedSkuId: null,
  isLoading: false,
  error: null,
  page: 0,
  pageSize: 20,
  totalCount: 0,
  isBrowserOpen: false,
};

export const useSkuStore = create<SkuStore>((set, get) => ({
  ...initialState,

  fetchSkus: async () => {
    set({ isLoading: true, error: null });
    try {
      const { filters, page, pageSize } = get();
      const from = page * pageSize;
      const to = from + pageSize - 1;

      // Build query on sku_master
      let query = fromTable('sku_master')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filters.productType) {
        query = query.eq('product_type', filters.productType);
      }
      if (filters.familyId) {
        query = query.eq('family_id', filters.familyId);
      }
      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }
      if (filters.material) {
        query = query.eq('material', filters.material);
      }
      if (filters.colour) {
        query = query.eq('colour', filters.colour);
      }
      if (filters.skuStatus) {
        query = query.eq('status', filters.skuStatus);
      }
      if (filters.searchQuery) {
        query = query.ilike('sku_code', `%${filters.searchQuery}%`);
      }

      // Pagination
      query = query.range(from, to).order('sku_code');

      const { data: skuRows, error: skuErr, count } = await query;
      if (skuErr) throw skuErr;

      const skus: SkuWithCatalogue[] = [];

      if (skuRows && skuRows.length > 0) {
        const skuIds = skuRows.map((s: Record<string, unknown>) => s.sku_id as string);

        // Fetch catalogue entries for these SKUs
        const { data: catalogueEntries, error: ceErr } = await fromTable('catalogue_entry')
          .select('*')
          .in('sku_id', skuIds);
        if (ceErr) throw ceErr;

        // Build a map of sku_id -> catalogue_entry
        const catalogueMap = new Map<string, Record<string, unknown>>();
        if (catalogueEntries) {
          for (const ce of catalogueEntries) {
            catalogueMap.set(ce.sku_id as string, ce as Record<string, unknown>);
          }
        }

        // Fetch current RENDER assets for catalogue entries
        const entryIds = catalogueEntries
          ? catalogueEntries.map((ce: Record<string, unknown>) => ce.catalogue_entry_id as string)
          : [];
        let renderMap = new Map<string, string>();

        if (entryIds.length > 0) {
          const { data: renderAssets, error: raErr } = await fromTable('catalogue_asset')
            .select('catalogue_entry_id, file_reference')
            .in('catalogue_entry_id', entryIds)
            .eq('asset_type', 'RENDER')
            .eq('is_current', true);
          if (raErr) throw raErr;

          if (renderAssets) {
            renderMap = new Map(
              renderAssets.map((a: Record<string, unknown>) => [
                a.catalogue_entry_id as string,
                a.file_reference as string,
              ])
            );
          }
        }

        // Build the joined results
        for (const row of skuRows) {
          const skuId = row.sku_id as string;
          const ce = catalogueMap.get(skuId);

          // Apply catalogue status filter if set
          if (filters.catalogueStatus) {
            if (!ce || ce.status !== filters.catalogueStatus) {
              continue;
            }
          }

          const catalogueEntry = ce
            ? {
                catalogue_entry_id: ce.catalogue_entry_id as string,
                sku_id: ce.sku_id as string,
                status: ce.status as CatalogueStatus,
                created_at: ce.created_at as string,
                updated_at: ce.updated_at as string,
              }
            : null;

          const thumbnailUrl = ce
            ? renderMap.get(ce.catalogue_entry_id as string) ?? null
            : null;

          skus.push({
            sku: row as unknown as SkuWithCatalogue['sku'],
            catalogueEntry,
            thumbnailUrl,
          });
        }
      }

      set({
        skus,
        totalCount: count ?? 0,
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  fetchFamilies: async () => {
    try {
      const { data, error } = await fromTable('family_master')
        .select('*')
        .order('name');
      if (error) throw error;
      set({ families: (data ?? []) as FamilyMaster[] });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  fetchCategories: async (familyId?: string) => {
    try {
      let query = fromTable('category_master')
        .select('*')
        .order('name');
      if (familyId) {
        query = query.eq('family_id', familyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      set({ categories: (data ?? []) as CategoryMaster[] });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value },
      page: 0,
    }));
  },

  clearFilters: () => {
    set({ filters: { ...initialFilters }, page: 0 });
  },

  setSearchQuery: (query: string) => {
    set((state) => ({
      filters: { ...state.filters, searchQuery: query },
      page: 0,
    }));
  },

  selectSku: (id: string | null) => {
    set({ selectedSkuId: id });
  },

  setPage: (page: number) => {
    set({ page });
  },

  openBrowser: () => {
    set({ isBrowserOpen: true });
  },

  closeBrowser: () => {
    set({ isBrowserOpen: false });
  },
}));
