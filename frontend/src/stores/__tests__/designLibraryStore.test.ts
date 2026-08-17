import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDesignLibraryStore, groupByDesignFamily } from '../designLibraryStore';
import type { TemplateWithAvailability } from '../designLibraryStore';
import { TemplateStatus, AdaptationStrategy } from '@/types/database';
import type { Template } from '@/types/database';

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

const makeTemplateWithAvailability = (
  overrides: Partial<TemplateWithAvailability> = {},
): TemplateWithAvailability => ({
  ...makeTemplate(overrides),
  availability: 'AVAILABLE',
  blockedReasons: [],
  designFamilyName: null,
  ...overrides,
});

describe('designLibraryStore', () => {
  beforeEach(() => {
    useDesignLibraryStore.getState().reset();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have empty templates and default filters', () => {
      const state = useDesignLibraryStore.getState();
      expect(state.templates).toEqual([]);
      expect(state.filteredTemplates).toEqual([]);
      expect(state.designFamilies).toEqual([]);
      expect(state.filters).toEqual({
        search: '',
        designFamilyId: null,
        wallGeometry: null,
        availability: 'ALL',
      });
      expect(state.selectedTemplateDetail).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchTemplatesWithAvailability', () => {
    it('marks templates AVAILABLE when all SKUs are ACTIVE with READY catalogue', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const templates = [
        makeTemplate({ template_id: 'tpl-1', name: 'Available Template', design_family_id: 'fam-1' }),
      ];
      const families = [{ design_family_id: 'fam-1', name: 'Modern', created_by: 'u1', created_at: '2024-01-01' }];
      const zones = [{ zone_id: 'zone-1', template_id: 'tpl-1' }];
      const zoneSkus = [{ zone_id: 'zone-1', sku_id: 'sku-1' }];
      const skuMaster = [{ sku_id: 'sku-1', sku_code: 'SKU001', status: 'ACTIVE' }];
      const catalogueEntries = [{ sku_id: 'sku-1', status: 'READY' }];

      let callIndex = 0;
      mockedFromTable.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          // template query: select('*').eq('status', 'ACTIVE')
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: templates, error: null }),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 2) {
          // design_family_master query: select('*')
          return {
            select: vi.fn().mockResolvedValue({ data: families, error: null }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 3) {
          // template_zone query: select(...).in(...)
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: zones, error: null }),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 4) {
          // template_zone_sku query: select(...).in(...)
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: zoneSkus, error: null }),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 5) {
          // sku_master query: select(...).in(...)
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: skuMaster, error: null }),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 6) {
          // catalogue_entry query: select(...).in(...)
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: catalogueEntries, error: null }),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
        } as never;
      });

      await useDesignLibraryStore.getState().fetchTemplatesWithAvailability();

      const state = useDesignLibraryStore.getState();
      expect(state.templates).toHaveLength(1);
      expect(state.templates[0].availability).toBe('AVAILABLE');
      expect(state.templates[0].blockedReasons).toEqual([]);
      expect(state.templates[0].designFamilyName).toBe('Modern');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('marks templates BLOCKED when SKU is INACTIVE', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const templates = [makeTemplate({ template_id: 'tpl-1' })];
      const zones = [{ zone_id: 'zone-1', template_id: 'tpl-1' }];
      const zoneSkus = [{ zone_id: 'zone-1', sku_id: 'sku-1' }];
      const skuMaster = [{ sku_id: 'sku-1', sku_code: 'SKU001', status: 'INACTIVE' }];
      const catalogueEntries = [{ sku_id: 'sku-1', status: 'READY' }];

      let callIndex = 0;
      mockedFromTable.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: templates, error: null }),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 2) {
          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 3) {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: zones, error: null }),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 4) {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: zoneSkus, error: null }),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 5) {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: skuMaster, error: null }),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 6) {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: catalogueEntries, error: null }),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
        } as never;
      });

      await useDesignLibraryStore.getState().fetchTemplatesWithAvailability();

      const state = useDesignLibraryStore.getState();
      expect(state.templates).toHaveLength(1);
      expect(state.templates[0].availability).toBe('BLOCKED');
      expect(state.templates[0].blockedReasons).toContain('SKU SKU001 is INACTIVE');
    });

    it('marks templates BLOCKED when catalogue is not READY', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const templates = [makeTemplate({ template_id: 'tpl-1' })];
      const zones = [{ zone_id: 'zone-1', template_id: 'tpl-1' }];
      const zoneSkus = [{ zone_id: 'zone-1', sku_id: 'sku-1' }];
      const skuMaster = [{ sku_id: 'sku-1', sku_code: 'SKU001', status: 'ACTIVE' }];
      const catalogueEntries = [{ sku_id: 'sku-1', status: 'INCOMPLETE' }];

      let callIndex = 0;
      mockedFromTable.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: templates, error: null }),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 2) {
          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 3) {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: zones, error: null }),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 4) {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: zoneSkus, error: null }),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 5) {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: skuMaster, error: null }),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 6) {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: catalogueEntries, error: null }),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
        } as never;
      });

      await useDesignLibraryStore.getState().fetchTemplatesWithAvailability();

      const state = useDesignLibraryStore.getState();
      expect(state.templates).toHaveLength(1);
      expect(state.templates[0].availability).toBe('BLOCKED');
      expect(state.templates[0].blockedReasons).toContain('SKU SKU001 catalogue is INCOMPLETE');
    });

    it('marks templates AVAILABLE when they have no zones', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const templates = [makeTemplate({ template_id: 'tpl-1' })];

      let callIndex = 0;
      mockedFromTable.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: templates, error: null }),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 2) {
          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 3) {
          // No zones
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
        } as never;
      });

      await useDesignLibraryStore.getState().fetchTemplatesWithAvailability();

      const state = useDesignLibraryStore.getState();
      expect(state.templates).toHaveLength(1);
      expect(state.templates[0].availability).toBe('AVAILABLE');
      expect(state.templates[0].blockedReasons).toEqual([]);
    });

    it('sets error state when fetch fails', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      let callIndex = 0;
      mockedFromTable.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'Network error' } }),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 2) {
          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
        } as never;
      });

      await useDesignLibraryStore.getState().fetchTemplatesWithAvailability();

      const state = useDesignLibraryStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
      expect(state.templates).toEqual([]);
    });

    it('transitions isLoading correctly during fetch', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      let resolveTemplates: (val: unknown) => void = () => {};
      const pendingTemplates = new Promise((resolve) => {
        resolveTemplates = resolve;
      });

      let callIndex = 0;
      mockedFromTable.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue(pendingTemplates),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 2) {
          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
        } as never;
      });

      const promise = useDesignLibraryStore.getState().fetchTemplatesWithAvailability();
      expect(useDesignLibraryStore.getState().isLoading).toBe(true);

      resolveTemplates({ data: [], error: null });
      await promise;
      expect(useDesignLibraryStore.getState().isLoading).toBe(false);
    });

    it('handles empty template list gracefully', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      let callIndex = 0;
      mockedFromTable.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        if (callIndex === 2) {
          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as never;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
        } as never;
      });

      await useDesignLibraryStore.getState().fetchTemplatesWithAvailability();

      const state = useDesignLibraryStore.getState();
      expect(state.templates).toEqual([]);
      expect(state.filteredTemplates).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('filter actions', () => {
    const setupTemplates = () => {
      const templates: TemplateWithAvailability[] = [
        makeTemplateWithAvailability({
          template_id: 'tpl-1',
          name: 'Modern Panel',
          description: 'A sleek modern design',
          design_family_id: 'fam-1',
          designFamilyName: 'Modern',
          wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2400 },
          availability: 'AVAILABLE',
        }),
        makeTemplateWithAvailability({
          template_id: 'tpl-2',
          name: 'Classic Wall',
          description: 'Traditional classic style',
          design_family_id: 'fam-2',
          designFamilyName: 'Classic',
          wall_geometry: { type: 'L_CORNER', base_width_mm: 4000, base_height_mm: 2700 },
          availability: 'BLOCKED',
          blockedReasons: ['SKU SKU002 is INACTIVE'],
        }),
        makeTemplateWithAvailability({
          template_id: 'tpl-3',
          name: 'Modern Corner',
          description: 'Modern corner variant',
          design_family_id: 'fam-1',
          designFamilyName: 'Modern',
          wall_geometry: { type: 'L_CORNER', base_width_mm: 5000, base_height_mm: 2700 },
          availability: 'AVAILABLE',
        }),
      ];

      useDesignLibraryStore.setState({
        templates,
        filteredTemplates: templates,
      });
    };

    it('setSearchFilter filters by name (case-insensitive)', () => {
      setupTemplates();
      useDesignLibraryStore.getState().setSearchFilter('modern');

      const state = useDesignLibraryStore.getState();
      expect(state.filters.search).toBe('modern');
      expect(state.filteredTemplates).toHaveLength(2);
      expect(state.filteredTemplates.map((t) => t.template_id)).toEqual(['tpl-1', 'tpl-3']);
    });

    it('setSearchFilter filters by description (case-insensitive)', () => {
      setupTemplates();
      useDesignLibraryStore.getState().setSearchFilter('traditional');

      const state = useDesignLibraryStore.getState();
      expect(state.filteredTemplates).toHaveLength(1);
      expect(state.filteredTemplates[0].template_id).toBe('tpl-2');
    });

    it('setDesignFamilyFilter filters by design_family_id', () => {
      setupTemplates();
      useDesignLibraryStore.getState().setDesignFamilyFilter('fam-1');

      const state = useDesignLibraryStore.getState();
      expect(state.filters.designFamilyId).toBe('fam-1');
      expect(state.filteredTemplates).toHaveLength(2);
      expect(state.filteredTemplates.every((t) => t.design_family_id === 'fam-1')).toBe(true);
    });

    it('setDesignFamilyFilter with null shows all', () => {
      setupTemplates();
      useDesignLibraryStore.getState().setDesignFamilyFilter('fam-1');
      useDesignLibraryStore.getState().setDesignFamilyFilter(null);

      const state = useDesignLibraryStore.getState();
      expect(state.filteredTemplates).toHaveLength(3);
    });

    it('setWallGeometryFilter filters by wall_geometry.type', () => {
      setupTemplates();
      useDesignLibraryStore.getState().setWallGeometryFilter('L_CORNER');

      const state = useDesignLibraryStore.getState();
      expect(state.filters.wallGeometry).toBe('L_CORNER');
      expect(state.filteredTemplates).toHaveLength(2);
      expect(state.filteredTemplates.every((t) => t.wall_geometry.type === 'L_CORNER')).toBe(true);
    });

    it('setWallGeometryFilter with null shows all', () => {
      setupTemplates();
      useDesignLibraryStore.getState().setWallGeometryFilter('STRAIGHT');
      useDesignLibraryStore.getState().setWallGeometryFilter(null);

      const state = useDesignLibraryStore.getState();
      expect(state.filteredTemplates).toHaveLength(3);
    });

    it('setAvailabilityFilter filters by AVAILABLE', () => {
      setupTemplates();
      useDesignLibraryStore.getState().setAvailabilityFilter('AVAILABLE');

      const state = useDesignLibraryStore.getState();
      expect(state.filters.availability).toBe('AVAILABLE');
      expect(state.filteredTemplates).toHaveLength(2);
      expect(state.filteredTemplates.every((t) => t.availability === 'AVAILABLE')).toBe(true);
    });

    it('setAvailabilityFilter filters by BLOCKED', () => {
      setupTemplates();
      useDesignLibraryStore.getState().setAvailabilityFilter('BLOCKED');

      const state = useDesignLibraryStore.getState();
      expect(state.filteredTemplates).toHaveLength(1);
      expect(state.filteredTemplates[0].availability).toBe('BLOCKED');
    });

    it('setAvailabilityFilter with ALL shows all', () => {
      setupTemplates();
      useDesignLibraryStore.getState().setAvailabilityFilter('BLOCKED');
      useDesignLibraryStore.getState().setAvailabilityFilter('ALL');

      const state = useDesignLibraryStore.getState();
      expect(state.filteredTemplates).toHaveLength(3);
    });

    it('combined filters narrow results correctly', () => {
      setupTemplates();
      useDesignLibraryStore.getState().setWallGeometryFilter('L_CORNER');
      useDesignLibraryStore.getState().setAvailabilityFilter('AVAILABLE');

      const state = useDesignLibraryStore.getState();
      expect(state.filteredTemplates).toHaveLength(1);
      expect(state.filteredTemplates[0].template_id).toBe('tpl-3');
    });

    it('search with no matches returns empty array', () => {
      setupTemplates();
      useDesignLibraryStore.getState().setSearchFilter('nonexistent');

      const state = useDesignLibraryStore.getState();
      expect(state.filteredTemplates).toEqual([]);
    });
  });

  describe('selectTemplateForPreview / clearPreview', () => {
    it('selectTemplateForPreview sets selectedTemplateDetail', () => {
      const template = makeTemplateWithAvailability({ template_id: 'tpl-1' });
      useDesignLibraryStore.getState().selectTemplateForPreview(template);

      expect(useDesignLibraryStore.getState().selectedTemplateDetail).toEqual(template);
    });

    it('clearPreview sets selectedTemplateDetail to null', () => {
      const template = makeTemplateWithAvailability({ template_id: 'tpl-1' });
      useDesignLibraryStore.getState().selectTemplateForPreview(template);
      useDesignLibraryStore.getState().clearPreview();

      expect(useDesignLibraryStore.getState().selectedTemplateDetail).toBeNull();
    });
  });

  describe('groupByDesignFamily', () => {
    it('groups templates by designFamilyName', () => {
      const templates: TemplateWithAvailability[] = [
        makeTemplateWithAvailability({ template_id: 'tpl-1', designFamilyName: 'Modern' }),
        makeTemplateWithAvailability({ template_id: 'tpl-2', designFamilyName: 'Classic' }),
        makeTemplateWithAvailability({ template_id: 'tpl-3', designFamilyName: 'Modern' }),
      ];

      const grouped = groupByDesignFamily(templates);
      expect(grouped.size).toBe(2);
      expect(grouped.get('Modern')).toHaveLength(2);
      expect(grouped.get('Classic')).toHaveLength(1);
    });

    it('groups templates without family under Uncategorized', () => {
      const templates: TemplateWithAvailability[] = [
        makeTemplateWithAvailability({ template_id: 'tpl-1', designFamilyName: null }),
        makeTemplateWithAvailability({ template_id: 'tpl-2', designFamilyName: 'Modern' }),
      ];

      const grouped = groupByDesignFamily(templates);
      expect(grouped.size).toBe(2);
      expect(grouped.get('Uncategorized')).toHaveLength(1);
      expect(grouped.get('Modern')).toHaveLength(1);
    });

    it('returns empty map for empty input', () => {
      const grouped = groupByDesignFamily([]);
      expect(grouped.size).toBe(0);
    });

    it('handles all templates in same family', () => {
      const templates: TemplateWithAvailability[] = [
        makeTemplateWithAvailability({ template_id: 'tpl-1', designFamilyName: 'Modern' }),
        makeTemplateWithAvailability({ template_id: 'tpl-2', designFamilyName: 'Modern' }),
        makeTemplateWithAvailability({ template_id: 'tpl-3', designFamilyName: 'Modern' }),
      ];

      const grouped = groupByDesignFamily(templates);
      expect(grouped.size).toBe(1);
      expect(grouped.get('Modern')).toHaveLength(3);
    });
  });

  describe('reset', () => {
    it('returns to initial state', () => {
      const template = makeTemplateWithAvailability({ template_id: 'tpl-1' });
      useDesignLibraryStore.setState({
        templates: [template],
        filteredTemplates: [template],
        designFamilies: [{ design_family_id: 'fam-1', name: 'Modern', created_by: 'u1', created_at: '2024-01-01' }],
        filters: { search: 'test', designFamilyId: 'fam-1', wallGeometry: 'STRAIGHT', availability: 'AVAILABLE' },
        selectedTemplateDetail: template,
        isLoading: true,
        error: 'some error',
      });

      useDesignLibraryStore.getState().reset();

      const state = useDesignLibraryStore.getState();
      expect(state.templates).toEqual([]);
      expect(state.filteredTemplates).toEqual([]);
      expect(state.designFamilies).toEqual([]);
      expect(state.filters).toEqual({
        search: '',
        designFamilyId: null,
        wallGeometry: null,
        availability: 'ALL',
      });
      expect(state.selectedTemplateDetail).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
