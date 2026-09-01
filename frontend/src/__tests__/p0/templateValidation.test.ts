/**
 * P0 Test Suite: Template Validation in create_project RPC
 *
 * Verifies that the projectCreationStore correctly handles rejection
 * from the create_project RPC when an inactive or non-existent template
 * is used.
 *
 * Server-side, the create_project() function now enforces:
 *   IF NOT EXISTS (SELECT 1 FROM perfecity.template WHERE template_id = p_template_id AND status = 'ACTIVE')
 *   THEN RAISE EXCEPTION 'Template is not active or does not exist';
 *
 * This is release-blocking because allowing project creation on DRAFT or
 * missing templates would produce orphaned projects with no valid snapshot.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectCreationStore, CreationStep } from '@/stores/projectCreationStore';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCanvasStore } from '@/stores/canvasStore';
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

// snapshotBuilder is no longer imported by projectCreationStore (server-side snapshot in v1.1.8).
// This mock is retained as a no-op for safety but has no effect.

const makeTemplate = (overrides: Partial<Template> = {}): Template => ({
  template_id: 'tpl-active-1',
  name: 'Active Test Template',
  description: 'An active template for testing',
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

describe('P0: Template Validation - create_project RPC enforcement', () => {
  beforeEach(() => {
    useProjectCreationStore.getState().reset();
    useAuthStore.setState({
      user: { id: 'user-consultant-1' } as never,
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

  describe('ACTIVE template - project creation succeeds', () => {
    it('should successfully create project when RPC accepts ACTIVE template', async () => {
      const { fromTable, supabase } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);
      const mockedRpc = vi.mocked(supabase.rpc);

      const activeTemplate = makeTemplate({ status: TemplateStatus.ACTIVE });
      useProjectCreationStore.setState({
        selectedTemplate: activeTemplate,
        step: CreationStep.PROJECT_DETAILS,
        customerReference: 'CUST-VALID',
        siteReference: 'SITE-VALID',
      });

      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          then: (resolve: (v: unknown) => void) => Promise.resolve({ data: [], error: null }).then(resolve),
        }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as unknown as ReturnType<typeof fromTable>);

      // RPC succeeds for ACTIVE template
      mockedRpc.mockResolvedValue({ data: 'project-active-001', error: null } as never);

      // Mock post-creation steps
      const mockLoadProject = vi.fn().mockResolvedValue(undefined);
      useProjectStore.setState({ loadProject: mockLoadProject } as never);
      useCanvasStore.setState({ setMode: vi.fn() } as never);

      await useProjectCreationStore.getState().createProject();

      const state = useProjectCreationStore.getState();
      expect(state.step).toBe(CreationStep.CREATED);
      expect(state.createdProjectId).toBe('project-active-001');
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('DRAFT template - RPC rejects with template validation error', () => {
    it('should transition to ERROR step when RPC rejects DRAFT template', async () => {
      const { fromTable, supabase } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);
      const mockedRpc = vi.mocked(supabase.rpc);

      // Even though frontend filters to ACTIVE, simulate a DRAFT template reaching the RPC
      const draftTemplate = makeTemplate({
        template_id: 'tpl-draft-1',
        name: 'Draft Template',
        status: TemplateStatus.DRAFT,
      });
      useProjectCreationStore.setState({
        selectedTemplate: draftTemplate,
        step: CreationStep.PROJECT_DETAILS,
        customerReference: 'CUST-DRAFT',
        siteReference: 'SITE-DRAFT',
      });

      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          then: (resolve: (v: unknown) => void) => Promise.resolve({ data: [], error: null }).then(resolve),
        }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as unknown as ReturnType<typeof fromTable>);

      // RPC rejects with the template validation error
      mockedRpc.mockResolvedValue({
        data: null,
        error: { message: 'Template is not active or does not exist' },
      } as never);

      await useProjectCreationStore.getState().createProject();

      const state = useProjectCreationStore.getState();
      expect(state.step).toBe(CreationStep.ERROR);
      expect(state.error).toBe('Template is not active or does not exist');
      expect(state.createdProjectId).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('should preserve idempotency key for retry after DRAFT template rejection', async () => {
      const { fromTable, supabase } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);
      const mockedRpc = vi.mocked(supabase.rpc);

      const draftTemplate = makeTemplate({
        template_id: 'tpl-draft-2',
        status: TemplateStatus.DRAFT,
      });
      useProjectCreationStore.setState({
        selectedTemplate: draftTemplate,
        step: CreationStep.PROJECT_DETAILS,
      });

      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          then: (resolve: (v: unknown) => void) => Promise.resolve({ data: [], error: null }).then(resolve),
        }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as unknown as ReturnType<typeof fromTable>);

      mockedRpc.mockResolvedValue({
        data: null,
        error: { message: 'Template is not active or does not exist' },
      } as never);

      await useProjectCreationStore.getState().createProject();

      const state = useProjectCreationStore.getState();
      // Idempotency key is retained for potential retry
      expect(state.idempotencyKey).toBeTruthy();
      expect(state.idempotencyKey).toContain('user-consultant-1');
      expect(state.idempotencyKey).toContain('tpl-draft-2');
    });
  });

  describe('RETIRED template - RPC rejects with template validation error', () => {
    it('should transition to ERROR step when RPC rejects RETIRED template', async () => {
      const { fromTable, supabase } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);
      const mockedRpc = vi.mocked(supabase.rpc);

      const retiredTemplate = makeTemplate({
        template_id: 'tpl-retired-1',
        name: 'Retired Template',
        status: TemplateStatus.RETIRED,
      });
      useProjectCreationStore.setState({
        selectedTemplate: retiredTemplate,
        step: CreationStep.PROJECT_DETAILS,
        customerReference: 'CUST-RETIRED',
        siteReference: 'SITE-RETIRED',
      });

      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          then: (resolve: (v: unknown) => void) => Promise.resolve({ data: [], error: null }).then(resolve),
        }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as unknown as ReturnType<typeof fromTable>);

      // RPC rejects RETIRED template
      mockedRpc.mockResolvedValue({
        data: null,
        error: { message: 'Template is not active or does not exist' },
      } as never);

      await useProjectCreationStore.getState().createProject();

      const state = useProjectCreationStore.getState();
      expect(state.step).toBe(CreationStep.ERROR);
      expect(state.error).toBe('Template is not active or does not exist');
      expect(state.createdProjectId).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('Non-existent template UUID - RPC rejects with template validation error', () => {
    it('should transition to ERROR step when RPC rejects non-existent template', async () => {
      const { fromTable, supabase } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);
      const mockedRpc = vi.mocked(supabase.rpc);

      // Simulate a template with an ID that does not exist in the database
      const nonExistentTemplate = makeTemplate({
        template_id: '00000000-0000-0000-0000-000000000000',
        name: 'Ghost Template',
        status: TemplateStatus.ACTIVE, // client thinks it is active, but DB has no record
      });
      useProjectCreationStore.setState({
        selectedTemplate: nonExistentTemplate,
        step: CreationStep.PROJECT_DETAILS,
        customerReference: 'CUST-GHOST',
        siteReference: 'SITE-GHOST',
      });

      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          then: (resolve: (v: unknown) => void) => Promise.resolve({ data: [], error: null }).then(resolve),
        }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as unknown as ReturnType<typeof fromTable>);

      // RPC rejects because template UUID does not exist
      mockedRpc.mockResolvedValue({
        data: null,
        error: { message: 'Template is not active or does not exist' },
      } as never);

      await useProjectCreationStore.getState().createProject();

      const state = useProjectCreationStore.getState();
      expect(state.step).toBe(CreationStep.ERROR);
      expect(state.error).toBe('Template is not active or does not exist');
      expect(state.createdProjectId).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('should not attempt to load project or switch mode after rejection', async () => {
      const { fromTable, supabase } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);
      const mockedRpc = vi.mocked(supabase.rpc);

      const nonExistentTemplate = makeTemplate({
        template_id: '11111111-1111-1111-1111-111111111111',
      });
      useProjectCreationStore.setState({
        selectedTemplate: nonExistentTemplate,
        step: CreationStep.PROJECT_DETAILS,
      });

      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          then: (resolve: (v: unknown) => void) => Promise.resolve({ data: [], error: null }).then(resolve),
        }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as unknown as ReturnType<typeof fromTable>);

      mockedRpc.mockResolvedValue({
        data: null,
        error: { message: 'Template is not active or does not exist' },
      } as never);

      const mockLoadProject = vi.fn();
      useProjectStore.setState({ loadProject: mockLoadProject } as never);
      const mockSetMode = vi.fn();
      useCanvasStore.setState({ setMode: mockSetMode } as never);

      await useProjectCreationStore.getState().createProject();

      // loadProject and setMode should NOT have been called
      expect(mockLoadProject).not.toHaveBeenCalled();
      expect(mockSetMode).not.toHaveBeenCalled();
    });
  });

  describe('Frontend-level template filtering (defense in depth)', () => {
    it('fetchAvailableTemplates only queries for ACTIVE status', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockedFromTable.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      } as unknown as ReturnType<typeof fromTable>);

      await useProjectCreationStore.getState().fetchAvailableTemplates();

      // Verify that fromTable was called and the query filters by ACTIVE status
      expect(mockedFromTable).toHaveBeenCalledWith('template');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('status', 'ACTIVE');
    });
  });
});
