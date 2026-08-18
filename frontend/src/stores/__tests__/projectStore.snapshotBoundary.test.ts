import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProjectStore, PROJECT_TEMPLATE_WRITE_BLOCKED } from '@/stores/projectStore';
import { useCanvasStore } from '@/stores/canvasStore';

const fromTableMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  fromTable: (table: string) => fromTableMock(table),
}));

const project = {
  project_id: 'proj-1',
  template_id: 'tpl-1',
  snapshot_id: 'snap-1',
  status: 'DRAFT',
};

const snapshotData = {
  snapshot_version: 2,
  template: { template_id: 'tpl-1', name: 'Frozen Template', status: 'ACTIVE' },
  wall_geometry: { type: 'L_CORNER', base_width_mm: 3000, base_height_mm: 2400 },
  zones: [
    {
      zone_id: 'zone-1',
      template_id: 'tpl-1',
      created_at: '2026-01-01T00:00:00Z',
      segment: null,
      x_mm: 0,
      y_mm: 0,
      width_mm: 600,
      height_mm: 2400,
      width_strategy: 'PROPORTIONAL',
      height_strategy: 'DERIVED_FROM_WALL',
      position_strategy: 'FIXED',
      primary_sku: { sku_id: 'sku-1', sku_code: 'FROZEN-PRIMARY' },
      alternatives: [{ alternative_id: 'alt-1', display_order: 1, reason: null, sku: { sku_id: 'sku-2' } }],
    },
  ],
  lighting: [{ lighting_id: 'lt-1' }],
  furniture: [],
  trims: [],
  consultant_permissions: [{ permission_id: 'perm-1', parameter_key: 'ZONE_WIDTH' }],
};

const snapshot = {
  snapshot_id: 'snap-1',
  project_id: 'proj-1',
  template_id: 'tpl-1',
  snapshot_data: snapshotData,
  snapshot_hash: 'deadbeef',
  rule_set_id: 'rs-1',
};

function result(table: string) {
  if (table === 'project') return { data: project, error: null };
  if (table === 'project_measurement') return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
  if (table === 'project_snapshot') return { data: snapshot, error: null };
  return { data: null, error: { code: 'X', message: `unexpected read of ${table}` } };
}

describe('projectStore snapshot boundary', () => {
  beforeEach(() => {
    fromTableMock.mockReset();
    fromTableMock.mockImplementation((table: string) => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve(result(table)) }),
      }),
    }));
    useProjectStore.getState().reset();
  });

  it('hydrates the consultant project from project_snapshot, not from live template tables', async () => {
    await useProjectStore.getState().loadProject('proj-1');

    const state = useProjectStore.getState();
    expect(state.error).toBeNull();
    expect(state.currentSnapshot?.snapshot_hash).toBe('deadbeef');
    expect(state.currentTemplate?.name).toBe('Frozen Template');
    expect(state.zones.map((z) => z.zone_id)).toEqual(['zone-1']);
    expect(state.zoneSku.get('zone-1')?.sku_code).toBe('FROZEN-PRIMARY');
    expect(state.zoneAlternatives.get('zone-1')).toHaveLength(1);
    expect(state.consultantPermissions[0].parameter_key).toBe('ZONE_WIDTH');
    expect(state.lighting).toHaveLength(1);
    expect(state.wallGeometry).toBe('L_CORNER');

    const tablesRead = fromTableMock.mock.calls.map((call) => call[0]);
    expect(tablesRead).toEqual(['project', 'project_measurement', 'project_snapshot']);
  });

  it('fails loudly when a project has no snapshot rather than falling back to the template', async () => {
    fromTableMock.mockImplementation((table: string) => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve(
              table === 'project_snapshot'
                ? { data: null, error: { code: 'PGRST116', message: 'no snapshot' } }
                : result(table),
            ),
        }),
      }),
    }));

    await useProjectStore.getState().loadProject('proj-1');

    const state = useProjectStore.getState();
    expect(state.error).toBe('no snapshot');
    expect(state.zones).toEqual([]);
    expect(fromTableMock.mock.calls.map((call) => call[0])).not.toContain('template_zone');
  });

  describe('template writes from a project context', () => {
    beforeEach(async () => {
      await useProjectStore.getState().loadProject('proj-1');
      fromTableMock.mockClear();
      useCanvasStore.getState().setSaveStatus('saved');
    });

    const mutations: [string, () => Promise<void>][] = [
      ['updateZone', () => useProjectStore.getState().updateZone({ ...useProjectStore.getState().zones[0], width_mm: 1200 })],
      ['addZone', () => useProjectStore.getState().addZone({ template_id: 'tpl-1', x_mm: 0, y_mm: 0, width_mm: 600, height_mm: 2400 } as never)],
      ['removeZone', () => useProjectStore.getState().removeZone('zone-1')],
      ['assignSku', () => useProjectStore.getState().assignSku('zone-1', 'sku-9')],
      ['removeSku', () => useProjectStore.getState().removeSku('zone-1')],
    ];

    it.each(mutations)('%s is rejected and writes nothing', async (_name, mutate) => {
      const before = useProjectStore.getState();
      const zonesBefore = before.zones;
      const skuBefore = before.zoneSku.get('zone-1');

      await mutate();

      const state = useProjectStore.getState();
      expect(fromTableMock).not.toHaveBeenCalled();
      expect(state.error).toBe(PROJECT_TEMPLATE_WRITE_BLOCKED);
      expect(useCanvasStore.getState().saveStatus).toBe('error');
      expect(state.zones).toEqual(zonesBefore);
      expect(state.zoneSku.get('zone-1')).toBe(skuBefore);
    });
  });

  it('still writes template_zone in designer context, where no project is loaded', async () => {
    fromTableMock.mockImplementation(() => ({
      insert: () => ({
        select: () => ({
          single: () =>
            Promise.resolve({ data: { zone_id: 'zone-new', template_id: 'tpl-1' }, error: null }),
        }),
      }),
    }));

    await useProjectStore.getState().addZone({ template_id: 'tpl-1' } as never);

    expect(fromTableMock).toHaveBeenCalledWith('template_zone');
    expect(useProjectStore.getState().zones.map((z) => z.zone_id)).toEqual(['zone-new']);
  });
});
