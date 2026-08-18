import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePublishStore, PublishStep, canPublish } from '../publishStore';
import { useProjectStore } from '../projectStore';
import { useAuthStore } from '../authStore';
import { TemplateStatus, AdaptationStrategy, SkuStatus } from '@/types/database';
import type { Template, TemplateZone, SkuMaster } from '@/types/database';

// Mock the supabase module
vi.mock('@/lib/supabase', () => {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
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
  description: null,
  wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2700 },
  status: TemplateStatus.DRAFT,
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

const makeZone = (overrides: Partial<TemplateZone> = {}): TemplateZone => ({
  zone_id: 'zone-1',
  template_id: 'tpl-1',
  x_mm: 0,
  y_mm: 0,
  width_mm: 1000,
  height_mm: 1000,
  width_strategy: 'FIXED' as TemplateZone['width_strategy'],
  height_strategy: 'FIXED' as TemplateZone['height_strategy'],
  position_strategy: 'FIXED' as TemplateZone['position_strategy'],
  segment: null,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeSku = (overrides: Partial<SkuMaster> = {}): SkuMaster => ({
  sku_id: 'sku-1',
  sku_code: 'WP-001',
  product_type: 'WALL_PANEL' as SkuMaster['product_type'],
  family_id: 'fam-1',
  category_id: 'cat-1',
  width_mm: 600,
  height_mm: 2400,
  thickness_mm: 18,
  depth_mm: null,
  unit_length_mm: null,
  material: 'Oak',
  colour: 'Natural',
  finish: 'Matte',
  pattern_identity: null,
  gh_mm: 0,
  gv_mm: 0,
  quantity_mode: null,
  commercial_attributes: {},
  status: SkuStatus.ACTIVE,
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('publishStore', () => {
  beforeEach(() => {
    usePublishStore.setState({
      currentStep: PublishStep.IDLE,
      validationResults: [],
      generatedBom: null,
      generatedBomLines: [],
      isLoading: false,
      error: null,
    });
    useProjectStore.setState({
      currentTemplate: makeTemplate(),
      zones: [],
      zoneSku: new Map(),
    });
    useAuthStore.setState({
      user: { id: 'user-1' } as never,
      role: 'DESIGNER',
      isAuthenticated: true,
      isLoading: false,
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      usePublishStore.getState().reset();
      const state = usePublishStore.getState();
      expect(state.currentStep).toBe(PublishStep.IDLE);
      expect(state.validationResults).toEqual([]);
      expect(state.generatedBom).toBeNull();
      expect(state.generatedBomLines).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('canPublish selector', () => {
    it('returns true when currentStep is BOM_APPROVED', () => {
      usePublishStore.setState({ currentStep: PublishStep.BOM_APPROVED });
      expect(canPublish(usePublishStore.getState())).toBe(true);
    });

    it('returns false for other steps', () => {
      expect(canPublish(usePublishStore.getState())).toBe(false);
      usePublishStore.setState({ currentStep: PublishStep.VALIDATION_RESULTS });
      expect(canPublish(usePublishStore.getState())).toBe(false);
      usePublishStore.setState({ currentStep: PublishStep.BOM_GENERATED });
      expect(canPublish(usePublishStore.getState())).toBe(false);
      usePublishStore.setState({ currentStep: PublishStep.PUBLISHED });
      expect(canPublish(usePublishStore.getState())).toBe(false);
    });
  });

  describe('runValidation', () => {
    it('detects missing SKU assignments', async () => {
      const zone = makeZone({ zone_id: 'zone-1' });
      useProjectStore.setState({
        zones: [zone],
        zoneSku: new Map(),
      });

      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);
      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as unknown as ReturnType<typeof fromTable>);

      await usePublishStore.getState().runValidation('tpl-1');

      const state = usePublishStore.getState();
      expect(state.currentStep).toBe(PublishStep.VALIDATION_RESULTS);
      const skuGate = state.validationResults.find((r) => r.gate === 'Zone SKU Assignment');
      expect(skuGate?.passed).toBe(false);
      expect(skuGate?.message).toContain('1 zone(s) missing');
    });

    it('detects zone overlaps', async () => {
      const zone1 = makeZone({ zone_id: 'zone-1', x_mm: 0, y_mm: 0, width_mm: 500, height_mm: 500 });
      const zone2 = makeZone({ zone_id: 'zone-2', x_mm: 100, y_mm: 100, width_mm: 500, height_mm: 500 });
      const skuMap = new Map<string, SkuMaster>();
      skuMap.set('zone-1', makeSku({ sku_id: 'sku-1' }));
      skuMap.set('zone-2', makeSku({ sku_id: 'sku-2' }));

      useProjectStore.setState({
        zones: [zone1, zone2],
        zoneSku: skuMap,
      });

      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);
      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [
            { sku_id: 'sku-1', status: 'READY' },
            { sku_id: 'sku-2', status: 'READY' },
          ],
          error: null,
        }),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as unknown as ReturnType<typeof fromTable>);

      await usePublishStore.getState().runValidation('tpl-1');

      const state = usePublishStore.getState();
      const overlapGate = state.validationResults.find((r) => r.gate === 'Zone Overlaps');
      expect(overlapGate?.passed).toBe(false);
      expect(overlapGate?.message).toContain('overlap');
    });

    it('detects boundary violations', async () => {
      // Zone extends beyond wall (wall is 3000x2700, zone at 2800 with width 500 goes beyond)
      const zone = makeZone({
        zone_id: 'zone-1',
        x_mm: 2800,
        y_mm: 0,
        width_mm: 500,
        height_mm: 500,
      });
      const skuMap = new Map<string, SkuMaster>();
      skuMap.set('zone-1', makeSku({ sku_id: 'sku-1' }));

      useProjectStore.setState({
        zones: [zone],
        zoneSku: skuMap,
      });

      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);
      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ sku_id: 'sku-1', status: 'READY' }],
          error: null,
        }),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as unknown as ReturnType<typeof fromTable>);

      await usePublishStore.getState().runValidation('tpl-1');

      const state = usePublishStore.getState();
      const constraintGate = state.validationResults.find((r) => r.gate === 'Zone Constraints');
      expect(constraintGate?.passed).toBe(false);
      expect(constraintGate?.message).toContain('exceeds wall boundary');
    });

    it('detects missing metadata (empty template name)', async () => {
      useProjectStore.setState({
        currentTemplate: makeTemplate({ name: '' }),
        zones: [],
        zoneSku: new Map(),
      });

      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);
      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as unknown as ReturnType<typeof fromTable>);

      await usePublishStore.getState().runValidation('tpl-1');

      const state = usePublishStore.getState();
      const metadataGate = state.validationResults.find((r) => r.gate === 'Metadata Complete');
      expect(metadataGate?.passed).toBe(false);
      expect(metadataGate?.message).toContain('missing or empty');
    });

    it('passes when all gates pass', async () => {
      const zone = makeZone({
        zone_id: 'zone-1',
        x_mm: 0,
        y_mm: 0,
        width_mm: 1000,
        height_mm: 1000,
      });
      const skuMap = new Map<string, SkuMaster>();
      skuMap.set('zone-1', makeSku({ sku_id: 'sku-1' }));

      useProjectStore.setState({
        currentTemplate: makeTemplate({ name: 'Valid Template' }),
        zones: [zone],
        zoneSku: skuMap,
      });

      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);
      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ sku_id: 'sku-1', status: 'READY' }],
          error: null,
        }),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as unknown as ReturnType<typeof fromTable>);

      await usePublishStore.getState().runValidation('tpl-1');

      const state = usePublishStore.getState();
      expect(state.currentStep).toBe(PublishStep.VALIDATION_RESULTS);
      expect(state.validationResults.every((r) => r.passed)).toBe(true);
      expect(state.validationResults.length).toBe(5);
    });
  });

  describe('generateMasterBom', () => {
    it('calls RPC and sets BOM_GENERATED on success', async () => {
      const { supabase, fromTable } = await import('@/lib/supabase');
      const mockedRpc = vi.mocked(supabase.rpc);
      const mockedFromTable = vi.mocked(fromTable);

      const mockBom = {
        master_bom_id: 'bom-1',
        template_id: 'tpl-1',
        status: 'APPROVED',
        generated_at: '2024-01-01T00:00:00Z',
        engine_version: '1.0',
        rule_set_id: 'rs-1',
        approved_by: 'user-1',
        approved_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      };

      const mockLines = [
        {
          master_bom_line_id: 'line-1',
          master_bom_id: 'bom-1',
          template_component_id: 'zone-1',
          sku_id: 'sku-1',
          product_type: 'WALL_PANEL',
          source_zone_id: 'zone-1',
          quantity_rule: 'CALCULATED',
          default_quantity: 1,
          unit_of_measure: 'PIECE',
          mandatory: true,
          hidden: false,
          calculation_parameters: {},
          parent_bom_line_id: null,
        },
      ];

      // Mock the RPC call to return the new BOM ID
      mockedRpc.mockResolvedValue({ data: 'bom-1', error: null } as never);

      // Mock fromTable for fetching the BOM header and lines
      const mockSingle = vi.fn().mockResolvedValue({ data: mockBom, error: null });
      const mockEqBom = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEqLines = vi.fn().mockResolvedValue({ data: mockLines, error: null });

      let callCount = 0;
      mockedFromTable.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: fetch master_bom header
          return {
            select: vi.fn().mockReturnValue({ eq: mockEqBom }),
          } as unknown as ReturnType<typeof fromTable>;
        } else {
          // Second call: fetch master_bom_line rows
          return {
            select: vi.fn().mockReturnValue({ eq: mockEqLines }),
          } as unknown as ReturnType<typeof fromTable>;
        }
      });

      await usePublishStore.getState().generateMasterBom('tpl-1');

      expect(mockedRpc).toHaveBeenCalledWith('generate_master_bom', {
        p_template_id: 'tpl-1',
        p_user_id: 'user-1',
      });

      const state = usePublishStore.getState();
      expect(state.currentStep).toBe(PublishStep.BOM_GENERATED);
      expect(state.generatedBom).toEqual(mockBom);
      expect(state.generatedBomLines).toEqual(mockLines);
      expect(state.isLoading).toBe(false);
    });

    it('sets ERROR step on RPC failure', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockedRpc = vi.mocked(supabase.rpc);

      mockedRpc.mockResolvedValue({
        data: null,
        error: { message: 'Template must be in DRAFT status' },
      } as never);

      await usePublishStore.getState().generateMasterBom('tpl-1');

      const state = usePublishStore.getState();
      expect(state.currentStep).toBe(PublishStep.ERROR);
      expect(state.error).toBe('Template must be in DRAFT status');
    });

    it('sets ERROR step on BOM fetch failure', async () => {
      const { supabase, fromTable } = await import('@/lib/supabase');
      const mockedRpc = vi.mocked(supabase.rpc);
      const mockedFromTable = vi.mocked(fromTable);

      mockedRpc.mockResolvedValue({ data: 'bom-1', error: null } as never);

      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });
      const mockEqBom = vi.fn().mockReturnValue({ single: mockSingle });

      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEqBom }),
      } as unknown as ReturnType<typeof fromTable>);

      await usePublishStore.getState().generateMasterBom('tpl-1');

      const state = usePublishStore.getState();
      expect(state.currentStep).toBe(PublishStep.ERROR);
      expect(state.error).toBe('Not found');
    });
  });

  describe('approveMasterBom', () => {
    it('calls update and sets BOM_APPROVED on success', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: mockUpdate,
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as unknown as ReturnType<typeof fromTable>);

      await usePublishStore.getState().approveMasterBom('bom-1');

      expect(mockedFromTable).toHaveBeenCalledWith('master_bom');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'APPROVED',
          approved_by: 'user-1',
        }),
      );
      expect(mockEq).toHaveBeenCalledWith('master_bom_id', 'bom-1');

      const state = usePublishStore.getState();
      expect(state.currentStep).toBe(PublishStep.BOM_APPROVED);
      expect(state.isLoading).toBe(false);
    });

    it('sets ERROR step on failure', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockEq = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Permission denied' },
      });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: mockUpdate,
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as unknown as ReturnType<typeof fromTable>);

      await usePublishStore.getState().approveMasterBom('bom-1');

      const state = usePublishStore.getState();
      expect(state.currentStep).toBe(PublishStep.ERROR);
      expect(state.error).toBe(
        'You do not have permission to approve this BOM. Only authorized roles can approve.',
      );
    });

    it('passes through non-permission errors unchanged', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockEq = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Network timeout' },
      });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: mockUpdate,
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as unknown as ReturnType<typeof fromTable>);

      await usePublishStore.getState().approveMasterBom('bom-1');

      const state = usePublishStore.getState();
      expect(state.currentStep).toBe(PublishStep.ERROR);
      expect(state.error).toBe('Network timeout');
    });
  });

  describe('publishTemplate', () => {
    it('updates template and sets PUBLISHED on success', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockedRpc = vi.mocked(supabase.rpc);
      mockedRpc.mockResolvedValue({ data: 'tpl-1', error: null } as never);

      await usePublishStore.getState().publishTemplate('tpl-1');

      expect(mockedRpc).toHaveBeenCalledWith('publish_template', {
        p_template_id: 'tpl-1',
        p_user_id: 'user-1',
      });

      const state = usePublishStore.getState();
      expect(state.currentStep).toBe(PublishStep.PUBLISHED);
      expect(state.isLoading).toBe(false);
    });

    it('syncs projectStore.currentTemplate.status to ACTIVE after success', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockedRpc = vi.mocked(supabase.rpc);
      mockedRpc.mockResolvedValue({ data: 'tpl-1', error: null } as never);

      // Verify initial state is DRAFT
      expect(useProjectStore.getState().currentTemplate?.status).toBe(TemplateStatus.DRAFT);

      await usePublishStore.getState().publishTemplate('tpl-1');

      // After publish, projectStore.currentTemplate.status should be ACTIVE
      expect(useProjectStore.getState().currentTemplate?.status).toBe('ACTIVE');
    });

    it('handles DB trigger error gracefully', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockedRpc = vi.mocked(supabase.rpc);
      mockedRpc.mockResolvedValue({
        data: null,
        error: { message: 'Template cannot be published: no approved BOM' },
      } as never);

      await usePublishStore.getState().publishTemplate('tpl-1');

      const state = usePublishStore.getState();
      expect(state.currentStep).toBe(PublishStep.ERROR);
      expect(state.error).toBe('Template cannot be published: no approved BOM');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('rerunValidation', () => {
    it('resets BOM state and re-runs validation', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);
      mockedFromTable.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as unknown as ReturnType<typeof fromTable>);

      // Set up state as if BOM was already generated
      usePublishStore.setState({
        currentStep: PublishStep.BOM_GENERATED,
        generatedBom: {
          master_bom_id: 'bom-1',
          template_id: 'tpl-1',
          status: 'GENERATED' as never,
          generated_at: '2024-01-01T00:00:00Z',
          engine_version: '1.0',
          rule_set_id: 'default',
          approved_by: null,
          approved_at: null,
          created_at: '2024-01-01T00:00:00Z',
        },
        generatedBomLines: [],
      });

      useProjectStore.setState({
        currentTemplate: makeTemplate({ name: 'Valid Template' }),
        zones: [],
        zoneSku: new Map(),
      });

      await usePublishStore.getState().rerunValidation('tpl-1');

      const state = usePublishStore.getState();
      expect(state.currentStep).toBe(PublishStep.VALIDATION_RESULTS);
      expect(state.generatedBom).toBeNull();
      expect(state.generatedBomLines).toEqual([]);
      expect(state.validationResults.length).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('returns state to initial', () => {
      usePublishStore.setState({
        currentStep: PublishStep.PUBLISHED,
        validationResults: [{ gate: 'Test', passed: true, message: 'ok' }],
        generatedBom: {
          master_bom_id: 'bom-1',
          template_id: 'tpl-1',
          status: 'GENERATED' as never,
          generated_at: '2024-01-01T00:00:00Z',
          engine_version: '1.0',
          rule_set_id: 'default',
          approved_by: null,
          approved_at: null,
          created_at: '2024-01-01T00:00:00Z',
        },
        generatedBomLines: [],
        isLoading: true,
        error: 'some error',
      });

      usePublishStore.getState().reset();
      const state = usePublishStore.getState();
      expect(state.currentStep).toBe(PublishStep.IDLE);
      expect(state.validationResults).toEqual([]);
      expect(state.generatedBom).toBeNull();
      expect(state.generatedBomLines).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
