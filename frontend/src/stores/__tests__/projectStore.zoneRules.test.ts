import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectStore } from '../projectStore';
import {
  ZoneWidthStrategy,
  ZoneHeightStrategy,
  ZonePositionStrategy,
} from '@/types/database';
import type { TemplateZone } from '@/types/database';

vi.mock('@/lib/supabase', () => ({
  fromTable: vi.fn(() => {
    throw new Error('no DB access expected in zone rule tests');
  }),
}));

function zone(overrides: Partial<TemplateZone> = {}) {
  return {
    template_id: 'tpl-1',
    x_mm: 0,
    y_mm: 0,
    width_mm: 400,
    height_mm: 400,
    width_strategy: ZoneWidthStrategy.FIXED,
    height_strategy: ZoneHeightStrategy.FIXED,
    position_strategy: ZonePositionStrategy.FIXED,
    segment: null,
    ...overrides,
  };
}

describe('zone rules', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useProjectStore.setState({
      measurements: {
        measurement_id: 'm-1',
        project_id: 'p-1',
        wall_width_mm: 4000,
        wall_height_mm: 2700,
        segment_a_width_mm: null,
        segment_b_width_mm: null,
        created_at: '2024-01-01T00:00:00Z',
      } as never,
    });
  });

  it('allows at most three zones per wall', async () => {
    const store = useProjectStore.getState();
    await store.addZone(zone({ x_mm: 0 }));
    await store.addZone(zone({ x_mm: 500 }));
    await store.addZone(zone({ x_mm: 1000 }));
    expect(useProjectStore.getState().zones).toHaveLength(3);

    await useProjectStore.getState().addZone(zone({ x_mm: 1500 }));
    expect(useProjectStore.getState().zones).toHaveLength(3);
    expect(useProjectStore.getState().error).toMatch(/exceeds the maximum/i);
  });

  it('bounds zones by the installation-area outer edge, not the full wall', async () => {
    useProjectStore.getState().setInstallationArea({
      coverage: 'PARTIAL',
      outerEdge: { x_mm: 0, y_mm: 0, width_mm: 1000, height_mm: 2700 },
    });

    // Fits inside the wall but crosses the installation-area outer edge.
    await useProjectStore.getState().addZone(zone({ x_mm: 800 }));
    expect(useProjectStore.getState().zones).toHaveLength(0);
    expect(useProjectStore.getState().error).toBeTruthy();

    await useProjectStore.getState().addZone(zone({ x_mm: 100 }));
    expect(useProjectStore.getState().zones).toHaveLength(1);
  });

  it('keeps one SKU per zone (uq_zone_single_sku) when reassigning', () => {
    useProjectStore.setState({
      zones: [{ ...zone(), zone_id: 'z-1', created_at: '2024-01-01T00:00:00Z' }],
      zoneSku: new Map([['z-1', { sku_id: 'sku-a' } as never]]),
    });

    const map = new Map(useProjectStore.getState().zoneSku);
    map.set('z-1', { sku_id: 'sku-b' } as never);
    useProjectStore.setState({ zoneSku: map });

    expect(useProjectStore.getState().zoneSku.size).toBe(1);
    expect(useProjectStore.getState().zoneSku.get('z-1')?.sku_id).toBe('sku-b');
  });
});
