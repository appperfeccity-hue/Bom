import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectStore } from '../projectStore';
import { ProjectStatus, ZoneWidthStrategy, ZoneHeightStrategy, ZonePositionStrategy } from '@/types/database';
import type { Project, TemplateZone } from '@/types/database';

// Mock the supabase module
vi.mock('@/lib/supabase', () => {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnThis(),
  };
  return {
    fromTable: vi.fn(() => ({ ...mockQueryBuilder })),
    supabase: {},
    isSupabaseConfigured: false,
  };
});

// Mock canvasStore
vi.mock('@/stores/canvasStore', () => ({
  useCanvasStore: {
    getState: () => ({
      setSaveStatus: vi.fn(),
      version: 1,
    }),
  },
}));

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'proj-1',
  name: 'Test Project',
  template_id: 'tpl-1',
  status: ProjectStatus.VALIDATED,
  client_name: 'Client',
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  version: 1,
  ...overrides,
});

const makeZone = (id: string): TemplateZone => ({
  id,
  template_id: 'tpl-1',
  name: `Zone ${id}`,
  x_mm: 0,
  y_mm: 0,
  width_mm: 100,
  height_mm: 100,
  width_strategy: ZoneWidthStrategy.FIXED,
  height_strategy: ZoneHeightStrategy.FIXED,
  position_strategy: ZonePositionStrategy.ABSOLUTE,
  z_index: 0,
  segment: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
});

describe('projectStore - finalization guards', () => {
  beforeEach(() => {
    useProjectStore.setState({
      currentProject: makeProject({ status: ProjectStatus.FINALIZED }),
      zones: [makeZone('zone-1'), makeZone('zone-2')],
      zoneSku: new Map(),
      measurements: null,
      isLoading: false,
      error: null,
    });
  });

  describe('updateZone guard', () => {
    it('does not update zone when project is FINALIZED', async () => {
      const originalZones = useProjectStore.getState().zones;
      const updatedZone = { ...makeZone('zone-1'), name: 'Modified Zone' };

      await useProjectStore.getState().updateZone(updatedZone);

      // Zone should remain unchanged
      expect(useProjectStore.getState().zones).toEqual(originalZones);
    });

    it('allows zone update when project is not FINALIZED', async () => {
      useProjectStore.setState({
        currentProject: makeProject({ status: ProjectStatus.VALIDATED }),
      });
      const updatedZone = { ...makeZone('zone-1'), name: 'Modified Zone' };

      await useProjectStore.getState().updateZone(updatedZone);

      // Zone should be updated (optimistic update)
      const zone = useProjectStore.getState().zones.find((z) => z.id === 'zone-1');
      expect(zone?.name).toBe('Modified Zone');
    });
  });

  describe('addZone guard', () => {
    it('does not add zone when project is FINALIZED', async () => {
      const originalZones = useProjectStore.getState().zones;

      await useProjectStore.getState().addZone({
        template_id: 'tpl-1',
        name: 'New Zone',
        x_mm: 0,
        y_mm: 0,
        width_mm: 50,
        height_mm: 50,
        width_strategy: ZoneWidthStrategy.FIXED,
        height_strategy: ZoneHeightStrategy.FIXED,
        position_strategy: ZonePositionStrategy.ABSOLUTE,
        z_index: 1,
        segment: null,
      });

      expect(useProjectStore.getState().zones).toEqual(originalZones);
    });
  });

  describe('removeZone guard', () => {
    it('does not remove zone when project is FINALIZED', async () => {
      const originalZones = useProjectStore.getState().zones;

      await useProjectStore.getState().removeZone('zone-1');

      expect(useProjectStore.getState().zones).toEqual(originalZones);
    });
  });

  describe('assignSku guard', () => {
    it('does not assign SKU when project is FINALIZED', async () => {
      await useProjectStore.getState().assignSku('zone-1', 'sku-1');

      expect(useProjectStore.getState().zoneSku.size).toBe(0);
    });
  });

  describe('updateMeasurements guard', () => {
    it('does not update measurements when project is FINALIZED', async () => {
      await useProjectStore.getState().updateMeasurements({ wall_geometry: 'CURVED' } as never);

      expect(useProjectStore.getState().measurements).toBeNull();
    });
  });
});
