import { create } from 'zustand';
import type { Template } from '@/types/database';
import { CanvasMode } from '@/types/database';
import { fromTable, supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCanvasStore } from '@/stores/canvasStore';

// --- Creation Step Enum ---

export enum CreationStep {
  IDLE = 'IDLE',
  BROWSE_TEMPLATES = 'BROWSE_TEMPLATES',
  PROJECT_DETAILS = 'PROJECT_DETAILS',
  CREATING = 'CREATING',
  CREATED = 'CREATED',
  ERROR = 'ERROR',
}

// --- State / Actions / Store types ---

export interface ProjectCreationState {
  step: CreationStep;
  availableTemplates: Template[];
  selectedTemplate: Template | null;
  customerReference: string;
  siteReference: string;
  createdProjectId: string | null;
  idempotencyKey: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface ProjectCreationActions {
  fetchAvailableTemplates: () => Promise<void>;
  selectTemplate: (template: Template) => void;
  setCustomerReference: (val: string) => void;
  setSiteReference: (val: string) => void;
  createProject: () => Promise<void>;
  reset: () => void;
}

export type ProjectCreationStore = ProjectCreationState & ProjectCreationActions;

const initialState: ProjectCreationState = {
  step: CreationStep.IDLE,
  availableTemplates: [],
  selectedTemplate: null,
  customerReference: '',
  siteReference: '',
  createdProjectId: null,
  idempotencyKey: null,
  isLoading: false,
  error: null,
};

export const useProjectCreationStore = create<ProjectCreationStore>((set, get) => ({
  ...initialState,

  fetchAvailableTemplates: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await fromTable('template')
        .select('*')
        .eq('status', 'ACTIVE');
      if (error) throw error;
      set({
        availableTemplates: (data ?? []) as Template[],
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  selectTemplate: (template: Template) => {
    set({ selectedTemplate: template, step: CreationStep.PROJECT_DETAILS });
  },

  setCustomerReference: (val: string) => {
    set({ customerReference: val });
  },

  setSiteReference: (val: string) => {
    set({ siteReference: val });
  },

  createProject: async () => {
    const { selectedTemplate, customerReference, siteReference } = get();
    if (!selectedTemplate) return;

    set({ step: CreationStep.CREATING, isLoading: true, error: null });

    try {
      const templateId = selectedTemplate.template_id;

      // Get current user id
      const userId = useAuthStore.getState().user?.id;
      if (!userId) throw new Error('User not authenticated');

      // Generate idempotency key once and store it (reuse on retry)
      let { idempotencyKey } = get();
      if (!idempotencyKey) {
        idempotencyKey = `${userId}-${templateId}-${Date.now()}`;
        set({ idempotencyKey });
      }

      // Call RPC to create project atomically (server builds snapshot)
      const { data: projectId, error: rpcErr } = await supabase.rpc('create_project', {
        p_template_id: templateId,
        p_user_id: userId,
        p_idempotency_key: idempotencyKey,
        p_customer_reference: customerReference || null,
        p_site_reference: siteReference || null,
      });
      if (rpcErr) throw rpcErr;

      set({
        createdProjectId: projectId as string,
        step: CreationStep.CREATED,
        isLoading: false,
        idempotencyKey: null,
      });

      // Load the project and switch to consultant mode.
      // If this fails, the project was already created successfully - show a different message.
      try {
        await useProjectStore.getState().loadProject(projectId as string);
        useCanvasStore.getState().setMode(CanvasMode.CONSULTANT);
      } catch {
        set({
          step: CreationStep.ERROR,
          error: 'Project created but failed to load. Please navigate to it manually.',
          isLoading: false,
          createdProjectId: projectId as string,
        });
      }
    } catch (err) {
      set({
        step: CreationStep.ERROR,
        error: (err as Error).message,
        isLoading: false,
      });
    }
  },

  reset: () => {
    set({ ...initialState });
  },
}));
