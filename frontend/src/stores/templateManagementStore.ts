import { create } from 'zustand';
import type { Template, WallGeometry } from '@/types/database';
import { TemplateStatus, AdaptationStrategy, CanvasMode } from '@/types/database';
import { fromTable } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCanvasStore } from '@/stores/canvasStore';

// --- Filter types ---

export interface TemplateFilters {
  status: TemplateStatus | null;
  search: string;
  wallGeometry: WallGeometry | null;
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
  setWallGeometryFilter: (geometry: WallGeometry | null) => void;
  createTemplate: (data: {
    name: string;
    description?: string;
    wall_geometry: WallGeometry;
    base_width_mm: number;
    base_height_mm: number;
    adaptation_strategy: AdaptationStrategy;
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
    result = result.filter((t) => t.wall_geometry === filters.wallGeometry);
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
        .eq('created_by', userId);
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

  setWallGeometryFilter: (geometry: WallGeometry | null) => {
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
          base_width_mm: data.base_width_mm,
          base_height_mm: data.base_height_mm,
          adaptation_strategy: data.adaptation_strategy,
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
        .update({ status: TemplateStatus.ARCHIVED })
        .eq('id', id);
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
      const template = get().templates.find((t) => t.id === id);
      if (!template) throw new Error('Template not found');

      const { error } = await fromTable('template')
        .insert({
          name: `${template.name} (Copy)`,
          description: template.description,
          status: TemplateStatus.DRAFT,
          wall_geometry: template.wall_geometry,
          base_width_mm: template.base_width_mm,
          base_height_mm: template.base_height_mm,
          adaptation_strategy: template.adaptation_strategy,
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
    await useProjectStore.getState().loadTemplate(id);
    useCanvasStore.getState().setMode(CanvasMode.DESIGNER);
    set({ isPanelVisible: false });
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
