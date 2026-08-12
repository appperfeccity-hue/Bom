import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBomStore } from '../bomStore';
import {
  MasterBomStatus,
  ProductType,
  ReconciliationResultType,
} from '@/types/database';
import type { MasterBomLine, ActualBomLine } from '@/types/database';

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
    supabase: {},
    isSupabaseConfigured: false,
  };
});

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
});
