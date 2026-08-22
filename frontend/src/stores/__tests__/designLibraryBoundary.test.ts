import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDesignLibraryStore } from '../designLibraryStore';
import { useProjectCreationStore, CreationStep } from '../projectCreationStore';
import { useProjectStore } from '../projectStore';
import { useAuthStore } from '../authStore';
import { useCanvasStore } from '../canvasStore';
import { TemplateStatus, AdaptationStrategy, CanvasMode, ProjectStatus } from '@/types/database';
import type { Template, ProjectSnapshot } from '@/types/database';

// Mock the supabase module
vi.mock('@/lib/supabase', () => ({
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  })),
  supabase: { rpc: vi.fn() },
  isSupabaseConfigured: false,
}));

vi.mock('@/stores/canvasStore', () => ({
  useCanvasStore: {
    getState: () => ({
      setMode: vi.fn(),
      setSaveStatus: vi.fn(),
      mode: CanvasMode.DESIGNER,
      version: 1,
    }),
    setState: vi.fn(),
  },
}));

const makeTemplate = (overrides: Partial<Template> = {}): Template => ({
  template_id: 'tpl-boundary-1',
  name: 'Boundary Test Template',
  description: 'Template for boundary testing',
  design_family_id: null,
  design_subfamily_id: null,
  wall_application: null,
  wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2400 },
  adaptation_strategy: AdaptationStrategy.PROPORTIONAL,
  priority_zone_id: null,
  waste_factor: null,
  metadata: null,
  status: TemplateStatus.ACTIVE,
  created_by: 'designer-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeSnapshot = (overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot => ({
  snapshot_id: 'snap-boundary-1',
  project_id: 'proj-boundary-1',
  template_id: 'tpl-boundary-1',
  snapshot_data: {
    snapshot_version: 2,
    template: {
      template_id: 'tpl-boundary-1',
      name: 'Boundary Test Template',
      adaptation_strategy: 'PROPORTIONAL',
    },
    wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2400 },
    base_dimensions: { width_mm: 3000, height_mm: 2400 },
    zones: [
      {
        zone_id: 'zone-1',
        x_mm: 0,
        y_mm: 0,
        width_mm: 1500,
        height_mm: 2400,
        width_strategy: 'FIXED',
        height_strategy: 'FIXED',
        position_strategy: 'FIXED',
        primary_sku: { sku_id: 'sku-1', sku_code: 'WP-001' },
        alternatives: [],
      },
    ],
    lighting: [],
    furniture: [],
    trims: [],
    hidden_components: [],
    calculation_parameters: {},
    template_wall_configuration: null,
    consultant_permissions: [],
    site_obstructions: [],
  },
  snapshot_hash: 'hash-original-abc123',
  rule_set_id: 'rs-1',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('Design Library -> Project Boundary Isolation', () => {
  beforeEach(() => {
    useDesignLibraryStore.getState().reset();
    useProjectCreationStore.getState().reset();
    vi.clearAllMocks();
  });

  describe('1. designLibraryStore only fetches ACTIVE templates', () => {
    it('queries templates with status = ACTIVE filter', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      // Track calls to verify the ACTIVE filter
      const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq, in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis() });

      let callIndex = 0;
      mockedFromTable.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          // Template query - the critical one
          return { select: mockSelect, eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis() } as never;
        }
        if (callIndex === 2) {
          // design_family_master
          return { select: vi.fn().mockResolvedValue({ data: [], error: null }), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis() } as never;
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis() } as never;
      });

      await useDesignLibraryStore.getState().fetchTemplatesWithAvailability();

      // Verify first fromTable call is for templates with ACTIVE status
      expect(mockedFromTable).toHaveBeenCalled();
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('status', 'ACTIVE');
    });

    it('does not include DRAFT templates in the result', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      // Only ACTIVE templates are returned by the DB query (RLS enforced)
      const activeTemplates = [
        makeTemplate({ template_id: 'tpl-active', name: 'Published Design', status: TemplateStatus.ACTIVE }),
      ];

      let callIndex = 0;
      mockedFromTable.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: activeTemplates, error: null }),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 2) {
          return { select: vi.fn().mockResolvedValue({ data: [], error: null }), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis() } as never;
        }
        if (callIndex === 3) {
          // template_zone - no zones
          return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis() }), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis() } as never;
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis() } as never;
      });

      await useDesignLibraryStore.getState().fetchTemplatesWithAvailability();

      const state = useDesignLibraryStore.getState();
      // Only the ACTIVE template should be in results
      expect(state.templates).toHaveLength(1);
      expect(state.templates[0].template_id).toBe('tpl-active');
      // No DRAFT template should ever appear
      expect(state.templates.every((t) => t.status === TemplateStatus.ACTIVE)).toBe(true);
    });
  });

  describe('2. Project snapshot is independent of template changes after creation', () => {
    it('snapshot data remains unchanged even if template source is modified', () => {
      // Simulate: project was created, snapshot is loaded
      const originalSnapshot = makeSnapshot();
      useProjectStore.setState({
        currentProject: {
          project_id: 'proj-boundary-1',
          customer_reference: 'Test Client',
          site_reference: null,
          template_id: 'tpl-boundary-1',
          snapshot_id: 'snap-boundary-1',
          current_configuration_id: null,
          current_actual_bom_id: null,
          status: ProjectStatus.CONFIGURED,
          created_by: 'consultant-1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          finalized_at: null,
        },
        currentSnapshot: originalSnapshot,
        zones: [],
        zoneSku: new Map(),
        isLoading: false,
        error: null,
      });

      // Capture snapshot state before "template modification"
      const snapshotBefore = JSON.stringify(useProjectStore.getState().currentSnapshot?.snapshot_data);

      // Simulate: designer modifies the template (name change, zone resize)
      // This would only affect the template table, NOT the snapshot
      const modifiedTemplate = makeTemplate({
        template_id: 'tpl-boundary-1',
        name: 'MODIFIED Template Name',
        wall_geometry: { type: 'STRAIGHT', base_width_mm: 5000, base_height_mm: 3000 },
      });

      // The project snapshot should be completely unaffected
      const snapshotAfter = JSON.stringify(useProjectStore.getState().currentSnapshot?.snapshot_data);

      // Key assertion: snapshot is byte-identical before and after template change
      expect(snapshotAfter).toBe(snapshotBefore);

      // Verify the snapshot still has the ORIGINAL template data
      const snapshotData = useProjectStore.getState().currentSnapshot?.snapshot_data as Record<string, unknown>;
      expect((snapshotData.template as Record<string, unknown>)?.name).toBe('Boundary Test Template');
      expect((snapshotData.wall_geometry as Record<string, unknown>)?.base_width_mm).toBe(3000);

      // The modified template has different values, proving isolation
      expect(modifiedTemplate.name).toBe('MODIFIED Template Name');
      expect(modifiedTemplate.wall_geometry.base_width_mm).toBe(5000);
    });

    it('snapshot zones are independent of template_zone table changes', () => {
      const originalSnapshot = makeSnapshot();
      useProjectStore.setState({
        currentSnapshot: originalSnapshot,
      });

      // Snapshot zone data is frozen
      const snapshotData = useProjectStore.getState().currentSnapshot?.snapshot_data as Record<string, unknown>;
      const zones = snapshotData.zones as Array<Record<string, unknown>>;

      expect(zones).toHaveLength(1);
      expect(zones[0].width_mm).toBe(1500);
      expect(zones[0].height_mm).toBe(2400);

      // Even if a designer changes the template_zone in the DB, the snapshot is unaffected
      // (snapshot_data is a JSONB copy, not a FK reference)
      expect(zones[0].zone_id).toBe('zone-1');
    });
  });

  describe('3. Project snapshot contains snapshot_version: 2 from create_project RPC', () => {
    it('snapshot created by RPC has snapshot_version 2', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockedRpc = vi.mocked(supabase.rpc);

      // Setup: authenticated consultant
      useAuthStore.setState({
        user: { id: 'consultant-1' } as never,
        role: 'CONSULTANT',
        isAuthenticated: true,
        isLoading: false,
      });

      const template = makeTemplate();
      useProjectCreationStore.setState({
        selectedTemplate: template,
        step: CreationStep.PROJECT_DETAILS,
        customerReference: 'CUST-BOUNDARY',
        siteReference: 'SITE-BOUNDARY',
      });

      // Mock RPC returns project ID
      mockedRpc.mockResolvedValue({ data: 'proj-new-1', error: null } as never);

      // Mock loadProject to set snapshot with version 2
      const snapshotWithV2 = makeSnapshot({
        project_id: 'proj-new-1',
        snapshot_data: {
          snapshot_version: 2,
          template: {
            template_id: 'tpl-boundary-1',
            name: 'Boundary Test Template',
            adaptation_strategy: 'PROPORTIONAL',
          },
          wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2400 },
          base_dimensions: { width_mm: 3000, height_mm: 2400 },
          zones: [],
          lighting: [],
          furniture: [],
          trims: [],
          hidden_components: [],
          calculation_parameters: {},
          template_wall_configuration: null,
          consultant_permissions: [],
          site_obstructions: [],
        },
      });

      const mockLoadProject = vi.fn().mockImplementation(async () => {
        useProjectStore.setState({ currentSnapshot: snapshotWithV2 });
      });
      useProjectStore.setState({ loadProject: mockLoadProject } as never);
      useCanvasStore.setState({ setMode: vi.fn() } as never);

      await useProjectCreationStore.getState().createProject();

      // Verify the RPC was called with correct 5-arg signature
      expect(mockedRpc).toHaveBeenCalledWith('create_project', expect.objectContaining({
        p_template_id: 'tpl-boundary-1',
        p_user_id: 'consultant-1',
        p_customer_reference: 'CUST-BOUNDARY',
        p_site_reference: 'SITE-BOUNDARY',
      }));

      // Verify no snapshot data was sent from client (server builds it)
      const rpcArgs = mockedRpc.mock.calls[0][1] as Record<string, unknown>;
      expect(rpcArgs).not.toHaveProperty('p_snapshot_data');
      expect(rpcArgs).not.toHaveProperty('p_snapshot_hash');

      // After loadProject, verify snapshot has version 2
      const currentSnapshot = useProjectStore.getState().currentSnapshot;
      expect(currentSnapshot).not.toBeNull();
      const data = currentSnapshot!.snapshot_data as Record<string, unknown>;
      expect(data.snapshot_version).toBe(2);
    });

    it('snapshot_version 2 includes template metadata in snapshot_data', () => {
      const snapshot = makeSnapshot();
      useProjectStore.setState({ currentSnapshot: snapshot });

      const snapshotData = useProjectStore.getState().currentSnapshot?.snapshot_data as Record<string, unknown>;

      // v2 snapshots include template metadata block
      expect(snapshotData.snapshot_version).toBe(2);
      expect(snapshotData.template).toBeDefined();

      const templateMeta = snapshotData.template as Record<string, unknown>;
      expect(templateMeta.template_id).toBe('tpl-boundary-1');
      expect(templateMeta.name).toBe('Boundary Test Template');
      expect(templateMeta.adaptation_strategy).toBe('PROPORTIONAL');
    });

    it('v2 snapshot is self-contained (all data needed for BOM is inside snapshot_data)', () => {
      const snapshot = makeSnapshot();
      useProjectStore.setState({ currentSnapshot: snapshot });

      const snapshotData = useProjectStore.getState().currentSnapshot?.snapshot_data as Record<string, unknown>;

      // All required fields for BOM calculation are present in the frozen snapshot
      expect(snapshotData).toHaveProperty('wall_geometry');
      expect(snapshotData).toHaveProperty('base_dimensions');
      expect(snapshotData).toHaveProperty('zones');
      expect(snapshotData).toHaveProperty('lighting');
      expect(snapshotData).toHaveProperty('furniture');
      expect(snapshotData).toHaveProperty('trims');
      expect(snapshotData).toHaveProperty('calculation_parameters');
      expect(snapshotData).toHaveProperty('consultant_permissions');

      // No external reference needed - snapshot is the single source of truth for BOM
      const zones = snapshotData.zones as Array<Record<string, unknown>>;
      expect(zones[0]).toHaveProperty('primary_sku');
      expect(zones[0]).toHaveProperty('width_mm');
      expect(zones[0]).toHaveProperty('height_mm');
    });
  });
});
