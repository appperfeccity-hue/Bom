import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectCreationStore, CreationStep } from '../projectCreationStore';
import { useAuthStore } from '../authStore';
import { useProjectStore } from '../projectStore';
import { useCanvasStore } from '../canvasStore';
import { TemplateStatus, AdaptationStrategy, CanvasMode } from '@/types/database';
import type { Template } from '@/types/database';

// Mock the supabase module
vi.mock('@/lib/supabase', () => {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
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
  design_family_id: null,
  design_subfamily_id: null,
  wall_application: null,
  wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2400 },
  adaptation_strategy: AdaptationStrategy.PROPORTIONAL,
  priority_zone_id: null,
  waste_factor: null,
  metadata: null,
  status: TemplateStatus.ACTIVE,
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('projectCreationStore', () => {
  beforeEach(() => {
    useProjectCreationStore.getState().reset();
    useAuthStore.setState({
      user: { id: 'user-1' } as never,
      role: 'CONSULTANT',
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
    it('should have step IDLE and empty fields', () => {
      const state = useProjectCreationStore.getState();
      expect(state.step).toBe(CreationStep.IDLE);
      expect(state.availableTemplates).toEqual([]);
      expect(state.selectedTemplate).toBeNull();
      expect(state.customerReference).toBe('');
      expect(state.siteReference).toBe('');
      expect(state.createdProjectId).toBeNull();
      expect(state.idempotencyKey).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchAvailableTemplates', () => {
    it('populates availableTemplates on success', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const templates = [makeTemplate(), makeTemplate({ template_id: 'tpl-2', name: 'Second Template' })];

      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: templates, error: null }),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      } as unknown as ReturnType<typeof fromTable>);

      await useProjectCreationStore.getState().fetchAvailableTemplates();

      const state = useProjectCreationStore.getState();
      expect(state.availableTemplates).toHaveLength(2);
      expect(state.availableTemplates[0].name).toBe('Test Template');
      expect(state.availableTemplates[1].name).toBe('Second Template');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on failure', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'Network error' } }),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      } as unknown as ReturnType<typeof fromTable>);

      await useProjectCreationStore.getState().fetchAvailableTemplates();

      const state = useProjectCreationStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
      expect(state.availableTemplates).toEqual([]);
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
        eq: vi.fn().mockReturnValue(pending),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      } as unknown as ReturnType<typeof fromTable>);

      const promise = useProjectCreationStore.getState().fetchAvailableTemplates();
      expect(useProjectCreationStore.getState().isLoading).toBe(true);

      resolvePromise({ data: [], error: null });
      await promise;
      expect(useProjectCreationStore.getState().isLoading).toBe(false);
    });
  });

  describe('selectTemplate', () => {
    it('updates selectedTemplate and advances to PROJECT_DETAILS step', () => {
      const template = makeTemplate();
      useProjectCreationStore.getState().selectTemplate(template);

      const state = useProjectCreationStore.getState();
      expect(state.selectedTemplate).toEqual(template);
      expect(state.step).toBe(CreationStep.PROJECT_DETAILS);
    });
  });

  describe('setCustomerReference', () => {
    it('updates customerReference in state', () => {
      useProjectCreationStore.getState().setCustomerReference('CUST-001');
      expect(useProjectCreationStore.getState().customerReference).toBe('CUST-001');
    });
  });

  describe('setSiteReference', () => {
    it('updates siteReference in state', () => {
      useProjectCreationStore.getState().setSiteReference('SITE-XYZ');
      expect(useProjectCreationStore.getState().siteReference).toBe('SITE-XYZ');
    });
  });

  describe('createProject', () => {
    it('does nothing if no template is selected', async () => {
      useProjectCreationStore.setState({ selectedTemplate: null });
      await useProjectCreationStore.getState().createProject();
      expect(useProjectCreationStore.getState().step).toBe(CreationStep.IDLE);
    });

    it('calls supabase.rpc with 5-arg signature (no snapshot data)', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockedRpc = vi.mocked(supabase.rpc);

      const template = makeTemplate();
      useProjectCreationStore.setState({
        selectedTemplate: template,
        step: CreationStep.PROJECT_DETAILS,
        customerReference: 'CUST-001',
        siteReference: 'SITE-001',
      });

      // Mock rpc call
      mockedRpc.mockResolvedValue({ data: 'proj-123', error: null } as never);

      // Mock loadProject on projectStore
      const mockLoadProject = vi.fn().mockResolvedValue(undefined);
      useProjectStore.setState({ loadProject: mockLoadProject } as never);

      // Mock setMode on canvasStore
      const mockSetMode = vi.fn();
      useCanvasStore.setState({ setMode: mockSetMode } as never);

      await useProjectCreationStore.getState().createProject();

      expect(mockedRpc).toHaveBeenCalledWith('create_project', {
        p_template_id: 'tpl-1',
        p_user_id: 'user-1',
        p_idempotency_key: expect.stringContaining('user-1'),
        p_customer_reference: 'CUST-001',
        p_site_reference: 'SITE-001',
      });

      // Verify no snapshot_data or snapshot_hash is sent
      const rpcCall = mockedRpc.mock.calls[0];
      const params = rpcCall[1] as Record<string, unknown>;
      expect(params).not.toHaveProperty('p_snapshot_data');
      expect(params).not.toHaveProperty('p_snapshot_hash');
      expect(params).not.toHaveProperty('p_rule_set_id');

      // Verify idempotency key contains user id and template id
      expect(params.p_idempotency_key).toContain('user-1');
      expect(params.p_idempotency_key).toContain('tpl-1');

      const state = useProjectCreationStore.getState();
      expect(state.step).toBe(CreationStep.CREATED);
      expect(state.createdProjectId).toBe('proj-123');
      expect(state.isLoading).toBe(false);
      // Idempotency key cleared after success
      expect(state.idempotencyKey).toBeNull();
    });

    it('sends null for empty customer/site references', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockedRpc = vi.mocked(supabase.rpc);
      mockedRpc.mockClear();

      const template = makeTemplate();
      useProjectCreationStore.setState({
        selectedTemplate: template,
        step: CreationStep.PROJECT_DETAILS,
        customerReference: '',
        siteReference: '',
      });

      mockedRpc.mockResolvedValue({ data: 'proj-456', error: null } as never);

      const mockLoadProject = vi.fn().mockResolvedValue(undefined);
      useProjectStore.setState({ loadProject: mockLoadProject } as never);
      useCanvasStore.setState({ setMode: vi.fn() } as never);

      await useProjectCreationStore.getState().createProject();

      const params = mockedRpc.mock.calls[0][1] as Record<string, unknown>;
      expect(params.p_customer_reference).toBeNull();
      expect(params.p_site_reference).toBeNull();
    });

    it('reuses idempotency key on retry', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockedRpc = vi.mocked(supabase.rpc);
      mockedRpc.mockClear();

      const template = makeTemplate();
      useProjectCreationStore.setState({
        selectedTemplate: template,
        step: CreationStep.PROJECT_DETAILS,
        customerReference: 'CUST-001',
        siteReference: 'SITE-001',
        idempotencyKey: null,
      });

      // First call fails
      mockedRpc.mockResolvedValueOnce({ data: null, error: { message: 'Timeout' } } as never);

      await useProjectCreationStore.getState().createProject();

      const keyAfterFirstAttempt = useProjectCreationStore.getState().idempotencyKey;
      expect(keyAfterFirstAttempt).toBeTruthy();
      expect(keyAfterFirstAttempt).toContain('user-1');
      expect(keyAfterFirstAttempt).toContain('tpl-1');

      // Retry (simulate handleRetry then createProject again)
      useProjectCreationStore.setState({ step: CreationStep.PROJECT_DETAILS, error: null });

      // Mock loadProject and setMode for success
      const mockLoadProject = vi.fn().mockResolvedValue(undefined);
      useProjectStore.setState({ loadProject: mockLoadProject } as never);
      useCanvasStore.setState({ setMode: vi.fn() } as never);

      mockedRpc.mockResolvedValueOnce({ data: 'proj-456', error: null } as never);

      await useProjectCreationStore.getState().createProject();

      // Same idempotency key used
      const firstCallKey = (mockedRpc.mock.calls[0][1] as Record<string, unknown>).p_idempotency_key;
      const secondCallKey = (mockedRpc.mock.calls[1][1] as Record<string, unknown>).p_idempotency_key;
      expect(firstCallKey).toBe(secondCallKey);
    });

    it('shows post-creation error without retry when loadProject fails', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockedRpc = vi.mocked(supabase.rpc);

      const template = makeTemplate();
      useProjectCreationStore.setState({
        selectedTemplate: template,
        step: CreationStep.PROJECT_DETAILS,
        customerReference: 'CUST-001',
        siteReference: 'SITE-001',
      });

      // RPC succeeds
      mockedRpc.mockResolvedValue({ data: 'proj-789', error: null } as never);

      // loadProject fails
      const mockLoadProject = vi.fn().mockRejectedValue(new Error('Network blip'));
      useProjectStore.setState({ loadProject: mockLoadProject } as never);
      useCanvasStore.setState({ setMode: vi.fn() } as never);

      await useProjectCreationStore.getState().createProject();

      const state = useProjectCreationStore.getState();
      expect(state.step).toBe(CreationStep.ERROR);
      expect(state.error).toBe('Project created but failed to load. Please navigate to it manually.');
      expect(state.createdProjectId).toBe('proj-789');
    });

    it('transitions to ERROR step with error message on failure', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockedRpc = vi.mocked(supabase.rpc);

      const template = makeTemplate();
      useProjectCreationStore.setState({
        selectedTemplate: template,
        step: CreationStep.PROJECT_DETAILS,
      });

      // Mock rpc call failure
      mockedRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed: duplicate key' } } as never);

      await useProjectCreationStore.getState().createProject();

      const state = useProjectCreationStore.getState();
      expect(state.step).toBe(CreationStep.ERROR);
      expect(state.error).toBe('RPC failed: duplicate key');
      expect(state.isLoading).toBe(false);
    });

    it('transitions to ERROR if user is not authenticated', async () => {
      useAuthStore.setState({ user: null, role: null, isAuthenticated: false, isLoading: false });

      const template = makeTemplate();
      useProjectCreationStore.setState({
        selectedTemplate: template,
        step: CreationStep.PROJECT_DETAILS,
      });

      await useProjectCreationStore.getState().createProject();

      const state = useProjectCreationStore.getState();
      expect(state.step).toBe(CreationStep.ERROR);
      expect(state.error).toBe('User not authenticated');
    });

    it('transitions to CREATING step while in progress', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockedRpc = vi.mocked(supabase.rpc);

      const template = makeTemplate();
      useProjectCreationStore.setState({
        selectedTemplate: template,
        step: CreationStep.PROJECT_DETAILS,
      });

      let resolveRpc: (val: unknown) => void = () => {};
      const rpcPending = new Promise((resolve) => {
        resolveRpc = resolve;
      });

      mockedRpc.mockReturnValue(rpcPending as never);

      const promise = useProjectCreationStore.getState().createProject();

      // Wait for the async to settle into CREATING state
      await new Promise((r) => setTimeout(r, 50));

      // Should be in CREATING state
      expect(useProjectCreationStore.getState().step).toBe(CreationStep.CREATING);
      expect(useProjectCreationStore.getState().isLoading).toBe(true);

      // Mock loadProject and setMode before resolving
      const mockLoadProject = vi.fn().mockResolvedValue(undefined);
      useProjectStore.setState({ loadProject: mockLoadProject } as never);
      useCanvasStore.setState({ setMode: vi.fn() } as never);

      resolveRpc({ data: 'proj-456', error: null });
      await promise;

      expect(useProjectCreationStore.getState().step).toBe(CreationStep.CREATED);
    });

    it('loads project and switches to CONSULTANT mode after creation', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockedRpc = vi.mocked(supabase.rpc);

      const template = makeTemplate();
      useProjectCreationStore.setState({
        selectedTemplate: template,
        step: CreationStep.PROJECT_DETAILS,
      });

      mockedRpc.mockResolvedValue({ data: 'proj-789', error: null } as never);

      const mockLoadProject = vi.fn().mockResolvedValue(undefined);
      useProjectStore.setState({ loadProject: mockLoadProject } as never);
      const mockSetMode = vi.fn();
      useCanvasStore.setState({ setMode: mockSetMode } as never);

      await useProjectCreationStore.getState().createProject();

      expect(mockLoadProject).toHaveBeenCalledWith('proj-789');
      expect(mockSetMode).toHaveBeenCalledWith(CanvasMode.CONSULTANT);
    });
  });

  describe('reset', () => {
    it('returns to initial state', () => {
      useProjectCreationStore.setState({
        step: CreationStep.CREATED,
        availableTemplates: [makeTemplate()],
        selectedTemplate: makeTemplate(),
        customerReference: 'CUST-001',
        siteReference: 'SITE-001',
        createdProjectId: 'proj-1',
        idempotencyKey: 'some-key-123',
        isLoading: true,
        error: 'some error',
      });

      useProjectCreationStore.getState().reset();

      const state = useProjectCreationStore.getState();
      expect(state.step).toBe(CreationStep.IDLE);
      expect(state.availableTemplates).toEqual([]);
      expect(state.selectedTemplate).toBeNull();
      expect(state.customerReference).toBe('');
      expect(state.siteReference).toBe('');
      expect(state.createdProjectId).toBeNull();
      expect(state.idempotencyKey).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
