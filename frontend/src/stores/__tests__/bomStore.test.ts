import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBomStore } from '../bomStore';
import {
  MasterBomStatus,
  ProductType,
  ReconciliationResultType,
} from '@/types/database';
import type { MasterBomLine, ActualBomLine } from '@/types/database';
import type { PipelineError } from '@/engines/errorCatalogue';
import { ErrorCode, ErrorSeverity, ErrorCategory } from '@/engines/errorCatalogue';

// Mock the bomPipeline module
vi.mock('@/engines/bomPipeline', () => ({
  runBomPipeline: vi.fn(),
}));

// Mock the supabase module
vi.mock('@/lib/supabase', () => {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    fromTable: vi.fn(() => ({ ...mockQueryBuilder })),
    supabase: {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    isSupabaseConfigured: false,
  };
});

// Mock authStore
vi.mock('@/stores/authStore', async () => {
  const { create } = await import('zustand');
  const useAuthStore = create(() => ({
    user: { id: 'user-1' } as never,
    role: 'CONSULTANT',
    isAuthenticated: true,
    isLoading: false,
  }));
  return { useAuthStore };
});

// Mock inputHash
vi.mock('@/lib/inputHash', () => ({
  computeInputHash: vi.fn().mockResolvedValue('a'.repeat(64)),
}));

describe('bomStore', () => {
  beforeEach(() => {
    useBomStore.setState({
      masterBom: null,
      masterBomLines: [],
      actualBom: null,
      actualBomLines: [],
      finalBom: null,
      finalBomLines: [],
      reconciliation: [],
      isMasterBomLoading: false,
      isActualBomLoading: false,
      isFinalBomLoading: false,
      isLoading: false,
      error: null,
      isBomPanelOpen: false,
      pipelineStatus: 'idle',
      pipelineErrors: [],
      pipelineWarnings: [],
      pipelineProgress: null,
      pipelineOutputLines: [],
      isSaving: false,
      saveError: null,
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useBomStore.getState();
      expect(state.masterBom).toBeNull();
      expect(state.masterBomLines).toEqual([]);
      expect(state.actualBom).toBeNull();
      expect(state.actualBomLines).toEqual([]);
      expect(state.finalBom).toBeNull();
      expect(state.finalBomLines).toEqual([]);
      expect(state.reconciliation).toEqual([]);
      expect(state.isMasterBomLoading).toBe(false);
      expect(state.isActualBomLoading).toBe(false);
      expect(state.isFinalBomLoading).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.isBomPanelOpen).toBe(false);
    });
  });

  describe('openBomPanel / closeBomPanel', () => {
    it('should open the BOM panel', () => {
      useBomStore.getState().openBomPanel();
      expect(useBomStore.getState().isBomPanelOpen).toBe(true);
    });

    it('should close the BOM panel', () => {
      useBomStore.getState().openBomPanel();
      useBomStore.getState().closeBomPanel();
      expect(useBomStore.getState().isBomPanelOpen).toBe(false);
    });
  });

  describe('resetBom', () => {
    it('should reset all state to initial values', () => {
      useBomStore.setState({
        masterBom: {
          master_bom_id: 'bom-1',
          template_id: 'tpl-1',
          status: MasterBomStatus.APPROVED,
          generated_at: '2024-01-01T00:00:00Z',
          engine_version: '1.0',
          rule_set_id: 'rs-1',
          approved_by: 'user-1',
          approved_at: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
        },
        isBomPanelOpen: true,
        isLoading: true,
        error: 'some error',
      });

      useBomStore.getState().resetBom();
      const state = useBomStore.getState();
      expect(state.masterBom).toBeNull();
      expect(state.isBomPanelOpen).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchMasterBom', () => {
    it('should set isLoading during fetch and call fromTable with correct params', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useBomStore.getState().fetchMasterBom('tpl-123');

      expect(mockedFromTable).toHaveBeenCalledWith('master_bom');
      expect(mockChain.eq).toHaveBeenCalledWith('template_id', 'tpl-123');
      expect(mockChain.eq).toHaveBeenCalledWith('status', 'APPROVED');
      expect(useBomStore.getState().isLoading).toBe(false);
    });

    it('should set error on failure', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Network error' },
        }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useBomStore.getState().fetchMasterBom('tpl-123');
      expect(useBomStore.getState().error).toBe('Network error');
      expect(useBomStore.getState().isLoading).toBe(false);
    });

    it('should set masterBom and lines on success', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockBom = {
        master_bom_id: 'bom-1',
        template_id: 'tpl-123',
        status: 'APPROVED',
        generated_at: '2024-01-01T00:00:00Z',
        engine_version: '1.0',
        rule_set_id: 'rs-1',
        approved_by: null,
        approved_at: null,
        created_at: '2024-01-01T00:00:00Z',
      };

      const mockLines = [
        {
          master_bom_line_id: 'line-1',
          master_bom_id: 'bom-1',
          template_component_id: 'tc-1',
          sku_id: 'sku-1',
          product_type: 'WALL_PANEL',
          source_zone_id: null,
          source_relationship_id: null,
          quantity_rule: 'FIXED',
          default_quantity: 2,
          unit_of_measure: 'PCS',
          mandatory: true,
          hidden: false,
          calculation_parameters: {},
          parent_bom_line_id: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      let callCount = 0;
      mockedFromTable.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // master_bom query
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockBom, error: null }),
          } as unknown as ReturnType<typeof fromTable>;
        }
        // master_bom_line query
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockLines, error: null }),
          single: vi.fn().mockResolvedValue({ data: mockLines, error: null }),
        } as unknown as ReturnType<typeof fromTable>;
      });

      await useBomStore.getState().fetchMasterBom('tpl-123');
      expect(useBomStore.getState().masterBom).toEqual(mockBom);
      expect(useBomStore.getState().masterBomLines).toEqual(mockLines);
      expect(useBomStore.getState().isLoading).toBe(false);
    });
  });

  describe('fetchActualBom', () => {
    it('should call fromTable with correct params', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useBomStore.getState().fetchActualBom('proj-456');

      expect(mockedFromTable).toHaveBeenCalledWith('actual_bom');
      expect(mockChain.eq).toHaveBeenCalledWith('project_id', 'proj-456');
      expect(mockChain.neq).toHaveBeenCalledWith('status', 'SUPERSEDED');
      expect(useBomStore.getState().isLoading).toBe(false);
    });

    it('should set error on failure', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'DB connection failed' },
        }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useBomStore.getState().fetchActualBom('proj-456');
      expect(useBomStore.getState().error).toBe('DB connection failed');
    });

    it('should treat a no-rows result as an empty BOM, not an error', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: {
            code: 'PGRST116',
            message: 'Cannot coerce the result to a single JSON object',
          },
        }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useBomStore.getState().fetchActualBom('proj-456');

      expect(useBomStore.getState().error).toBeNull();
      expect(useBomStore.getState().actualBom).toBeNull();
      expect(useBomStore.getState().actualBomLines).toEqual([]);
    });
  });

  describe('fetchFinalBom', () => {
    it('should call fromTable with correct params', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useBomStore.getState().fetchFinalBom('proj-789');

      expect(mockedFromTable).toHaveBeenCalledWith('final_bom');
      expect(mockChain.eq).toHaveBeenCalledWith('project_id', 'proj-789');
      expect(useBomStore.getState().isLoading).toBe(false);
    });

    it('should set error on failure', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Permission denied' },
        }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useBomStore.getState().fetchFinalBom('proj-789');
      expect(useBomStore.getState().error).toBe('Permission denied');
    });
  });

  describe('computeReconciliation', () => {
    const makeMasterLine = (overrides: Partial<MasterBomLine> = {}): MasterBomLine => ({
      master_bom_line_id: 'ml-1',
      master_bom_id: 'bom-1',
      template_component_id: 'tc-1',
      sku_id: 'sku-1',
      product_type: ProductType.WALL_PANEL,
      source_zone_id: null,
      source_relationship_id: null,
      quantity_rule: 'FIXED',
      default_quantity: 5,
      unit_of_measure: 'PCS',
      mandatory: true,
      hidden: false,
      calculation_parameters: {},
      parent_bom_line_id: null,
      created_at: '2024-01-01T00:00:00Z',
      ...overrides,
    });

    const makeActualLine = (overrides: Partial<ActualBomLine> = {}): ActualBomLine => ({
      actual_bom_line_id: 'al-1',
      actual_bom_id: 'abom-1',
      master_bom_line_id: 'ml-1',
      component_id: 'comp-1',
      sku_id: 'sku-1',
      product_type: ProductType.WALL_PANEL,
      quantity: 5,
      required_quantity: 5,
      waste_factor: 0.1,
      waste_quantity: 1,
      unit_of_measure: 'PCS',
      resolved_dimensions: {},
      calculation_rule: 'FIXED',
      calculation_inputs: {},
      ...overrides,
    });

    it('should classify UNCHANGED when master and actual match', () => {
      useBomStore.setState({
        masterBomLines: [makeMasterLine()],
        actualBomLines: [makeActualLine()],
      });

      useBomStore.getState().computeReconciliation();
      const rec = useBomStore.getState().reconciliation;
      expect(rec).toHaveLength(1);
      expect(rec[0].result_type).toBe(ReconciliationResultType.UNCHANGED);
    });

    it('should classify QUANTITY_CHANGED when quantity differs', () => {
      useBomStore.setState({
        masterBomLines: [makeMasterLine({ default_quantity: 5 })],
        actualBomLines: [makeActualLine({ quantity: 8 })],
      });

      useBomStore.getState().computeReconciliation();
      const rec = useBomStore.getState().reconciliation;
      expect(rec).toHaveLength(1);
      expect(rec[0].result_type).toBe(ReconciliationResultType.QUANTITY_CHANGED);
    });

    it('should classify UNCHANGED when quantity difference is within tolerance', () => {
      useBomStore.setState({
        masterBomLines: [makeMasterLine({ default_quantity: 5 })],
        actualBomLines: [makeActualLine({ quantity: 5.0000001 })],
      });

      useBomStore.getState().computeReconciliation();
      const rec = useBomStore.getState().reconciliation;
      expect(rec).toHaveLength(1);
      expect(rec[0].result_type).toBe(ReconciliationResultType.UNCHANGED);
    });

    it('should classify SKU_CHANGED when sku_id differs', () => {
      useBomStore.setState({
        masterBomLines: [makeMasterLine({ sku_id: 'sku-1' })],
        actualBomLines: [makeActualLine({ sku_id: 'sku-different' })],
      });

      useBomStore.getState().computeReconciliation();
      const rec = useBomStore.getState().reconciliation;
      expect(rec).toHaveLength(1);
      expect(rec[0].result_type).toBe(ReconciliationResultType.SKU_CHANGED);
    });

    it('should classify REMOVED when master line has no actual counterpart', () => {
      useBomStore.setState({
        masterBomLines: [makeMasterLine()],
        actualBomLines: [],
      });

      useBomStore.getState().computeReconciliation();
      const rec = useBomStore.getState().reconciliation;
      expect(rec).toHaveLength(1);
      expect(rec[0].result_type).toBe(ReconciliationResultType.REMOVED);
      expect(rec[0].actual_line).toBeNull();
    });

    it('should classify ADDED_BY_TRIGGER for actual lines with no master_bom_line_id', () => {
      useBomStore.setState({
        masterBomLines: [],
        actualBomLines: [makeActualLine({ master_bom_line_id: null })],
      });

      useBomStore.getState().computeReconciliation();
      const rec = useBomStore.getState().reconciliation;
      expect(rec).toHaveLength(1);
      expect(rec[0].result_type).toBe(ReconciliationResultType.ADDED_BY_TRIGGER);
      expect(rec[0].master_line).toBeNull();
    });

    it('should classify UNEXPECTED for actual lines with master_bom_line_id not in master', () => {
      useBomStore.setState({
        masterBomLines: [],
        actualBomLines: [makeActualLine({ master_bom_line_id: 'ml-unknown' })],
      });

      useBomStore.getState().computeReconciliation();
      const rec = useBomStore.getState().reconciliation;
      expect(rec).toHaveLength(1);
      expect(rec[0].result_type).toBe(ReconciliationResultType.UNEXPECTED);
      expect(rec[0].master_line).toBeNull();
    });

    it('should handle mixed reconciliation results', () => {
      useBomStore.setState({
        masterBomLines: [
          makeMasterLine({ master_bom_line_id: 'ml-1', sku_id: 'sku-1', default_quantity: 5 }),
          makeMasterLine({ master_bom_line_id: 'ml-2', sku_id: 'sku-2', default_quantity: 3 }),
          makeMasterLine({ master_bom_line_id: 'ml-3', sku_id: 'sku-3', default_quantity: 1 }),
        ],
        actualBomLines: [
          makeActualLine({ master_bom_line_id: 'ml-1', sku_id: 'sku-1', quantity: 5 }),
          makeActualLine({ master_bom_line_id: 'ml-2', sku_id: 'sku-2', quantity: 7 }),
          makeActualLine({ master_bom_line_id: null, actual_bom_line_id: 'al-trigger', sku_id: 'sku-trigger' }),
        ],
      });

      useBomStore.getState().computeReconciliation();
      const rec = useBomStore.getState().reconciliation;
      expect(rec).toHaveLength(4);
      expect(rec[0].result_type).toBe(ReconciliationResultType.UNCHANGED);
      expect(rec[1].result_type).toBe(ReconciliationResultType.QUANTITY_CHANGED);
      expect(rec[2].result_type).toBe(ReconciliationResultType.REMOVED);
      expect(rec[3].result_type).toBe(ReconciliationResultType.ADDED_BY_TRIGGER);
    });
  });

  describe('generateActualBom', () => {
    it('should return partial results and collect errors when one engine fails', () => {
      const result = useBomStore.getState().generateActualBom({
        wallPanels: [
          // Valid input
          { W: 2400, H: 1200, w: 1200, h: 1200, gh: 0, gv: 0, wasteFactor: 0 },
          // Invalid input: zero panel width causes EngineError
          { W: 2400, H: 1200, w: 0, h: 1200, gh: 0, gv: 0, wasteFactor: 0 },
        ],
        lights: [],
        furniture: [],
        hiddenComponents: [],
      });

      // First wall panel should succeed
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].productType).toBe('WALL_PANEL');
      expect(result.lines[0].quantity).toBe(2);

      // Second wall panel should produce an error
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].productType).toBe('WALL_PANEL');
      expect(result.errors[0].index).toBe(1);
      expect(result.errors[0].message).toContain('Panel size must be positive');
    });

    it('should return all lines and empty errors when all engines succeed', () => {
      const result = useBomStore.getState().generateActualBom({
        wallPanels: [
          { W: 2400, H: 1200, w: 1200, h: 1200, gh: 0, gv: 0, wasteFactor: 0 },
        ],
        lights: [
          { edges: [{ length: 2000 }], mountingType: 'DIRECT', mode: 'LINEAR', unitLength: 600 },
        ],
        furniture: [
          { quantity: 3, min: 1, max: 10, skuId: 'sku-1' },
        ],
        hiddenComponents: [
          { triggerType: 'ALWAYS', quantityRule: 'FIXED', fixedValue: 2 },
        ],
      });

      expect(result.lines).toHaveLength(4);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect errors from multiple engines without aborting', () => {
      const result = useBomStore.getState().generateActualBom({
        wallPanels: [
          // Invalid: zero panel width
          { W: 2400, H: 1200, w: 0, h: 1200, gh: 0, gv: 0, wasteFactor: 0 },
        ],
        lights: [
          // Invalid: zero unitLength in DISCRETE mode
          { edges: [{ length: 1000 }], mountingType: 'DIRECT', mode: 'DISCRETE', unitLength: 0 },
        ],
        furniture: [
          // Invalid: quantity below min
          { quantity: 1, min: 5, max: 10, skuId: 'sku-1' },
        ],
        hiddenComponents: [
          // Valid
          { triggerType: 'ALWAYS', quantityRule: 'FIXED', fixedValue: 4 },
        ],
      });

      // Only the hidden component should succeed
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].productType).toBe('HIDDEN_COMPONENT');

      // Three errors collected
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0].productType).toBe('WALL_PANEL');
      expect(result.errors[1].productType).toBe('LIGHT');
      expect(result.errors[2].productType).toBe('FURNITURE');
    });
  });

  describe('runPipeline', () => {
    it('should set pipelineStatus to running at start', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      let callCount = 0;
      mockedFromTable.mockImplementation(() => {
        callCount++;
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { snapshot_data: { zones: [] } },
            error: null,
          }),
        };
        if (callCount === 4) {
          // project_obstruction returns array, not single
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          } as unknown as ReturnType<typeof fromTable>;
        }
        return chain as unknown as ReturnType<typeof fromTable>;
      });

      const { runBomPipeline } = await import('@/engines/bomPipeline');
      vi.mocked(runBomPipeline).mockReturnValue({
        actualBomLines: [],
        errors: [],
        warnings: [],
        status: 'SUCCESS',
      });

      const promise = useBomStore.getState().runPipeline('proj-1', 'snap-1');
      expect(useBomStore.getState().pipelineStatus).toBe('running');
      await promise;
    });

    it('should set pipelineStatus to success when pipeline returns SUCCESS', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      let callCount = 0;
      mockedFromTable.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // project_snapshot
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { snapshot_data: { zones: [], base_dimensions: { width_mm: 3000, height_mm: 2400 } } },
              error: null,
            }),
          } as unknown as ReturnType<typeof fromTable>;
        } else if (callCount === 2) {
          // project_measurement
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { wall_width_mm: 3000, wall_height_mm: 2400 },
              error: null,
            }),
          } as unknown as ReturnType<typeof fromTable>;
        } else if (callCount === 3) {
          // project_configuration
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as unknown as ReturnType<typeof fromTable>;
        } else {
          // project_obstruction
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          } as unknown as ReturnType<typeof fromTable>;
        }
      });

      const { runBomPipeline } = await import('@/engines/bomPipeline');
      vi.mocked(runBomPipeline).mockReturnValue({
        actualBomLines: [{ lineId: 'l1', componentId: 'c1', skuId: 's1', quantity: 5, requiredQuantity: 5, wasteQuantity: 0, unitOfMeasure: 'PCS', calculationRule: 'FIXED', productType: 'WALL_PANEL' }],
        errors: [],
        warnings: [],
        status: 'SUCCESS',
      });

      await useBomStore.getState().runPipeline('proj-1', 'snap-1');

      const state = useBomStore.getState();
      expect(state.pipelineStatus).toBe('success');
      expect(state.pipelineErrors).toEqual([]);
      expect(state.pipelineWarnings).toEqual([]);
      expect(state.pipelineOutputLines).toHaveLength(1);
      expect(state.pipelineProgress).toBeNull();
    });

    it('should set pipelineStatus to blocked when pipeline returns BLOCKED', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      let callCount = 0;
      mockedFromTable.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { snapshot_data: { zones: [], base_dimensions: { width_mm: 3000, height_mm: 2400 } } },
              error: null,
            }),
          } as unknown as ReturnType<typeof fromTable>;
        } else if (callCount === 2) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { wall_width_mm: 3000, wall_height_mm: 2400 },
              error: null,
            }),
          } as unknown as ReturnType<typeof fromTable>;
        } else if (callCount === 3) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as unknown as ReturnType<typeof fromTable>;
        } else {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          } as unknown as ReturnType<typeof fromTable>;
        }
      });

      const blockedError: PipelineError = {
        code: ErrorCode.GEO_ZONE_OVERLAP,
        severity: ErrorSeverity.BLOCKING,
        category: ErrorCategory.GEOMETRY,
        message: 'Zones overlap each other',
      };

      const { runBomPipeline } = await import('@/engines/bomPipeline');
      vi.mocked(runBomPipeline).mockReturnValue({
        actualBomLines: [],
        errors: [blockedError],
        warnings: [],
        status: 'BLOCKED',
      });

      await useBomStore.getState().runPipeline('proj-1', 'snap-1');

      const state = useBomStore.getState();
      expect(state.pipelineStatus).toBe('blocked');
      expect(state.pipelineErrors).toHaveLength(1);
      expect(state.pipelineErrors[0].code).toBe(ErrorCode.GEO_ZONE_OVERLAP);
    });

    it('should set pipelineStatus to blocked on fetch error', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Snapshot not found' } }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useBomStore.getState().runPipeline('proj-1', 'snap-1');

      const state = useBomStore.getState();
      expect(state.pipelineStatus).toBe('blocked');
      expect(state.error).toBe('Snapshot not found');
      expect(state.pipelineErrors).toHaveLength(1);
      expect(state.pipelineErrors[0].message).toContain('Snapshot not found');
    });

    it('should store warnings from pipeline output', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      let callCount = 0;
      mockedFromTable.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { snapshot_data: { zones: [], base_dimensions: { width_mm: 3000, height_mm: 2400 } } },
              error: null,
            }),
          } as unknown as ReturnType<typeof fromTable>;
        } else if (callCount === 2) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { wall_width_mm: 3000, wall_height_mm: 2400 },
              error: null,
            }),
          } as unknown as ReturnType<typeof fromTable>;
        } else if (callCount === 3) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as unknown as ReturnType<typeof fromTable>;
        } else {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          } as unknown as ReturnType<typeof fromTable>;
        }
      });

      const warning: PipelineError = {
        code: ErrorCode.GEO_GAP_TOO_SMALL,
        severity: ErrorSeverity.WARNING,
        category: ErrorCategory.GEOMETRY,
        message: 'Gap is too small',
      };

      const { runBomPipeline } = await import('@/engines/bomPipeline');
      vi.mocked(runBomPipeline).mockReturnValue({
        actualBomLines: [],
        errors: [],
        warnings: [warning],
        status: 'SUCCESS',
      });

      await useBomStore.getState().runPipeline('proj-1', 'snap-1');

      const state = useBomStore.getState();
      expect(state.pipelineStatus).toBe('success');
      expect(state.pipelineWarnings).toHaveLength(1);
      expect(state.pipelineWarnings[0].code).toBe(ErrorCode.GEO_GAP_TOO_SMALL);
    });

    it('should not query permission_rule or compatibility_rule tables', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      let callCount = 0;
      const calledTables: string[] = [];
      mockedFromTable.mockImplementation((table: string) => {
        calledTables.push(table);
        callCount++;
        if (callCount <= 2) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: callCount === 1
                ? { snapshot_data: { zones: [], base_dimensions: { width_mm: 3000, height_mm: 2400 } } }
                : { wall_width_mm: 3000, wall_height_mm: 2400 },
              error: null,
            }),
          } as unknown as ReturnType<typeof fromTable>;
        } else if (callCount === 3) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as unknown as ReturnType<typeof fromTable>;
        } else {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          } as unknown as ReturnType<typeof fromTable>;
        }
      });

      const { runBomPipeline } = await import('@/engines/bomPipeline');
      vi.mocked(runBomPipeline).mockReturnValue({
        actualBomLines: [],
        errors: [],
        warnings: [],
        status: 'SUCCESS',
      });

      await useBomStore.getState().runPipeline('proj-1', 'snap-1');

      // Verify no queries to non-existent tables
      expect(calledTables).not.toContain('permission_rule');
      expect(calledTables).not.toContain('compatibility_rule');
      // Verify correct tables are queried
      expect(calledTables).toContain('project_snapshot');
      expect(calledTables).toContain('project_measurement');
      expect(calledTables).toContain('project_configuration');
      expect(calledTables).toContain('project_obstruction');
    });
  });

  describe('resetPipeline', () => {
    it('should reset all pipeline state to initial values', () => {
      useBomStore.setState({
        pipelineStatus: 'success',
        pipelineErrors: [{
          code: ErrorCode.GEO_ZONE_OVERLAP,
          severity: ErrorSeverity.BLOCKING,
          category: ErrorCategory.GEOMETRY,
          message: 'test',
        }],
        pipelineWarnings: [{
          code: ErrorCode.GEO_GAP_TOO_SMALL,
          severity: ErrorSeverity.WARNING,
          category: ErrorCategory.GEOMETRY,
          message: 'test warning',
        }],
        pipelineProgress: 'Running pipeline',
        pipelineOutputLines: [{ lineId: 'l1', componentId: 'c1', skuId: 's1', quantity: 5, requiredQuantity: 5, wasteQuantity: 0, unitOfMeasure: 'PCS', calculationRule: 'FIXED', productType: 'WALL_PANEL' }],
      });

      useBomStore.getState().resetPipeline();

      const state = useBomStore.getState();
      expect(state.pipelineStatus).toBe('idle');
      expect(state.pipelineErrors).toEqual([]);
      expect(state.pipelineWarnings).toEqual([]);
      expect(state.pipelineProgress).toBeNull();
      expect(state.pipelineOutputLines).toEqual([]);
    });

    it('should not affect other store state', () => {
      useBomStore.setState({
        pipelineStatus: 'success',
        isBomPanelOpen: true,
        error: 'some error',
      });

      useBomStore.getState().resetPipeline();

      const state = useBomStore.getState();
      expect(state.pipelineStatus).toBe('idle');
      expect(state.isBomPanelOpen).toBe(true);
      expect(state.error).toBe('some error');
    });
  });

  describe('saveBomToServer', () => {
    beforeEach(async () => {
      // Reset auth store mock
      const { useAuthStore } = await import('../authStore');
      useAuthStore.setState({
        user: { id: 'user-1' } as never,
        role: 'CONSULTANT',
        isAuthenticated: true,
        isLoading: false,
      });
    });

    it('should call save_actual_bom RPC with correct arguments', async () => {
      const { useAuthStore } = await import('../authStore');
      useAuthStore.setState({
        user: { id: 'user-1' } as never,
        role: 'CONSULTANT',
        isAuthenticated: true,
        isLoading: false,
      });

      // Set pipeline to success with output lines
      useBomStore.setState({
        pipelineStatus: 'success',
        pipelineOutputLines: [
          {
            lineId: 'l1',
            componentId: 'comp-1',
            skuId: 'sku-1',
            quantity: 5,
            requiredQuantity: 5,
            wasteQuantity: 0,
            unitOfMeasure: 'PCS',
            calculationRule: 'FIXED',
            productType: 'WALL_PANEL',
          },
        ],
      });

      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);
      const { supabase } = await import('@/lib/supabase');
      const mockedRpc = vi.fn().mockResolvedValue({ data: 'new-bom-id', error: null });
      (supabase as unknown as { rpc: typeof mockedRpc }).rpc = mockedRpc;

      let callCount = 0;
      mockedFromTable.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // project_configuration query
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ configuration_data: { wallColor: 'white' } }],
              error: null,
            }),
          } as unknown as ReturnType<typeof fromTable>;
        } else if (callCount === 2) {
          // project_measurement query
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { wall_width_mm: 3000, wall_height_mm: 2400 },
              error: null,
            }),
          } as unknown as ReturnType<typeof fromTable>;
        } else {
          // fetchActualBom query chain
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as unknown as ReturnType<typeof fromTable>;
        }
      });

      const result = await useBomStore.getState().saveBomToServer('proj-1', 'snap-hash-123');

      expect(result).toBe('new-bom-id');
      expect(mockedRpc).toHaveBeenCalledWith('save_actual_bom', expect.objectContaining({
        p_project_id: 'proj-1',
        p_user_id: 'user-1',
        p_configuration_data: { wallColor: 'white' },
        p_engine_version: '1.0.0',
      }));

      // Verify p_bom_lines format
      const rpcArgs = mockedRpc.mock.calls[0][1];
      expect(rpcArgs.p_bom_lines).toEqual([
        expect.objectContaining({
          component_id: 'comp-1',
          sku_id: 'sku-1',
          quantity: 5,
          required_quantity: 5,
          waste_quantity: 0,
          unit_of_measure: 'PCS',
          calculation_rule: 'FIXED',
        }),
      ]);

      // Verify input_hash is a hex string
      expect(rpcArgs.p_input_hash).toMatch(/^[a-f0-9]{64}$/);

      // Verify idempotency_key is a UUID
      expect(rpcArgs.p_idempotency_key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );

      // State should not be saving
      expect(useBomStore.getState().isSaving).toBe(false);
      expect(useBomStore.getState().saveError).toBeNull();
    });

    it('should carry every product_type through to the RPC payload', async () => {
      const { useAuthStore } = await import('../authStore');
      useAuthStore.setState({
        user: { id: 'user-1' } as never,
        role: 'CONSULTANT',
        isAuthenticated: true,
        isLoading: false,
      });

      const productTypes = [
        'WALL_PANEL',
        'LIGHT',
        'FURNITURE',
        'HIDDEN_COMPONENT',
      ] as const;

      useBomStore.setState({
        pipelineStatus: 'success',
        pipelineOutputLines: productTypes.map((productType, index) => ({
          lineId: `l${index}`,
          componentId: `comp-${index}`,
          skuId: `sku-${index}`,
          quantity: 1,
          requiredQuantity: 1,
          wasteQuantity: 0,
          unitOfMeasure: 'PCS',
          calculationRule: 'FIXED',
          productType,
        })),
      });

      const { fromTable, supabase } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);
      const mockedRpc = vi.fn().mockResolvedValue({ data: 'new-bom-id', error: null });
      (supabase as unknown as { rpc: typeof mockedRpc }).rpc = mockedRpc;

      mockedFromTable.mockImplementation(
        () =>
          ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }) as unknown as ReturnType<typeof fromTable>,
      );

      await useBomStore.getState().saveBomToServer('proj-1', 'snap-hash-123');

      const rpcArgs = mockedRpc.mock.calls[0][1];
      expect(
        (rpcArgs.p_bom_lines as Array<{ product_type: string }>).map((l) => l.product_type),
      ).toEqual([...productTypes]);
    });

    it('should surface DB validation errors verbatim', async () => {
      const { useAuthStore } = await import('../authStore');
      useAuthStore.setState({
        user: { id: 'user-1' } as never,
        role: 'CONSULTANT',
        isAuthenticated: true,
        isLoading: false,
      });

      useBomStore.setState({
        pipelineStatus: 'success',
        pipelineOutputLines: [
          {
            lineId: 'l1',
            componentId: 'comp-1',
            skuId: 'sku-1',
            quantity: 5,
            requiredQuantity: 5,
            wasteQuantity: 0,
            unitOfMeasure: 'PCS',
            calculationRule: 'FIXED',
            productType: 'WALL_PANEL',
          },
        ],
      });

      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);
      const { supabase } = await import('@/lib/supabase');
      const mockedRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'SKU sku-1 not present in project snapshot' },
      });
      (supabase as unknown as { rpc: typeof mockedRpc }).rpc = mockedRpc;

      mockedFromTable.mockImplementation(() => {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as unknown as ReturnType<typeof fromTable>;
      });

      await expect(
        useBomStore.getState().saveBomToServer('proj-1', 'snap-hash-123'),
      ).rejects.toThrow('SKU sku-1 not present in project snapshot');

      expect(useBomStore.getState().isSaving).toBe(false);
      expect(useBomStore.getState().saveError).toBe('SKU sku-1 not present in project snapshot');
    });

    it('should throw if user is not authenticated', async () => {
      const { useAuthStore } = await import('../authStore');
      useAuthStore.setState({
        user: null,
        role: null,
        isAuthenticated: false,
        isLoading: false,
      });

      useBomStore.setState({
        pipelineStatus: 'success',
        pipelineOutputLines: [],
      });

      await expect(
        useBomStore.getState().saveBomToServer('proj-1', 'snap-hash-123'),
      ).rejects.toThrow('User not authenticated');

      expect(useBomStore.getState().saveError).toBe('User not authenticated');
    });

    it('should throw if pipeline has not succeeded', async () => {
      const { useAuthStore } = await import('../authStore');
      useAuthStore.setState({
        user: { id: 'user-1' } as never,
        role: 'CONSULTANT',
        isAuthenticated: true,
        isLoading: false,
      });

      useBomStore.setState({
        pipelineStatus: 'idle',
        pipelineOutputLines: [],
      });

      await expect(
        useBomStore.getState().saveBomToServer('proj-1', 'snap-hash-123'),
      ).rejects.toThrow('Pipeline must complete successfully before saving');

      expect(useBomStore.getState().saveError).toBe('Pipeline must complete successfully before saving');
    });

    it('should pass BOM_ENGINE_VERSION from version.ts', async () => {
      const { useAuthStore } = await import('../authStore');
      useAuthStore.setState({
        user: { id: 'user-1' } as never,
        role: 'CONSULTANT',
        isAuthenticated: true,
        isLoading: false,
      });

      useBomStore.setState({
        pipelineStatus: 'success',
        pipelineOutputLines: [
          {
            lineId: 'l1',
            componentId: 'comp-1',
            skuId: 'sku-1',
            quantity: 2,
            requiredQuantity: 2,
            wasteQuantity: 0,
            unitOfMeasure: 'PCS',
            calculationRule: 'FIXED',
            productType: 'WALL_PANEL',
          },
        ],
      });

      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);
      const { supabase } = await import('@/lib/supabase');
      const mockedRpc = vi.fn().mockResolvedValue({ data: 'bom-id-2', error: null });
      (supabase as unknown as { rpc: typeof mockedRpc }).rpc = mockedRpc;

      mockedFromTable.mockImplementation(() => {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as unknown as ReturnType<typeof fromTable>;
      });

      await useBomStore.getState().saveBomToServer('proj-1', 'snap-hash-456');

      expect(mockedRpc).toHaveBeenCalledWith(
        'save_actual_bom',
        expect.objectContaining({
          p_engine_version: '1.0.0',
        }),
      );
    });
  });
});
