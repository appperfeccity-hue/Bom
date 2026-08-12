import { create } from 'zustand';
import { fromTable, supabase } from '@/lib/supabase';
import type {
  FamilyMaster,
  CategoryMaster,
  DesignFamilyMaster,
  DesignSubfamilyMaster,
  SkuMaster,
  SkuCompatibility,
  CatalogueEntry,
  CatalogueAsset,
  RuleSet,
} from '@/types/database';

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
  // Catalogue
  catalogueEntries: CatalogueEntry[];
  catalogueAssets: CatalogueAsset[];
  // Rule Sets
  ruleSets: RuleSet[];
  // UI state
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
  catalogueEntries: [],
  catalogueAssets: [],
  ruleSets: [],
  isLoading: false,
  error: null,
};

export const useAdminStore = create<AdminStore>((set, get) => ({
  ...initialState,

  // --- Families ---
  fetchFamilies: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await fromTable('family_master').select('*').order('name');
      if (error) throw error;
      set({ families: (data ?? []) as FamilyMaster[], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createFamily: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('family_master').insert({ name });
      if (error) throw error;
      await get().fetchFamilies();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  updateFamily: async (familyId: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('family_master').update({ name }).eq('family_id', familyId);
      if (error) throw error;
      await get().fetchFamilies();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  deleteFamily: async (familyId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('family_master').delete().eq('family_id', familyId);
      if (error) throw error;
      await get().fetchFamilies();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  // --- Categories ---
  fetchCategories: async (familyId?: string) => {
    set({ isLoading: true, error: null });
    try {
      let query = fromTable('category_master').select('*').order('name');
      if (familyId) {
        query = query.eq('family_id', familyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      set({ categories: (data ?? []) as CategoryMaster[], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createCategory: async (familyId: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('category_master').insert({ family_id: familyId, name });
      if (error) throw error;
      await get().fetchCategories(familyId);
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  updateCategory: async (categoryId: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('category_master').update({ name }).eq('category_id', categoryId);
      if (error) throw error;
      await get().fetchCategories();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  deleteCategory: async (categoryId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('category_master').delete().eq('category_id', categoryId);
      if (error) throw error;
      await get().fetchCategories();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  // --- Design Families ---
  fetchDesignFamilies: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await fromTable('design_family_master').select('*').order('name');
      if (error) throw error;
      set({ designFamilies: (data ?? []) as DesignFamilyMaster[], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createDesignFamily: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('design_family_master').insert({ name });
      if (error) throw error;
      await get().fetchDesignFamilies();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  updateDesignFamily: async (id: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('design_family_master').update({ name }).eq('design_family_id', id);
      if (error) throw error;
      await get().fetchDesignFamilies();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  deleteDesignFamily: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('design_family_master').delete().eq('design_family_id', id);
      if (error) throw error;
      await get().fetchDesignFamilies();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  // --- Design Subfamilies ---
  fetchDesignSubfamilies: async (designFamilyId?: string) => {
    set({ isLoading: true, error: null });
    try {
      let query = fromTable('design_subfamily_master').select('*').order('name');
      if (designFamilyId) {
        query = query.eq('design_family_id', designFamilyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      set({ designSubfamilies: (data ?? []) as DesignSubfamilyMaster[], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createDesignSubfamily: async (designFamilyId: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('design_subfamily_master').insert({ design_family_id: designFamilyId, name });
      if (error) throw error;
      await get().fetchDesignSubfamilies(designFamilyId);
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  updateDesignSubfamily: async (id: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('design_subfamily_master').update({ name }).eq('design_subfamily_id', id);
      if (error) throw error;
      await get().fetchDesignSubfamilies();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  deleteDesignSubfamily: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('design_subfamily_master').delete().eq('design_subfamily_id', id);
      if (error) throw error;
      await get().fetchDesignSubfamilies();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  // --- SKU Master ---
  fetchSkus: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await fromTable('sku_master').select('*').order('sku_code');
      if (error) throw error;
      set({ skus: (data ?? []) as SkuMaster[], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createSku: async (sku: Partial<SkuMaster>) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('sku_master').insert(sku);
      if (error) throw error;
      await get().fetchSkus();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  updateSku: async (skuId: string, updates: Partial<SkuMaster>) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('sku_master').update(updates).eq('sku_id', skuId);
      if (error) throw error;
      await get().fetchSkus();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  deleteSku: async (skuId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('sku_master').delete().eq('sku_id', skuId);
      if (error) throw error;
      await get().fetchSkus();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  // --- Compatibility ---
  fetchCompatibilityRules: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await fromTable('sku_compatibility').select('*').order('created_at');
      if (error) throw error;
      set({ compatibilityRules: (data ?? []) as SkuCompatibility[], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createCompatibilityRule: async (rule: Partial<SkuCompatibility>) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('sku_compatibility').insert(rule);
      if (error) throw error;
      await get().fetchCompatibilityRules();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  updateCompatibilityRule: async (id: string, updates: Partial<SkuCompatibility>) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('sku_compatibility').update(updates).eq('compatibility_id', id);
      if (error) throw error;
      await get().fetchCompatibilityRules();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  deleteCompatibilityRule: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('sku_compatibility').delete().eq('compatibility_id', id);
      if (error) throw error;
      await get().fetchCompatibilityRules();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  // --- Catalogue ---
  fetchCatalogueEntries: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await fromTable('catalogue_entry').select('*').order('created_at');
      if (error) throw error;
      set({ catalogueEntries: (data ?? []) as CatalogueEntry[], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  fetchCatalogueAssets: async (entryId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await fromTable('catalogue_asset')
        .select('*')
        .eq('catalogue_entry_id', entryId)
        .order('created_at');
      if (error) throw error;
      set({ catalogueAssets: (data ?? []) as CatalogueAsset[], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  uploadCatalogueAsset: async (entryId: string, skuId: string, assetType: string, file: File) => {
    set({ isLoading: true, error: null });
    try {
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `${skuId}/${assetType}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('catalogue-assets')
        .upload(path, file);
      if (uploadError) throw uploadError;

      // Create asset record
      const { error: insertError } = await fromTable('catalogue_asset').insert({
        catalogue_entry_id: entryId,
        asset_type: assetType,
        version: 1,
        content_hash: '',
        file_reference: path,
        status: 'VALID',
        is_current: true,
      });
      if (insertError) throw insertError;

      await get().fetchCatalogueAssets(entryId);
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  approveCatalogueEntry: async (entryId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('catalogue_entry')
        .update({ status: 'READY' })
        .eq('catalogue_entry_id', entryId);
      if (error) throw error;
      await get().fetchCatalogueEntries();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  // --- Rule Sets ---
  fetchRuleSets: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await fromTable('rule_set').select('*').order('rule_set_code');
      if (error) throw error;
      set({ ruleSets: (data ?? []) as RuleSet[], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createRuleSet: async (ruleSet: Partial<RuleSet>) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('rule_set').insert(ruleSet);
      if (error) throw error;
      await get().fetchRuleSets();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  updateRuleSet: async (id: string, updates: Partial<RuleSet>) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('rule_set').update(updates).eq('rule_set_id', id);
      if (error) throw error;
      await get().fetchRuleSets();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  transitionRuleSetStatus: async (id: string, newStatus: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('rule_set').update({ status: newStatus }).eq('rule_set_id', id);
      if (error) throw error;
      await get().fetchRuleSets();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  // --- General ---
  clearError: () => {
    set({ error: null });
  },
}));
