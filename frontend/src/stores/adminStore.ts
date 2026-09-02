import { create } from 'zustand';
import { fromTable, supabase } from '@/lib/supabase';
import { RuleSetStatus } from '@/types/database';
import type {
  FamilyMaster,
  CategoryMaster,
  DesignFamilyMaster,
  DesignSubfamilyMaster,
  SkuMaster,
  SkuCompatibility,
  SkuDependency,
  CatalogueEntry,
  CatalogueAsset,
  RuleSet,
} from '@/types/database';

/** Valid rule-set status transitions: only forward movement allowed. */
const VALID_RULE_SET_TRANSITIONS: Record<string, string> = {
  [RuleSetStatus.DRAFT]: RuleSetStatus.ACTIVE,
  [RuleSetStatus.ACTIVE]: RuleSetStatus.SUPERSEDED,
};

/** Required asset types for catalogue entry approval. */
const REQUIRED_ASSET_TYPES = ['GEOMETRY', 'PATTERN', 'RENDER'];

/**
 * Checks if a Supabase error message indicates a FK constraint violation
 * and returns a user-friendly message.
 */
function friendlyDeleteError(rawMessage: string): string {
  if (rawMessage.includes('violates foreign key constraint')) {
    return 'Cannot delete this record because it is referenced by other records. Remove or reassign the dependent records first.';
  }
  return rawMessage;
}

export interface AdminState {
  // Families & Categories
  families: FamilyMaster[];
  categories: CategoryMaster[];
  // Design Families
  designFamilies: DesignFamilyMaster[];
  designSubfamilies: DesignSubfamilyMaster[];
  // SKU Master
  skus: SkuMaster[];
  // Compatibility
  compatibilityRules: SkuCompatibility[];
  // SKU dependency graph
  skuDependencies: SkuDependency[];
  // Catalogue
  catalogueEntries: CatalogueEntry[];
  catalogueAssets: CatalogueAsset[];
  // Rule Sets
  ruleSets: RuleSet[];
  // Per-domain loading flags
  isLoadingFamilies: boolean;
  isLoadingCategories: boolean;
  isLoadingDesignFamilies: boolean;
  isLoadingDesignSubfamilies: boolean;
  isLoadingSkus: boolean;
  isLoadingCompatibility: boolean;
  isLoadingDependencies: boolean;
  isLoadingCatalogue: boolean;
  isLoadingAssets: boolean;
  isLoadingRuleSets: boolean;
  // Legacy convenience getter (true if any domain is loading)
  isLoading: boolean;
  error: string | null;
}

export interface AdminActions {
  // Families
  fetchFamilies: () => Promise<void>;
  createFamily: (name: string) => Promise<void>;
  updateFamily: (familyId: string, name: string) => Promise<void>;
  deleteFamily: (familyId: string) => Promise<void>;
  // Categories
  fetchCategories: (familyId?: string) => Promise<void>;
  createCategory: (familyId: string, name: string) => Promise<void>;
  updateCategory: (categoryId: string, name: string) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  // Design Families
  fetchDesignFamilies: () => Promise<void>;
  createDesignFamily: (name: string) => Promise<void>;
  updateDesignFamily: (id: string, name: string) => Promise<void>;
  deleteDesignFamily: (id: string) => Promise<void>;
  // Design Subfamilies
  fetchDesignSubfamilies: (designFamilyId?: string) => Promise<void>;
  createDesignSubfamily: (designFamilyId: string, name: string) => Promise<void>;
  updateDesignSubfamily: (id: string, name: string) => Promise<void>;
  deleteDesignSubfamily: (id: string) => Promise<void>;
  // SKU Master
  fetchSkus: () => Promise<void>;
  createSku: (sku: Partial<SkuMaster>) => Promise<void>;
  updateSku: (skuId: string, updates: Partial<SkuMaster>) => Promise<void>;
  deleteSku: (skuId: string) => Promise<void>;
  // Compatibility
  fetchCompatibilityRules: () => Promise<void>;
  createCompatibilityRule: (rule: Partial<SkuCompatibility>) => Promise<void>;
  updateCompatibilityRule: (id: string, updates: Partial<SkuCompatibility>) => Promise<void>;
  deleteCompatibilityRule: (id: string) => Promise<void>;
  // SKU dependency graph
  fetchSkuDependencies: () => Promise<void>;
  createSkuDependency: (dep: Partial<SkuDependency>) => Promise<void>;
  updateSkuDependency: (id: string, updates: Partial<SkuDependency>) => Promise<void>;
  deleteSkuDependency: (id: string) => Promise<void>;
  // Catalogue
  fetchCatalogueEntries: () => Promise<void>;
  fetchCatalogueAssets: (entryId: string) => Promise<void>;
  uploadCatalogueAsset: (entryId: string, skuId: string, assetType: string, file: File) => Promise<void>;
  approveCatalogueEntry: (entryId: string) => Promise<void>;
  // Rule Sets
  fetchRuleSets: () => Promise<void>;
  createRuleSet: (ruleSet: Partial<RuleSet>) => Promise<void>;
  updateRuleSet: (id: string, updates: Partial<RuleSet>) => Promise<void>;
  transitionRuleSetStatus: (id: string, newStatus: string) => Promise<void>;
  // General
  clearError: () => void;
}

export type AdminStore = AdminState & AdminActions;

const initialState: AdminState = {
  families: [],
  categories: [],
  designFamilies: [],
  designSubfamilies: [],
  skus: [],
  compatibilityRules: [],
  skuDependencies: [],
  catalogueEntries: [],
  catalogueAssets: [],
  ruleSets: [],
  isLoadingFamilies: false,
  isLoadingCategories: false,
  isLoadingDesignFamilies: false,
  isLoadingDesignSubfamilies: false,
  isLoadingSkus: false,
  isLoadingCompatibility: false,
  isLoadingDependencies: false,
  isLoadingCatalogue: false,
  isLoadingAssets: false,
  isLoadingRuleSets: false,
  isLoading: false,
  error: null,
};

/** Helper to recompute the aggregate isLoading flag. */
function computeIsLoading(state: Partial<AdminState>): boolean {
  return !!(
    state.isLoadingFamilies ||
    state.isLoadingCategories ||
    state.isLoadingDesignFamilies ||
    state.isLoadingDesignSubfamilies ||
    state.isLoadingSkus ||
    state.isLoadingCompatibility ||
    state.isLoadingDependencies ||
    state.isLoadingCatalogue ||
    state.isLoadingAssets ||
    state.isLoadingRuleSets
  );
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  ...initialState,

  // --- Families ---
  fetchFamilies: async () => {
    set(() => ({ isLoadingFamilies: true, isLoading: true, error: null }));
    try {
      const { data, error } = await fromTable('family_master').select('*').order('name');
      if (error) throw error;
      set((s) => {
        const next = { ...s, families: (data ?? []) as FamilyMaster[], isLoadingFamilies: false };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingFamilies: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  createFamily: async (name: string) => {
    set(() => ({ isLoadingFamilies: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('family_master').insert({ name });
      if (error) throw error;
      await get().fetchFamilies();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingFamilies: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  updateFamily: async (familyId: string, name: string) => {
    set(() => ({ isLoadingFamilies: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('family_master').update({ name }).eq('family_id', familyId);
      if (error) throw error;
      await get().fetchFamilies();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingFamilies: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  deleteFamily: async (familyId: string) => {
    set(() => ({ isLoadingFamilies: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('family_master').delete().eq('family_id', familyId);
      if (error) throw new Error(friendlyDeleteError(error.message));
      await get().fetchFamilies();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingFamilies: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  // --- Categories ---
  fetchCategories: async (familyId?: string) => {
    set(() => ({ isLoadingCategories: true, isLoading: true, error: null }));
    try {
      let query = fromTable('category_master').select('*').order('name');
      if (familyId) {
        query = query.eq('family_id', familyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      set((s) => {
        const next = { ...s, categories: (data ?? []) as CategoryMaster[], isLoadingCategories: false };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingCategories: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  createCategory: async (familyId: string, name: string) => {
    set(() => ({ isLoadingCategories: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('category_master').insert({ family_id: familyId, name });
      if (error) throw error;
      await get().fetchCategories(familyId);
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingCategories: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  updateCategory: async (categoryId: string, name: string) => {
    set(() => ({ isLoadingCategories: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('category_master').update({ name }).eq('category_id', categoryId);
      if (error) throw error;
      await get().fetchCategories();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingCategories: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  deleteCategory: async (categoryId: string) => {
    set(() => ({ isLoadingCategories: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('category_master').delete().eq('category_id', categoryId);
      if (error) throw new Error(friendlyDeleteError(error.message));
      await get().fetchCategories();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingCategories: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  // --- Design Families ---
  fetchDesignFamilies: async () => {
    set(() => ({ isLoadingDesignFamilies: true, isLoading: true, error: null }));
    try {
      const { data, error } = await fromTable('design_family_master').select('*').order('name');
      if (error) throw error;
      set((s) => {
        const next = { ...s, designFamilies: (data ?? []) as DesignFamilyMaster[], isLoadingDesignFamilies: false };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingDesignFamilies: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  createDesignFamily: async (name: string) => {
    set(() => ({ isLoadingDesignFamilies: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('design_family_master').insert({ name });
      if (error) throw error;
      await get().fetchDesignFamilies();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingDesignFamilies: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  updateDesignFamily: async (id: string, name: string) => {
    set(() => ({ isLoadingDesignFamilies: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('design_family_master').update({ name }).eq('design_family_id', id);
      if (error) throw error;
      await get().fetchDesignFamilies();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingDesignFamilies: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  deleteDesignFamily: async (id: string) => {
    set(() => ({ isLoadingDesignFamilies: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('design_family_master').delete().eq('design_family_id', id);
      if (error) throw new Error(friendlyDeleteError(error.message));
      await get().fetchDesignFamilies();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingDesignFamilies: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  // --- Design Subfamilies ---
  fetchDesignSubfamilies: async (designFamilyId?: string) => {
    set(() => ({ isLoadingDesignSubfamilies: true, isLoading: true, error: null }));
    try {
      let query = fromTable('design_subfamily_master').select('*').order('name');
      if (designFamilyId) {
        query = query.eq('design_family_id', designFamilyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      set((s) => {
        const next = { ...s, designSubfamilies: (data ?? []) as DesignSubfamilyMaster[], isLoadingDesignSubfamilies: false };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingDesignSubfamilies: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  createDesignSubfamily: async (designFamilyId: string, name: string) => {
    set(() => ({ isLoadingDesignSubfamilies: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('design_subfamily_master').insert({ design_family_id: designFamilyId, name });
      if (error) throw error;
      await get().fetchDesignSubfamilies(designFamilyId);
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingDesignSubfamilies: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  updateDesignSubfamily: async (id: string, name: string) => {
    set(() => ({ isLoadingDesignSubfamilies: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('design_subfamily_master').update({ name }).eq('design_subfamily_id', id);
      if (error) throw error;
      await get().fetchDesignSubfamilies();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingDesignSubfamilies: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  deleteDesignSubfamily: async (id: string) => {
    set(() => ({ isLoadingDesignSubfamilies: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('design_subfamily_master').delete().eq('design_subfamily_id', id);
      if (error) throw new Error(friendlyDeleteError(error.message));
      await get().fetchDesignSubfamilies();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingDesignSubfamilies: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  // --- SKU Master ---
  fetchSkus: async () => {
    set(() => ({ isLoadingSkus: true, isLoading: true, error: null }));
    try {
      const { data, error } = await fromTable('sku_master').select('*').order('sku_code');
      if (error) throw error;
      set((s) => {
        const next = { ...s, skus: (data ?? []) as SkuMaster[], isLoadingSkus: false };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingSkus: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  createSku: async (sku: Partial<SkuMaster>) => {
    set(() => ({ isLoadingSkus: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('sku_master').insert(sku);
      if (error) throw error;
      await get().fetchSkus();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingSkus: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  updateSku: async (skuId: string, updates: Partial<SkuMaster>) => {
    set(() => ({ isLoadingSkus: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('sku_master').update(updates).eq('sku_id', skuId);
      if (error) throw error;
      await get().fetchSkus();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingSkus: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  deleteSku: async (skuId: string) => {
    set(() => ({ isLoadingSkus: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('sku_master').delete().eq('sku_id', skuId);
      if (error) throw new Error(friendlyDeleteError(error.message));
      await get().fetchSkus();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingSkus: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  // --- Compatibility ---
  fetchCompatibilityRules: async () => {
    set(() => ({ isLoadingCompatibility: true, isLoading: true, error: null }));
    try {
      const { data, error } = await fromTable('sku_compatibility').select('*').order('created_at');
      if (error) throw error;
      set((s) => {
        const next = { ...s, compatibilityRules: (data ?? []) as SkuCompatibility[], isLoadingCompatibility: false };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingCompatibility: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  createCompatibilityRule: async (rule: Partial<SkuCompatibility>) => {
    set(() => ({ isLoadingCompatibility: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('sku_compatibility').insert(rule);
      if (error) throw error;
      await get().fetchCompatibilityRules();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingCompatibility: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  updateCompatibilityRule: async (id: string, updates: Partial<SkuCompatibility>) => {
    set(() => ({ isLoadingCompatibility: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('sku_compatibility').update(updates).eq('compatibility_id', id);
      if (error) throw error;
      await get().fetchCompatibilityRules();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingCompatibility: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  deleteCompatibilityRule: async (id: string) => {
    set(() => ({ isLoadingCompatibility: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('sku_compatibility').delete().eq('compatibility_id', id);
      if (error) throw new Error(friendlyDeleteError(error.message));
      await get().fetchCompatibilityRules();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingCompatibility: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  // --- SKU dependency graph ---
  fetchSkuDependencies: async () => {
    set(() => ({ isLoadingDependencies: true, isLoading: true, error: null }));
    try {
      const { data, error } = await fromTable('sku_dependency').select('*').order('created_at');
      if (error) throw error;
      set((s) => {
        const next = { ...s, skuDependencies: (data ?? []) as SkuDependency[], isLoadingDependencies: false };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingDependencies: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  createSkuDependency: async (dep: Partial<SkuDependency>) => {
    set(() => ({ isLoadingDependencies: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('sku_dependency').insert(dep);
      if (error) throw error;
      await get().fetchSkuDependencies();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingDependencies: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  updateSkuDependency: async (id: string, updates: Partial<SkuDependency>) => {
    set(() => ({ isLoadingDependencies: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('sku_dependency').update(updates).eq('dependency_id', id);
      if (error) throw error;
      await get().fetchSkuDependencies();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingDependencies: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  deleteSkuDependency: async (id: string) => {
    set(() => ({ isLoadingDependencies: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('sku_dependency').delete().eq('dependency_id', id);
      if (error) throw new Error(friendlyDeleteError(error.message));
      await get().fetchSkuDependencies();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingDependencies: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  // --- Catalogue ---
  fetchCatalogueEntries: async () => {
    set(() => ({ isLoadingCatalogue: true, isLoading: true, error: null }));
    try {
      const { data, error } = await fromTable('catalogue_entry').select('*').order('created_at');
      if (error) throw error;
      set((s) => {
        const next = { ...s, catalogueEntries: (data ?? []) as CatalogueEntry[], isLoadingCatalogue: false };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingCatalogue: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  fetchCatalogueAssets: async (entryId: string) => {
    set(() => ({ isLoadingAssets: true, isLoading: true, error: null }));
    try {
      const { data, error } = await fromTable('catalogue_asset')
        .select('*')
        .eq('catalogue_entry_id', entryId)
        .order('created_at');
      if (error) throw error;
      set((s) => {
        const next = { ...s, catalogueAssets: (data ?? []) as CatalogueAsset[], isLoadingAssets: false };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingAssets: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  uploadCatalogueAsset: async (entryId: string, skuId: string, assetType: string, file: File) => {
    set(() => ({ isLoadingAssets: true, isLoading: true, error: null }));
    try {
      const ext = file.name.split('.').pop() ?? 'bin';
      // Use crypto.randomUUID for unique path to avoid collisions and predictability
      const uniqueId = crypto.randomUUID();
      const path = `${skuId}/${assetType}/${Date.now()}_${uniqueId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('catalogue-assets')
        .upload(path, file);
      if (uploadError) throw uploadError;

      // Compute a meaningful content_hash from file size and name
      const contentHash = `${file.size}-${file.name}-${uniqueId}`;

      // Create asset record
      const { error: insertError } = await fromTable('catalogue_asset').insert({
        catalogue_entry_id: entryId,
        asset_type: assetType,
        version: 1,
        content_hash: contentHash,
        file_reference: path,
        status: 'VALID',
        is_current: true,
      });
      if (insertError) throw insertError;

      await get().fetchCatalogueAssets(entryId);
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingAssets: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  approveCatalogueEntry: async (entryId: string) => {
    set(() => ({ isLoadingCatalogue: true, isLoading: true, error: null }));
    try {
      // Check that required asset types exist before approving
      const { data: assets, error: assetError } = await fromTable('catalogue_asset')
        .select('*')
        .eq('catalogue_entry_id', entryId)
        .in('asset_type', REQUIRED_ASSET_TYPES);
      if (assetError) throw assetError;

      const existingTypes = new Set((assets ?? []).map((a: CatalogueAsset) => a.asset_type as string));
      const missingTypes = REQUIRED_ASSET_TYPES.filter((t) => !existingTypes.has(t));
      if (missingTypes.length > 0) {
        throw new Error(`Cannot approve: missing required assets: ${missingTypes.join(', ')}`);
      }

      const { error } = await fromTable('catalogue_entry')
        .update({ status: 'READY' })
        .eq('catalogue_entry_id', entryId);
      if (error) throw error;
      await get().fetchCatalogueEntries();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingCatalogue: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  // --- Rule Sets ---
  fetchRuleSets: async () => {
    set(() => ({ isLoadingRuleSets: true, isLoading: true, error: null }));
    try {
      const { data, error } = await fromTable('rule_set').select('*').order('rule_set_code');
      if (error) throw error;
      set((s) => {
        const next = { ...s, ruleSets: (data ?? []) as RuleSet[], isLoadingRuleSets: false };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingRuleSets: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  createRuleSet: async (ruleSet: Partial<RuleSet>) => {
    set(() => ({ isLoadingRuleSets: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('rule_set').insert(ruleSet);
      if (error) throw error;
      await get().fetchRuleSets();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingRuleSets: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  updateRuleSet: async (id: string, updates: Partial<RuleSet>) => {
    set(() => ({ isLoadingRuleSets: true, isLoading: true, error: null }));
    try {
      const { error } = await fromTable('rule_set').update(updates).eq('rule_set_id', id);
      if (error) throw error;
      await get().fetchRuleSets();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingRuleSets: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  transitionRuleSetStatus: async (id: string, newStatus: string) => {
    set(() => ({ isLoadingRuleSets: true, isLoading: true, error: null }));
    try {
      // Enforce state machine: find the current rule set and validate the transition
      const ruleSet = get().ruleSets.find((rs) => rs.rule_set_id === id);
      if (!ruleSet) {
        throw new Error('Rule set not found');
      }
      const allowedNext = VALID_RULE_SET_TRANSITIONS[ruleSet.status];
      if (!allowedNext || allowedNext !== newStatus) {
        throw new Error(
          `Invalid status transition: cannot move from ${ruleSet.status} to ${newStatus}. ` +
          `Allowed: ${ruleSet.status} -> ${allowedNext ?? 'none'}.`
        );
      }

      const { error } = await fromTable('rule_set').update({ status: newStatus }).eq('rule_set_id', id);
      if (error) throw error;
      await get().fetchRuleSets();
    } catch (err) {
      set((s) => {
        const next = { ...s, isLoadingRuleSets: false, error: (err as Error).message };
        return { ...next, isLoading: computeIsLoading(next) };
      });
    }
  },

  // --- General ---
  clearError: () => {
    set({ error: null });
  },
}));
