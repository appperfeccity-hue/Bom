import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProjectStore } from '@/stores/projectStore';
import type { SkuMaster } from '@/types/database';

// Mock Supabase client
let mockDeleteShouldFail = false;

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl: () =>
          Promise.resolve({ data: { signedUrl: 'https://example.com/signed.png' }, error: null }),
      }),
    },
  },
  fromTable: () => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: null, error: null }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
      in: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
    insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    delete: () => ({
      eq: () => {
        if (mockDeleteShouldFail) {
          return Promise.resolve({ error: { message: 'DB error', code: '500' } });
        }
        return Promise.resolve({ error: null });
      },
    }),
    upsert: () => Promise.resolve({ error: null }),
  }),
}));

const mockSku: SkuMaster = {
  sku_id: 'sku-1',
  sku_code: 'WP-001',
  product_type: 'WALL_PANEL' as never,
  family_id: 'fam-1',
  category_id: 'cat-1',
  width_mm: 600,
  height_mm: 300,
  thickness_mm: 12,
  depth_mm: null,
  unit_length_mm: null,
  material: 'Wood',
  colour: 'Oak',
  finish: 'Matte',
  pattern_identity: null,
  gh_mm: 0,
  gv_mm: 0,
  quantity_mode: null,
  commercial_attributes: {},
  status: 'ACTIVE' as never,
  created_by: 'user-1',
  created_at: '',
  updated_at: '',
};

describe('projectStore.removeSku', () => {
  beforeEach(() => {
    mockDeleteShouldFail = false;
    useProjectStore.setState({
      currentProject: null,
      zones: [
        {
          id: 'zone-1',
          template_id: 'tmpl-1',
          name: 'Zone 1',
          x_mm: 0,
          y_mm: 0,
          width_mm: 500,
          height_mm: 400,
          width_strategy: 'FIXED' as never,
          height_strategy: 'FIXED' as never,
          position_strategy: 'ABSOLUTE' as never,
          z_index: 0,
          created_at: '',
          updated_at: '',
        },
      ],
      zoneSku: new Map([['zone-1', mockSku]]),
      error: null,
    });
  });

  it('removes the SKU mapping from state', async () => {
    expect(useProjectStore.getState().zoneSku.has('zone-1')).toBe(true);

    await useProjectStore.getState().removeSku('zone-1');

    expect(useProjectStore.getState().zoneSku.has('zone-1')).toBe(false);
  });

  it('does nothing when project is FINALIZED', async () => {
    useProjectStore.setState({
      currentProject: {
        id: 'proj-1',
        name: 'Test',
        template_id: 'tmpl-1',
        status: 'FINALIZED' as never,
        client_name: null,
        created_by: 'user-1',
        created_at: '',
        updated_at: '',
        version: 1,
      },
    });

    await useProjectStore.getState().removeSku('zone-1');

    // SKU should still be there
    expect(useProjectStore.getState().zoneSku.has('zone-1')).toBe(true);
  });

  it('handles removing SKU for a zone that has no SKU assigned', async () => {
    useProjectStore.setState({
      zoneSku: new Map(),
    });

    // Should not throw
    await useProjectStore.getState().removeSku('zone-1');
    expect(useProjectStore.getState().zoneSku.has('zone-1')).toBe(false);
  });

  it('rolls back on database error', async () => {
    mockDeleteShouldFail = true;

    await useProjectStore.getState().removeSku('zone-1');

    // Should rollback - SKU should be back
    expect(useProjectStore.getState().zoneSku.has('zone-1')).toBe(true);
    expect(useProjectStore.getState().error).toBe('DB error');
  });
});
