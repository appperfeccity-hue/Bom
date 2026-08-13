import { create } from 'zustand';
import type { Template, WallGeometryType } from '@/types/database';
import { TemplateStatus, AdaptationStrategy, CanvasMode } from '@/types/database';
import { fromTable } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCanvasStore } from '@/stores/canvasStore';

// --- Filter types ---

export interface TemplateFilters {
  status: TemplateStatus | null;
  search: string;
  wallGeometry: WallGeometryType | null;
}

// --- State / Actions / Store types ---

export interface TemplateManagementState {
  templates: Template[];
  filteredTemplates: Template[];
  filters: TemplateFilters;
  isLoading: boolean;
  error: string | null;
  selectedTemplateForAction: Template | null;
  showCreateDialog: boolean;
  showRetireDialog: boolean;
  isPanelVisible: boolean;
}

export interface TemplateManagementActions {
  fetchMyTemplates: () => Promise<void>;
  applyFilters: () => void;
  setStatusFilter: (status: TemplateStatus | null) => void;
  setSearchFilter: (text: string) => void;
  setWallGeometryFilter: (geometry: WallGeometryType | null) => void;
  createTemplate: (data: {
    name: string;
    description?: string;
    wall_geometry: WallGeometryType;
    adaptation_strategy: AdaptationStrategy;
    design_family_id: string;
    design_subfamily_id?: string;
    wall_application: string;
    waste_factor: number;
  }) => Promise<void>;
  retireTemplate: (id: string) => Promise<void>;
  duplicateAsNewDraft: (id: string) => Promise<void>;
  editTemplate: (id: string) => Promise<void>;
  openCreateDialog: () => void;
  closeCreateDialog: () => void;
  openRetireDialog: (template: Template) => void;
  closeRetireDialog: () => void;
  openPanel: () => void;
  closePanel: () => void;
  reset: () => void;
}

export type TemplateManagementStore = TemplateManagementState & TemplateManagementActions;

const initialState: TemplateManagementState = {
  templates: [],
  filteredTemplates: [],
  filters: {
    status: null,
    search: '',
    wallGeometry: null,
  },
  isLoading: false,
  error: null,
  selectedTemplateForAction: null,
  showCreateDialog: false,
  showRetireDialog: false,
  isPanelVisible: false,
};

function filterTemplates(templates: Template[], filters: TemplateFilters): Template[] {
  let result = templates;

  if (filters.status) {
    result = result.filter((t) => t.status === filters.status);
  }

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    result = result.filter(
      (t) =>
        t.name.toLowerCase().includes(searchLower) ||
        (t.description && t.description.toLowerCase().includes(searchLower)),
    );
  }

  if (filters.wallGeometry) {
    result = result.filter((t) => t.wall_geometry.type === filters.wallGeometry);
  }

  return result;
}

export const useTemplateManagementStore = create<TemplateManagementStore>((set, get) => ({
  ...initialState,

  fetchMyTemplates: async () => {
    set({ isLoading: true, error: null });
    try {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) throw new Error('User not authenticated');

      const { data, error } = await fromTable('template')
        .select('*')
        .eq('created_by', userId)
        .order('updated_at', { ascending: false });
      if (error) throw error;

      const templates = (data ?? []) as Template[];
      const { filters } = get();
      set({
        templates,
        filteredTemplates: filterTemplates(templates, filters),
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  applyFilters: () => {
    const { templates, filters } = get();
    set({ filteredTemplates: filterTemplates(templates, filters) });
  },

  setStatusFilter: (status: TemplateStatus | null) => {
    set((state) => {
      const filters = { ...state.filters, status };
      return { filters, filteredTemplates: filterTemplates(state.templates, filters) };
    });
  },

  setSearchFilter: (text: string) => {
    set((state) => {
      const filters = { ...state.filters, search: text };
      return { filters, filteredTemplates: filterTemplates(state.templates, filters) };
    });
  },

  setWallGeometryFilter: (geometry: WallGeometryType | null) => {
    set((state) => {
      const filters = { ...state.filters, wallGeometry: geometry };
      return { filters, filteredTemplates: filterTemplates(state.templates, filters) };
    });
  },

  createTemplate: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) throw new Error('User not authenticated');

      const { error } = await fromTable('template')
        .insert({
          name: data.name,
          description: data.description ?? null,
          status: TemplateStatus.DRAFT,
          wall_geometry: data.wall_geometry,
          adaptation_strategy: data.adaptation_strategy,
          design_family_id: data.design_family_id,
          design_subfamily_id: data.design_subfamily_id ?? null,
          wall_application: data.wall_application,
          waste_factor: data.waste_factor,
          created_by: userId,
        });
      if (error) throw error;

      set({ showCreateDialog: false, isLoading: false });
      await get().fetchMyTemplates();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  retireTemplate: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await fromTable('template')
        .update({ status: TemplateStatus.RETIRED })
        .eq('template_id', id);
      if (error) throw error;

      set({ showRetireDialog: false, selectedTemplateForAction: null, isLoading: false });
      await get().fetchMyTemplates();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  duplicateAsNewDraft: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) throw new Error('User not authenticated');

      // Find the template to duplicate
      const template = get().templates.find((t) => t.template_id === id);
      if (!template) throw new Error('Template not found');

      // Strip trailing " (Copy)" to avoid compounding (e.g. "Name (Copy) (Copy)")
      const baseName = template.name.replace(/ \(Copy\)$/, '');

      const { error } = await fromTable('template')
        .insert({
          name: `${baseName} (Copy)`,
          description: template.description,
          status: TemplateStatus.DRAFT,
          wall_geometry: template.wall_geometry,
          adaptation_strategy: template.adaptation_strategy,
          design_family_id: template.design_family_id,
          design_subfamily_id: template.design_subfamily_id,
          wall_application: template.wall_application,
          waste_factor: template.waste_factor,
          created_by: userId,
        });
      if (error) throw error;

      set({ isLoading: false });
      await get().fetchMyTemplates();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  editTemplate: async (id: string) => {
    set({ error: null });
    try {
      await useProjectStore.getState().loadTemplate(id);
      useCanvasStore.getState().setMode(CanvasMode.DESIGNER);
      set({ isPanelVisible: false });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  openCreateDialog: () => set({ showCreateDialog: true }),
  closeCreateDialog: () => set({ showCreateDialog: false }),

  openRetireDialog: (template: Template) =>
    set({ showRetireDialog: true, selectedTemplateForAction: template }),
  closeRetireDialog: () =>
    set({ showRetireDialog: false, selectedTemplateForAction: null }),

  openPanel: () => set({ isPanelVisible: true }),
  closePanel: () => set({ isPanelVisible: false }),

  reset: () => set({ ...initialState }),
}));
