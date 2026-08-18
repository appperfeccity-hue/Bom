/**
 * P0 Test Suite: Transaction Atomicity
 *
 * Verifies that the BOM pipeline and store adhere to all-or-nothing semantics:
 * - If any validation step produces a BLOCKING error, zero BOM lines are emitted.
 * - The store correctly surfaces pipeline failures via pipelineStatus and pipelineOutputLines.
 * - The legacy generateActualBom path collects errors per-engine but still returns valid lines.
 *
 * This is release-blocking because partial BOM output could lead to incorrect orders.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runBomPipeline } from '@/engines/bomPipeline';
import type { BomPipelineInput } from '@/engines/bomPipeline';
import { useBomStore } from '@/stores/bomStore';
import { ErrorCode, ErrorSeverity, ErrorCategory } from '@/engines/errorCatalogue';
import type { PipelineError } from '@/engines/errorCatalogue';

// Mock the bomPipeline module for store-level tests
vi.mock('@/engines/bomPipeline', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/engines/bomPipeline')>();
  return {
    ...actual,
    runBomPipeline: vi.fn(actual.runBomPipeline),
  };
});

// Mock the supabase module for store-level tests
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

/**
 * Helper to create a valid multi-zone input for pipeline tests.
 */
function createValidInput(overrides?: Partial<BomPipelineInput>): BomPipelineInput {
  return {
    snapshotData: {
      zones: [
        {
          zoneId: 'zone-1',
          x: 0,
          y: 0,
          width: 1000,
          height: 1000,
          skuId: 'sku-panel-1',
          panelWidth: 300,
          panelHeight: 400,
          gapHorizontal: 5,
          gapVertical: 5,
          wasteFactor: 0.05,
        },
        {
          zoneId: 'zone-2',
          x: 1000,
          y: 0,
          width: 800,
          height: 1000,
          skuId: 'sku-panel-2',
          panelWidth: 200,
          panelHeight: 250,
          gapHorizontal: 3,
          gapVertical: 3,
          wasteFactor: 0.04,
        },
      ],
      lighting: [
        {
          componentId: 'light-1',
          skuId: 'sku-light-1',
          edges: [{ length: 1800 }],
          mountingType: 'DIRECT',
          mode: 'DISCRETE',
          unitLength: 200,
        },
      ],
      furniture: [
        {
          componentId: 'furn-1',
          skuId: 'sku-furn-1',
          quantity: 2,
          min: 1,
          max: 5,
        },
      ],
      hiddenComponents: [
        {
          componentId: 'hidden-1',
          skuId: 'sku-hidden-1',
          triggerType: 'ALWAYS',
          quantityRule: 'FIXED',
          fixedValue: 4,
        },
      ],
    },
    measurements: {
      wallWidth: 3000,
      wallHeight: 2700,
      templateWallWidth: 3000,
    },
    configuration: {},
    ruleSet: {},
    permissions: [],
    compatibilityRules: [],
    ...overrides,
  };
}

describe('P0: Transaction Atomicity', () => {
  describe('pipeline-level atomicity (direct runBomPipeline calls)', () => {
    it('should return BLOCKED with 0 actualBomLines when geometry validation fails (negative dimension)', () => {
      const input = createValidInput({
        snapshotData: {
          zones: [
            {
              zoneId: 'zone-valid',
              x: 0,
              y: 0,
              width: 1000,
              height: 1000,
              skuId: 'sku-1',
              panelWidth: 300,
              panelHeight: 400,
              gapHorizontal: 5,
              gapVertical: 5,
              wasteFactor: 0.05,
            },
            {
              zoneId: 'zone-invalid',
              x: 1000,
              y: 0,
              width: -100,  // Invalid negative dimension
              height: 500,
              skuId: 'sku-2',
              panelWidth: 200,
              panelHeight: 300,
            },
          ],
        },
      });

      const output = runBomPipeline(input);

      expect(output.status).toBe('BLOCKED');
      expect(output.actualBomLines).toHaveLength(0);
      expect(output.errors.length).toBeGreaterThan(0);
      expect(
        output.errors.some((e) => e.code === ErrorCode.GEO_ZONE_NEGATIVE_DIMENSION)
      ).toBe(true);
    });

    it('should return BLOCKED with 0 actualBomLines when permission validation fails', () => {
      const input = createValidInput({
        permissions: [{ parameter: 'material', locked: true }],
        configuration: {
          consultantActions: [
            { parameter: 'material', value: 'stone', actionType: 'SET_VALUE' },
          ],
        },
      });

      const output = runBomPipeline(input);

      expect(output.status).toBe('BLOCKED');
      expect(output.actualBomLines).toHaveLength(0);
      expect(output.errors.length).toBeGreaterThan(0);
      expect(output.errors[0].code).toBe(ErrorCode.PERM_LOCKED_PARAMETER);
    });

    it('should return BLOCKED with 0 actualBomLines when wall dimensions are invalid', () => {
      const input = createValidInput({
        measurements: {
          wallWidth: 0,
          wallHeight: 2700,
          templateWallWidth: 3000,
        },
      });

      const output = runBomPipeline(input);

      expect(output.status).toBe('BLOCKED');
      expect(output.actualBomLines).toHaveLength(0);
      expect(output.errors.length).toBeGreaterThan(0);
    });

    it('should return BLOCKED with 0 actualBomLines when compatibility check fails', () => {
      const input = createValidInput({
        configuration: {
          selectedSkuPairs: [
            { sourceSkuId: 'sku-x', targetSkuId: 'sku-y' },
          ],
        },
        compatibilityRules: [
          {
            sourceSkuId: 'sku-x',
            targetSkuId: 'sku-y',
            relationshipType: 'ALTERNATIVE_TO',
            isMandatory: false,
          },
        ],
      });

      const output = runBomPipeline(input);

      expect(output.status).toBe('BLOCKED');
      expect(output.actualBomLines).toHaveLength(0);
      expect(output.errors[0].code).toBe(ErrorCode.COMPAT_INCOMPATIBLE_SKUS);
    });

    it('should return BLOCKED with 0 actualBomLines when construction validation fails', () => {
      const input = createValidInput({
        ruleSet: {
          constructionRules: [
            { componentId: 'required-component-xyz', isMandatory: true },
          ],
        },
      });

      const output = runBomPipeline(input);

      expect(output.status).toBe('BLOCKED');
      expect(output.actualBomLines).toHaveLength(0);
      expect(output.errors[0].code).toBe(ErrorCode.CONST_MISSING_REQUIRED_COMPONENT);
    });

    it('should not produce any BOM lines even when some zones are valid but others trigger blocking errors', () => {
      // Multi-zone input: zone-1 is valid, but zone-2 has negative dimension
      // The pipeline should block at geometry validation for the whole batch
      const input = createValidInput({
        snapshotData: {
          zones: [
            {
              zoneId: 'zone-good',
              x: 0,
              y: 0,
              width: 1000,
              height: 1000,
              skuId: 'sku-1',
              panelWidth: 300,
              panelHeight: 400,
              gapHorizontal: 5,
              gapVertical: 5,
              wasteFactor: 0.05,
            },
            {
              zoneId: 'zone-bad',
              x: 1000,
              y: 0,
              width: -500,
              height: -500,
              skuId: 'sku-2',
              panelWidth: 200,
              panelHeight: 300,
            },
          ],
          lighting: [
            {
              componentId: 'light-good',
              skuId: 'sku-light',
              edges: [{ length: 1000 }],
              mountingType: 'DIRECT',
              mode: 'DISCRETE',
              unitLength: 200,
            },
          ],
          furniture: [
            {
              componentId: 'furn-good',
              skuId: 'sku-furn',
              quantity: 2,
              min: 1,
              max: 5,
            },
          ],
          hiddenComponents: [],
        },
      });

      const output = runBomPipeline(input);

      // All-or-nothing: even though zone-good and lighting/furniture are valid,
      // the blocking geometry error on zone-bad means zero lines
      expect(output.status).toBe('BLOCKED');
      expect(output.actualBomLines).toHaveLength(0);
    });

    it('should return SUCCESS with lines only when all validation steps pass', () => {
      const input = createValidInput();
      const output = runBomPipeline(input);

      expect(output.status).toBe('SUCCESS');
      expect(output.errors).toHaveLength(0);
      expect(output.actualBomLines.length).toBeGreaterThan(0);
    });
  });

  describe('store-level atomicity (bomStore.runPipeline)', () => {
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
      });
    });

    it('should set pipelineStatus to blocked and pipelineOutputLines to [] on blocking error', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            snapshot_data: { zones: [] },
            configuration: {},
            rule_set: {},
            wall_width: 2400,
            wall_height: 1200,
            template_wall_width: 2400,
          },
          error: null,
        }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      const blockedError: PipelineError = {
        code: ErrorCode.GEO_ZONE_NEGATIVE_DIMENSION,
        severity: ErrorSeverity.BLOCKING,
        category: ErrorCategory.GEOMETRY,
        message: 'Zone has negative dimension',
      };

      const { runBomPipeline: mockedPipeline } = await import('@/engines/bomPipeline');
      vi.mocked(mockedPipeline).mockReturnValue({
        actualBomLines: [],
        errors: [blockedError],
        warnings: [],
        status: 'BLOCKED',
      });

      await useBomStore.getState().runPipeline('proj-1', 'snap-1');

      const state = useBomStore.getState();
      expect(state.pipelineStatus).toBe('blocked');
      expect(state.pipelineOutputLines).toEqual([]);
      expect(state.pipelineErrors).toHaveLength(1);
      expect(state.pipelineErrors[0].code).toBe(ErrorCode.GEO_ZONE_NEGATIVE_DIMENSION);
    });

    it('should set pipelineStatus to blocked when snapshot fetch fails', async () => {
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
          error: { message: 'Snapshot not found' },
        }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      await useBomStore.getState().runPipeline('proj-1', 'snap-missing');

      const state = useBomStore.getState();
      expect(state.pipelineStatus).toBe('blocked');
      expect(state.pipelineOutputLines).toEqual([]);
      expect(state.error).toBe('Snapshot not found');
    });

    it('should set pipelineOutputLines with lines only on SUCCESS', async () => {
      const { fromTable } = await import('@/lib/supabase');
      const mockedFromTable = vi.mocked(fromTable);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            snapshot_data: { zones: [] },
            configuration: {},
            rule_set: {},
            wall_width: 3000,
            wall_height: 2700,
            template_wall_width: 3000,
          },
          error: null,
        }),
      };
      mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

      const successLine = {
        lineId: 'line-1',
        componentId: 'comp-1',
        skuId: 'sku-1',
        quantity: 10,
        requiredQuantity: 10,
        wasteQuantity: 0,
        unitOfMeasure: 'PCS',
        calculationRule: 'WALL_PANEL',
        productType: 'WALL_PANEL' as const,
      };

      const { runBomPipeline: mockedPipeline } = await import('@/engines/bomPipeline');
      vi.mocked(mockedPipeline).mockReturnValue({
        actualBomLines: [successLine],
        errors: [],
        warnings: [],
        status: 'SUCCESS',
      });

      await useBomStore.getState().runPipeline('proj-1', 'snap-1');

      const state = useBomStore.getState();
      expect(state.pipelineStatus).toBe('success');
      expect(state.pipelineOutputLines).toHaveLength(1);
      expect(state.pipelineOutputLines[0].quantity).toBe(10);
      expect(state.pipelineErrors).toEqual([]);
    });
  });

  describe('legacy generateActualBom atomicity (per-engine error collection)', () => {
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
      });
    });

    it('should return valid lines and collect errors when mix of valid/invalid inputs', () => {
      const result = useBomStore.getState().generateActualBom({
        wallPanels: [
          // Valid panel
          { W: 2400, H: 1200, w: 600, h: 600, gh: 0, gv: 0, wasteFactor: 0 },
          // Invalid: zero panel width triggers error
          { W: 2400, H: 1200, w: 0, h: 600, gh: 0, gv: 0, wasteFactor: 0 },
        ],
        lights: [
          // Valid light
          { edges: [{ length: 2000 }], mountingType: 'DIRECT', mode: 'LINEAR', unitLength: 600 },
        ],
        furniture: [
          // Valid furniture
          { quantity: 3, min: 1, max: 10, skuId: 'sku-furn' },
        ],
        hiddenComponents: [
          // Valid hidden component
          { triggerType: 'ALWAYS', quantityRule: 'FIXED', fixedValue: 5 },
        ],
      });

      // Legacy path: valid lines are returned even when some fail
      expect(result.lines.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].productType).toBe('WALL_PANEL');
      expect(result.errors[0].index).toBe(1);
    });

    it('should return 0 lines and multiple errors when all wall panel inputs are invalid', () => {
      const result = useBomStore.getState().generateActualBom({
        wallPanels: [
          { W: 2400, H: 1200, w: 0, h: 600, gh: 0, gv: 0, wasteFactor: 0 },
          { W: 2400, H: 1200, w: 0, h: 600, gh: 0, gv: 0, wasteFactor: 0 },
        ],
        lights: [],
        furniture: [],
        hiddenComponents: [],
      });

      expect(result.lines).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].productType).toBe('WALL_PANEL');
      expect(result.errors[1].productType).toBe('WALL_PANEL');
    });

    it('should collect errors from multiple engine types without aborting', () => {
      const result = useBomStore.getState().generateActualBom({
        wallPanels: [
          { W: 2400, H: 1200, w: 0, h: 600, gh: 0, gv: 0, wasteFactor: 0 },
        ],
        lights: [
          { edges: [{ length: 1000 }], mountingType: 'DIRECT', mode: 'DISCRETE', unitLength: 0 },
        ],
        furniture: [
          { quantity: 1, min: 5, max: 10, skuId: 'sku-1' },
        ],
        hiddenComponents: [
          { triggerType: 'ALWAYS', quantityRule: 'FIXED', fixedValue: 3 },
        ],
      });

      // Only hidden component should succeed
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].productType).toBe('HIDDEN_COMPONENT');
      // Three engines failed
      expect(result.errors).toHaveLength(3);
    });
  });
});
