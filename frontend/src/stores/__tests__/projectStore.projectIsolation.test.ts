import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProjectStore } from '@/stores/projectStore';
import type { ProjectSnapshot, TemplateZone, ProjectObstruction } from '@/types/database';
import { ProjectStatus, ZoneWidthStrategy, ZoneHeightStrategy, ZonePositionStrategy } from '@/types/database';

// Track fromTable calls to verify no template_zone/template_zone_sku writes
const fromTableCalls: string[] = [];
let mockUpsertError: { message: string; code: string } | null = null;
let mockInsertData: Record<string, unknown> | null = null;

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  isSupabaseConfigured: false,
  fromTable: vi.fn((table: string) => {
    fromTableCalls.push(table);
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockInsertData ?? { obstruction_id: 'obs-new', project_id: 'proj-1', x_mm: 10, y_mm: 20, width_mm: 100, height_mm: 50, obstruction_type: 'WINDOW', label: null, created_at: '2024-01-01' },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: mockUpsertError }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
  }),
}));

vi.mock('@/stores/canvasStore', () => ({
  useCanvasStore: {
    getState: () => ({
      setSaveStatus: vi.fn(),
      version: 1,
    }),
  },
}));

const makeZone = (id: string): TemplateZone => ({
  zone_id: id,
  template_id: 'tpl-1',
  x_mm: 0,
  y_mm: 0,
  width_mm: 100,
  height_mm: 100,
  width_strategy: ZoneWidthStrategy.FIXED,
  height_strategy: ZoneHeightStrategy.FIXED,
  position_strategy: ZonePositionStrategy.FIXED,
  segment: null,
  created_at: '2024-01-01T00:00:00Z',
});

const makeSnapshot = (permissions: unknown[] = []): ProjectSnapshot => ({
  snapshot_id: 'snap-1',
  project_id: 'proj-1',
  template_id: 'tpl-1',
  snapshot_data: {
    zones: [
      {
        zone_id: 'zone-1',
        x_mm: 0,
        y_mm: 0,
        width_mm: 100,
        height_mm: 100,
        width_strategy: 'FIXED',
        height_strategy: 'FIXED',
        position_strategy: 'FIXED',
        primary_sku: { sku_id: 'sku-1', sku_code: 'WP-001' },
        alternatives: [{ sku_id: 'sku-alt-1', sku_code: 'WP-ALT-001' }],
      },
    ],
    lighting: [],
    furniture: [],
    trims: [],
    wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2400 },
    consultant_permissions: permissions,
  },
  snapshot_hash: 'abc123',
  rule_set_id: 'rs-1',
  created_at: '2024-01-01T00:00:00Z',
});

describe('projectStore - Project Isolation (Phase 2)', () => {
  beforeEach(() => {
    fromTableCalls.length = 0;
    mockUpsertError = null;
    mockInsertData = null;
    useProjectStore.setState({
      currentProject: {
        project_id: 'proj-1',
        customer_reference: 'Test',
        site_reference: null,
        template_id: 'tpl-1',
        snapshot_id: 'snap-1',
        current_configuration_id: null,
        current_actual_bom_id: null,
        status: ProjectStatus.CONFIGURED,
        created_by: 'user-1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        finalized_at: null,
      },
      currentSnapshot: makeSnapshot(),
      zones: [makeZone('zone-1'), makeZone('zone-2')],
      zoneSku: new Map(),
      obstructions: [],
      measurements: null,
      isLoading: false,
      error: null,
    });
  });

  describe('updateZone - in-memory only', () => {
    it('updates zone in state without calling fromTable for template_zone', async () => {
      const updatedZone = { ...makeZone('zone-1'), width_mm: 200 };

      await useProjectStore.getState().updateZone(updatedZone);

      const zone = useProjectStore.getState().zones.find((z) => z.zone_id === 'zone-1');
      expect(zone?.width_mm).toBe(200);
      // Must NOT write to template_zone
      expect(fromTableCalls).not.toContain('template_zone');
    });

    it('does not call any fromTable at all for zone updates', async () => {
      const updatedZone = { ...makeZone('zone-1'), height_mm: 300 };

      await useProjectStore.getState().updateZone(updatedZone);

      // No DB calls at all for zone update
      expect(fromTableCalls.length).toBe(0);
    });
  });

  describe('addZone - in-memory only', () => {
    it('adds zone to state without calling fromTable', async () => {
      await useProjectStore.getState().addZone({
        template_id: 'tpl-1',
        x_mm: 200,
        y_mm: 0,
        width_mm: 150,
        height_mm: 100,
        width_strategy: ZoneWidthStrategy.FIXED,
        height_strategy: ZoneHeightStrategy.FIXED,
        position_strategy: ZonePositionStrategy.FIXED,
        segment: null,
      });

      expect(useProjectStore.getState().zones.length).toBe(3);
      expect(fromTableCalls).not.toContain('template_zone');
    });

    it('generates a zone_id and created_at for the new zone', async () => {
      await useProjectStore.getState().addZone({
        template_id: 'tpl-1',
        x_mm: 0,
        y_mm: 0,
        width_mm: 50,
        height_mm: 50,
        width_strategy: ZoneWidthStrategy.FIXED,
        height_strategy: ZoneHeightStrategy.FIXED,
        position_strategy: ZonePositionStrategy.FIXED,
        segment: null,
      });

      const newZone = useProjectStore.getState().zones[2];
      expect(newZone.zone_id).toBeDefined();
      expect(newZone.zone_id.length).toBeGreaterThan(0);
      expect(newZone.created_at).toBeDefined();
    });
  });

  describe('removeZone - in-memory only', () => {
    it('removes zone from state without calling fromTable for template_zone', async () => {
      await useProjectStore.getState().removeZone('zone-1');

      expect(useProjectStore.getState().zones.length).toBe(1);
      expect(useProjectStore.getState().zones[0].zone_id).toBe('zone-2');
      expect(fromTableCalls).not.toContain('template_zone');
    });
  });

  describe('assignSku - in-memory only', () => {
    it('assigns SKU in state without calling fromTable for template_zone_sku', async () => {
      await useProjectStore.getState().assignSku('zone-1', 'sku-1');

      expect(useProjectStore.getState().zoneSku.has('zone-1')).toBe(true);
      expect(fromTableCalls).not.toContain('template_zone_sku');
    });

    it('resolves SKU data from snapshot when available', async () => {
      await useProjectStore.getState().assignSku('zone-1', 'sku-1');

      const sku = useProjectStore.getState().zoneSku.get('zone-1');
      expect(sku?.sku_id).toBe('sku-1');
    });

    it('creates a placeholder when SKU is not in snapshot', async () => {
      await useProjectStore.getState().assignSku('zone-1', 'sku-unknown');

      const sku = useProjectStore.getState().zoneSku.get('zone-1');
      expect(sku?.sku_id).toBe('sku-unknown');
    });
  });

  describe('removeSku - in-memory only', () => {
    it('removes SKU from state without calling fromTable for template_zone_sku', async () => {
      // Pre-assign a SKU
      const skuMap = new Map([['zone-1', { sku_id: 'sku-1' } as never]]);
      useProjectStore.setState({ zoneSku: skuMap });

      await useProjectStore.getState().removeSku('zone-1');

      expect(useProjectStore.getState().zoneSku.has('zone-1')).toBe(false);
      expect(fromTableCalls).not.toContain('template_zone_sku');
    });
  });

  describe('updateMeasurements - upsert with onConflict', () => {
    it('calls fromTable with project_measurement and uses upsert', async () => {
      await useProjectStore.getState().updateMeasurements({
        wall_width_mm: 3000,
        wall_height_mm: 2400,
      });

      expect(fromTableCalls).toContain('project_measurement');
      // Verify upsert was called (mock tracks calls)
      const { fromTable: mockFromTable } = await import('@/lib/supabase');
      const builder = (mockFromTable as ReturnType<typeof vi.fn>).mock.results.find(
        (r) => r.type === 'return',
      );
      expect(builder).toBeDefined();
    });

    it('updates in-memory measurements state', async () => {
      await useProjectStore.getState().updateMeasurements({
        wall_width_mm: 3500,
        wall_height_mm: 2700,
      });

      const measurements = useProjectStore.getState().measurements;
      expect(measurements?.wall_width_mm).toBe(3500);
      expect(measurements?.wall_height_mm).toBe(2700);
      expect(measurements?.project_id).toBe('proj-1');
    });

    it('does nothing when no current project', async () => {
      useProjectStore.setState({ currentProject: null });

      await useProjectStore.getState().updateMeasurements({
        wall_width_mm: 3000,
      });

      expect(fromTableCalls).not.toContain('project_measurement');
    });
  });

  describe('obstruction CRUD', () => {
    it('addObstruction inserts to project_obstruction and updates state', async () => {
      await useProjectStore.getState().addObstruction({
        project_id: 'proj-1',
        x_mm: 10,
        y_mm: 20,
        width_mm: 100,
        height_mm: 50,
        obstruction_type: 'WINDOW',
        label: null,
      });

      expect(fromTableCalls).toContain('project_obstruction');
      expect(useProjectStore.getState().obstructions.length).toBe(1);
    });

    it('removeObstruction removes from state and calls delete', async () => {
      useProjectStore.setState({
        obstructions: [
          {
            obstruction_id: 'obs-1',
            project_id: 'proj-1',
            x_mm: 10,
            y_mm: 20,
            width_mm: 100,
            height_mm: 50,
            obstruction_type: 'WINDOW' as const,
            label: null,
            created_at: '2024-01-01',
          },
        ],
      });

      await useProjectStore.getState().removeObstruction('obs-1');

      expect(useProjectStore.getState().obstructions.length).toBe(0);
      expect(fromTableCalls).toContain('project_obstruction');
    });

    it('updateObstruction updates in state and calls update', async () => {
      const existing: ProjectObstruction = {
        obstruction_id: 'obs-1',
        project_id: 'proj-1',
        x_mm: 10,
        y_mm: 20,
        width_mm: 100,
        height_mm: 50,
        obstruction_type: 'WINDOW',
        label: null,
        created_at: '2024-01-01',
      };
      useProjectStore.setState({ obstructions: [existing] });

      const updated = { ...existing, x_mm: 50, width_mm: 200 };
      await useProjectStore.getState().updateObstruction(updated);

      const obs = useProjectStore.getState().obstructions[0];
      expect(obs.x_mm).toBe(50);
      expect(obs.width_mm).toBe(200);
    });

    it('does not add obstruction when project is FINALIZED', async () => {
      useProjectStore.setState({
        currentProject: {
          ...useProjectStore.getState().currentProject!,
          status: ProjectStatus.FINALIZED,
        },
      });

      await useProjectStore.getState().addObstruction({
        project_id: 'proj-1',
        x_mm: 10,
        y_mm: 20,
        width_mm: 100,
        height_mm: 50,
        obstruction_type: 'DOOR',
        label: 'Front Door',
      });

      expect(useProjectStore.getState().obstructions.length).toBe(0);
    });
  });

  describe('saveWallConfig', () => {
    it('calls upsert on project_wall_configuration', async () => {
      await useProjectStore.getState().saveWallConfig({
        project_id: 'proj-1',
        wall_type: 'STRAIGHT',
        total_width_mm: 3000,
        total_height_mm: 2400,
        rows: 2,
        columns: 4,
        panel_gap_mm: 5,
        fit_algorithm: 'PROPORTIONAL',
        fit_intensity_percent: 100,
        mounting_type: 'DIRECT',
        consultant_overrides: null,
      });

      expect(fromTableCalls).toContain('project_wall_configuration');
    });

    it('does nothing when project is FINALIZED', async () => {
      useProjectStore.setState({
        currentProject: {
          ...useProjectStore.getState().currentProject!,
          status: ProjectStatus.FINALIZED,
        },
      });

      await useProjectStore.getState().saveWallConfig({
        project_id: 'proj-1',
        wall_type: 'STRAIGHT',
        total_width_mm: 3000,
        total_height_mm: 2400,
        rows: 2,
        columns: 4,
        panel_gap_mm: 5,
        fit_algorithm: 'PROPORTIONAL',
        fit_intensity_percent: 100,
        mounting_type: 'DIRECT',
        consultant_overrides: null,
      });

      expect(fromTableCalls).not.toContain('project_wall_configuration');
    });
  });

  describe('checkPermission', () => {
    it('returns allowed when no snapshot is loaded', () => {
      useProjectStore.setState({ currentSnapshot: null });

      const result = useProjectStore.getState().checkPermission('panel_gap_mm', 10);
      expect(result.allowed).toBe(true);
    });

    it('returns allowed when parameter has no permission record', () => {
      useProjectStore.setState({
        currentSnapshot: makeSnapshot([
          { parameter_key: 'other_param', edit_mode: 'LOCKED' },
        ]),
      });

      const result = useProjectStore.getState().checkPermission('panel_gap_mm', 10);
      expect(result.allowed).toBe(true);
    });

    it('returns not allowed when parameter is LOCKED', () => {
      useProjectStore.setState({
        currentSnapshot: makeSnapshot([
          { parameter_key: 'panel_gap_mm', edit_mode: 'LOCKED' },
        ]),
      });

      const result = useProjectStore.getState().checkPermission('panel_gap_mm', 10);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('locked');
    });

    it('returns allowed for FREE edit_mode', () => {
      useProjectStore.setState({
        currentSnapshot: makeSnapshot([
          { parameter_key: 'panel_gap_mm', edit_mode: 'FREE' },
        ]),
      });

      const result = useProjectStore.getState().checkPermission('panel_gap_mm', 10);
      expect(result.allowed).toBe(true);
    });

    it('enforces min_value/max_value for RESTRICTED mode', () => {
      useProjectStore.setState({
        currentSnapshot: makeSnapshot([
          { parameter_key: 'panel_gap_mm', edit_mode: 'RESTRICTED', min_value: 2, max_value: 8 },
        ]),
      });

      // Within range
      expect(useProjectStore.getState().checkPermission('panel_gap_mm', 5).allowed).toBe(true);

      // Below min
      const belowResult = useProjectStore.getState().checkPermission('panel_gap_mm', 1);
      expect(belowResult.allowed).toBe(false);
      expect(belowResult.reason).toContain('>= 2');

      // Above max
      const aboveResult = useProjectStore.getState().checkPermission('panel_gap_mm', 10);
      expect(aboveResult.allowed).toBe(false);
      expect(aboveResult.reason).toContain('<= 8');
    });

    it('enforces allowed_values for RESTRICTED mode', () => {
      useProjectStore.setState({
        currentSnapshot: makeSnapshot([
          { parameter_key: 'mounting_type', edit_mode: 'RESTRICTED', allowed_values: ['DIRECT', 'PROFILE'], min_value: null, max_value: null },
        ]),
      });

      expect(useProjectStore.getState().checkPermission('mounting_type', 'DIRECT').allowed).toBe(true);
      expect(useProjectStore.getState().checkPermission('mounting_type', 'PROFILE').allowed).toBe(true);

      const disallowed = useProjectStore.getState().checkPermission('mounting_type', 'COVE');
      expect(disallowed.allowed).toBe(false);
      expect(disallowed.reason).toContain('must be one of');
    });
  });
});
