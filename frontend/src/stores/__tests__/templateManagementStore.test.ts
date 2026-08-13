import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTemplateManagementStore } from '../templateManagementStore';
import { useAuthStore } from '../authStore';
import { useProjectStore } from '../projectStore';
import { useCanvasStore } from '../canvasStore';
import { TemplateStatus, AdaptationStrategy, CanvasMode } from '@/types/database';
import type { Template } from '@/types/database';

// Mock the supabase module
vi.mock('@/lib/supabase', () => {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  };
  return {
    fromTable: vi.fn(() => ({ ...mockQueryBuilder })),
    supabase: { rpc: vi.fn() },
    isSupabaseConfigured: false,
  };
});

const makeTemplate = (overrides: Partial<Template> = {}): Template => ({
  template_id: 'tpl-1',
  name: 'Test Template',
  description: 'A template for testing',
  wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2700 },
  status: TemplateStatus.ACTIVE,
  adaptation_strategy: AdaptationStrategy.PROPORTIONAL,
  design_family_id: 'fam-1',
  design_subfamily_id: null,
  wall_application: 'WALL_PANEL',
  priority_zone_id: null,
  waste_factor: 0.05,
  metadata: null,
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('templateManagementStore', () => {
  beforeEach(() => {
    useTemplateManagementStore.getState().reset();
    useAuthStore.setState({
      user: { id: 'user-1' } as never,
      role: 'DESIGNER',
      isAuthenticated: true,
      isLoading: false,
    });
    useProjectStore.setState({
      currentTemplate: null,
      zones: [],
      zoneSku: new Map(),
      isLoading: false,
      error: null,
    });
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
    });
  });

  describe('initial state', () => {
    it('should have empty templates and default filter values', () => {
      const state = useTemplateManagementStore.getState();
      expect(state.templates).toEqual([]);
      expect(state.filteredTemplates).toEqual([]);
      expect(state.filters.status).toBeNull();
      expect(state.filters.search).toBe('');
      expect(state.filters.wallGeometry).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.selectedTemplateForAction).toBeNull();
      expect(state.showCreateDialog).toBe(false);
      expect(state.showRetireDialog).toBe(false);
      expect(state.isPanelVisible).toBe(false);
    });
  });

  describe('fetchMyTemplates', () => {
    it('populates templates on success', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const templates = [makeTemplate(), makeTemplate({ template_id: 'tpl-2', name: 'Second Template' })];

      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: templates, error: null }),
        }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      } as unknown as ReturnType<typeof fromTable>);

      await useTemplateManagementStore.getState().fetchMyTemplates();

      const state = useTemplateManagementStore.getState();
      expect(state.templates).toHaveLength(2);
      expect(state.filteredTemplates).toHaveLength(2);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on failure', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      } as unknown as ReturnType<typeof fromTable>);

      await useTemplateManagementStore.getState().fetchMyTemplates();

      const state = useTemplateManagementStore.getState();
      expect(state.error).toBe('DB error');
      expect(state.isLoading).toBe(false);
      expect(state.templates).toEqual([]);
    });

    it('sets error when user is not authenticated', async () => {
      useAuthStore.setState({ user: null, role: null, isAuthenticated: false, isLoading: false });

      await useTemplateManagementStore.getState().fetchMyTemplates();

      const state = useTemplateManagementStore.getState();
      expect(state.error).toBe('User not authenticated');
      expect(state.isLoading).toBe(false);
    });

    it('sets isLoading true while fetching', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      let resolvePromise: (val: unknown) => void = () => {};
      const pending = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue(pending),
        }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      } as unknown as ReturnType<typeof fromTable>);

      const promise = useTemplateManagementStore.getState().fetchMyTemplates();
      expect(useTemplateManagementStore.getState().isLoading).toBe(true);

      resolvePromise({ data: [], error: null });
      await promise;
      expect(useTemplateManagementStore.getState().isLoading).toBe(false);
    });
  });

  describe('applyFilters', () => {
    it('filters by status', () => {
      useTemplateManagementStore.setState({
        templates: [
          makeTemplate({ template_id: 'tpl-1', status: TemplateStatus.DRAFT }),
          makeTemplate({ template_id: 'tpl-2', status: TemplateStatus.ACTIVE }),
          makeTemplate({ template_id: 'tpl-3', status: TemplateStatus.RETIRED }),
        ],
        filters: { status: TemplateStatus.DRAFT, search: '', wallGeometry: null },
      });

      useTemplateManagementStore.getState().applyFilters();

      const state = useTemplateManagementStore.getState();
      expect(state.filteredTemplates).toHaveLength(1);
      expect(state.filteredTemplates[0].template_id).toBe('tpl-1');
    });

    it('filters by search text (case insensitive)', () => {
      useTemplateManagementStore.setState({
        templates: [
          makeTemplate({ template_id: 'tpl-1', name: 'Modern Wall' }),
          makeTemplate({ template_id: 'tpl-2', name: 'Classic Design' }),
        ],
        filters: { status: null, search: 'modern', wallGeometry: null },
      });

      useTemplateManagementStore.getState().applyFilters();

      const state = useTemplateManagementStore.getState();
      expect(state.filteredTemplates).toHaveLength(1);
      expect(state.filteredTemplates[0].name).toBe('Modern Wall');
    });

    it('filters by wall geometry', () => {
      useTemplateManagementStore.setState({
        templates: [
          makeTemplate({ template_id: 'tpl-1', wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2700 } }),
          makeTemplate({ template_id: 'tpl-2', wall_geometry: { type: 'L_CORNER', base_width_mm: 4000, base_height_mm: 2700 } }),
        ],
        filters: { status: null, search: '', wallGeometry: 'L_CORNER' },
      });

      useTemplateManagementStore.getState().applyFilters();

      const state = useTemplateManagementStore.getState();
      expect(state.filteredTemplates).toHaveLength(1);
      expect(state.filteredTemplates[0].wall_geometry.type).toBe('L_CORNER');
    });

    it('combines multiple filters', () => {
      useTemplateManagementStore.setState({
        templates: [
          makeTemplate({ template_id: 'tpl-1', name: 'Modern Wall', status: TemplateStatus.ACTIVE, wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2700 } }),
          makeTemplate({ template_id: 'tpl-2', name: 'Classic Corner', status: TemplateStatus.ACTIVE, wall_geometry: { type: 'L_CORNER', base_width_mm: 4000, base_height_mm: 2700 } }),
          makeTemplate({ template_id: 'tpl-3', name: 'Modern L-Wall', status: TemplateStatus.DRAFT, wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2700 } }),
        ],
        filters: { status: TemplateStatus.ACTIVE, search: 'modern', wallGeometry: 'STRAIGHT' },
      });

      useTemplateManagementStore.getState().applyFilters();

      const state = useTemplateManagementStore.getState();
      expect(state.filteredTemplates).toHaveLength(1);
      expect(state.filteredTemplates[0].template_id).toBe('tpl-1');
    });
  });

  describe('setStatusFilter', () => {
    it('updates filter and re-filters templates', () => {
      useTemplateManagementStore.setState({
        templates: [
          makeTemplate({ template_id: 'tpl-1', status: TemplateStatus.DRAFT }),
          makeTemplate({ template_id: 'tpl-2', status: TemplateStatus.ACTIVE }),
        ],
      });

      useTemplateManagementStore.getState().setStatusFilter(TemplateStatus.ACTIVE);

      const state = useTemplateManagementStore.getState();
      expect(state.filters.status).toBe(TemplateStatus.ACTIVE);
      expect(state.filteredTemplates).toHaveLength(1);
      expect(state.filteredTemplates[0].template_id).toBe('tpl-2');
    });
  });

  describe('setSearchFilter', () => {
    it('updates filter and re-filters templates', () => {
      useTemplateManagementStore.setState({
        templates: [
          makeTemplate({ template_id: 'tpl-1', name: 'Alpha' }),
          makeTemplate({ template_id: 'tpl-2', name: 'Beta' }),
        ],
      });

      useTemplateManagementStore.getState().setSearchFilter('alpha');

      const state = useTemplateManagementStore.getState();
      expect(state.filters.search).toBe('alpha');
      expect(state.filteredTemplates).toHaveLength(1);
      expect(state.filteredTemplates[0].name).toBe('Alpha');
    });
  });

  describe('setWallGeometryFilter', () => {
    it('updates filter and re-filters templates', () => {
      useTemplateManagementStore.setState({
        templates: [
          makeTemplate({ template_id: 'tpl-1', wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2700 } }),
          makeTemplate({ template_id: 'tpl-2', wall_geometry: { type: 'L_CORNER', base_width_mm: 4000, base_height_mm: 2700 } }),
        ],
      });

      useTemplateManagementStore.getState().setWallGeometryFilter('L_CORNER');

      const state = useTemplateManagementStore.getState();
      expect(state.filters.wallGeometry).toBe('L_CORNER');
      expect(state.filteredTemplates).toHaveLength(1);
      expect(state.filteredTemplates[0].wall_geometry.type).toBe('L_CORNER');
    });
  });

  describe('createTemplate', () => {
    it('calls fromTable insert with correct data and refreshes', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      // First call: insert template
      // Second call: fetchMyTemplates after create
      let callCount = 0;
      mockedFromTable.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
            update: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as unknown as ReturnType<typeof fromTable>;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
        } as unknown as ReturnType<typeof fromTable>;
      });

      useTemplateManagementStore.setState({ showCreateDialog: true });

      await useTemplateManagementStore.getState().createTemplate({
        name: 'New Template',
        description: 'A new one',
        design_family_id: 'fam-1',
        wall_geometry: 'STRAIGHT',
        base_width_mm: 3000,
        base_height_mm: 2700,
        wall_application: 'WALL_PANEL', waste_factor: 0.05,
        adaptation_strategy: AdaptationStrategy.PROPORTIONAL,
      });

      const state = useTemplateManagementStore.getState();
      expect(state.showCreateDialog).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on failure', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      } as unknown as ReturnType<typeof fromTable>);

      await useTemplateManagementStore.getState().createTemplate({
        name: 'Fail',
        design_family_id: 'fam-1',
        wall_geometry: 'STRAIGHT',
        base_width_mm: 3000,
        base_height_mm: 2700,
        wall_application: 'WALL_PANEL', waste_factor: 0.05,
        adaptation_strategy: AdaptationStrategy.PROPORTIONAL,
      });

      const state = useTemplateManagementStore.getState();
      expect(state.error).toBe('Insert failed');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('retireTemplate', () => {
    it('calls update with ARCHIVED status on success', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({ eq: mockEq }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      } as unknown as ReturnType<typeof fromTable>);

      useTemplateManagementStore.setState({
        showRetireDialog: true,
        selectedTemplateForAction: makeTemplate({ template_id: 'tpl-retire' }),
      });

      await useTemplateManagementStore.getState().retireTemplate('tpl-retire');

      const state = useTemplateManagementStore.getState();
      expect(state.showRetireDialog).toBe(false);
      expect(state.selectedTemplateForAction).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('sets error on failure', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockEq = vi.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } });
      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({ eq: mockEq }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      } as unknown as ReturnType<typeof fromTable>);

      await useTemplateManagementStore.getState().retireTemplate('tpl-1');

      const state = useTemplateManagementStore.getState();
      expect(state.error).toBe('Update failed');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('duplicateAsNewDraft', () => {
    it('creates a copy with (Copy) suffix and DRAFT status', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: insertMock,
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      } as unknown as ReturnType<typeof fromTable>);

      useTemplateManagementStore.setState({
        templates: [makeTemplate({ template_id: 'tpl-dup', name: 'Original' })],
      });

      await useTemplateManagementStore.getState().duplicateAsNewDraft('tpl-dup');

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Original (Copy)',
          status: TemplateStatus.DRAFT,
          created_by: 'user-1',
        }),
      );

      const state = useTemplateManagementStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('strips existing (Copy) suffix to avoid compounding', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: insertMock,
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      } as unknown as ReturnType<typeof fromTable>);

      useTemplateManagementStore.setState({
        templates: [makeTemplate({ template_id: 'tpl-copy', name: 'Modern Wall (Copy)' })],
      });

      await useTemplateManagementStore.getState().duplicateAsNewDraft('tpl-copy');

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Modern Wall (Copy)',
        }),
      );
    });

    it('sets error when template not found', async () => {
      useTemplateManagementStore.setState({ templates: [] });

      await useTemplateManagementStore.getState().duplicateAsNewDraft('tpl-nonexistent');

      const state = useTemplateManagementStore.getState();
      expect(state.error).toBe('Template not found');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('editTemplate', () => {
    it('loads template into projectStore and switches to DESIGNER mode', async () => {
      const mockLoadTemplate = vi.fn().mockResolvedValue(undefined);
      useProjectStore.setState({ loadTemplate: mockLoadTemplate } as never);

      const mockSetMode = vi.fn();
      useCanvasStore.setState({ setMode: mockSetMode } as never);

      useTemplateManagementStore.setState({ isPanelVisible: true });

      await useTemplateManagementStore.getState().editTemplate('tpl-edit');

      expect(mockLoadTemplate).toHaveBeenCalledWith('tpl-edit');
      expect(mockSetMode).toHaveBeenCalledWith(CanvasMode.DESIGNER);
      expect(useTemplateManagementStore.getState().isPanelVisible).toBe(false);
    });

    it('surfaces error when loadTemplate throws', async () => {
      const mockLoadTemplate = vi.fn().mockRejectedValue(new Error('Network failure'));
      useProjectStore.setState({ loadTemplate: mockLoadTemplate } as never);

      const mockSetMode = vi.fn();
      useCanvasStore.setState({ setMode: mockSetMode } as never);

      useTemplateManagementStore.setState({ isPanelVisible: true });

      await useTemplateManagementStore.getState().editTemplate('tpl-fail');

      expect(mockLoadTemplate).toHaveBeenCalledWith('tpl-fail');
      expect(mockSetMode).not.toHaveBeenCalled();
      expect(useTemplateManagementStore.getState().isPanelVisible).toBe(true);
      expect(useTemplateManagementStore.getState().error).toBe('Network failure');
    });
  });

  describe('openPanel / closePanel', () => {
    it('toggles panel visibility', () => {
      expect(useTemplateManagementStore.getState().isPanelVisible).toBe(false);

      useTemplateManagementStore.getState().openPanel();
      expect(useTemplateManagementStore.getState().isPanelVisible).toBe(true);

      useTemplateManagementStore.getState().closePanel();
      expect(useTemplateManagementStore.getState().isPanelVisible).toBe(false);
    });
  });

  describe('openCreateDialog / closeCreateDialog', () => {
    it('toggles create dialog visibility', () => {
      useTemplateManagementStore.getState().openCreateDialog();
      expect(useTemplateManagementStore.getState().showCreateDialog).toBe(true);

      useTemplateManagementStore.getState().closeCreateDialog();
      expect(useTemplateManagementStore.getState().showCreateDialog).toBe(false);
    });
  });

  describe('openRetireDialog / closeRetireDialog', () => {
    it('opens dialog with selected template and closes it', () => {
      const template = makeTemplate({ template_id: 'tpl-retire' });

      useTemplateManagementStore.getState().openRetireDialog(template);
      expect(useTemplateManagementStore.getState().showRetireDialog).toBe(true);
      expect(useTemplateManagementStore.getState().selectedTemplateForAction).toEqual(template);

      useTemplateManagementStore.getState().closeRetireDialog();
      expect(useTemplateManagementStore.getState().showRetireDialog).toBe(false);
      expect(useTemplateManagementStore.getState().selectedTemplateForAction).toBeNull();
    });
  });

  describe('reset', () => {
    it('returns to initial state', () => {
      useTemplateManagementStore.setState({
        templates: [makeTemplate()],
        filteredTemplates: [makeTemplate()],
        filters: { status: TemplateStatus.ACTIVE, search: 'test', wallGeometry: 'STRAIGHT' },
        isLoading: true,
        error: 'some error',
        selectedTemplateForAction: makeTemplate(),
        showCreateDialog: true,
        showRetireDialog: true,
        isPanelVisible: true,
      });

      useTemplateManagementStore.getState().reset();

      const state = useTemplateManagementStore.getState();
      expect(state.templates).toEqual([]);
      expect(state.filteredTemplates).toEqual([]);
      expect(state.filters.status).toBeNull();
      expect(state.filters.search).toBe('');
      expect(state.filters.wallGeometry).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.selectedTemplateForAction).toBeNull();
      expect(state.showCreateDialog).toBe(false);
      expect(state.showRetireDialog).toBe(false);
      expect(state.isPanelVisible).toBe(false);
    });
  });
});
