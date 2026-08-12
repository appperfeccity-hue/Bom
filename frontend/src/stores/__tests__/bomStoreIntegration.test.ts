/**
 * Integration tests for the BOM store pipeline action.
 *
 * These tests exercise runPipeline through the store with realistic
 * mocked Supabase responses, testing the complete flow from data fetching
 * through pipeline execution to state updates.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBomStore } from '../bomStore';
import { ErrorCode, ErrorSeverity, ErrorCategory } from '@/engines/errorCatalogue';

// Do NOT mock bomPipeline - let the real pipeline execute
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
 * Creates a mock Supabase response that simulates a realistic project
 * with snapshot, measurements, permissions, and compatibility data.
 */
function createMockSupabaseResponses(options?: {
  snapshotError?: boolean;
  measurementError?: boolean;
  invalidGeometry?: boolean;
  lockedPermission?: boolean;
}) {
  const snapshotData = {
    snapshot_data: {
      zones: [
        {
          zoneId: 'zone-1',
          x: 0,
          y: 0,
          width: options?.invalidGeometry ? -100 : 1500,
          height: 2400,
          skuId: 'sku-panel-001',
          panelWidth: 600,
          panelHeight: 1200,
          gapHorizontal: 3,
          gapVertical: 3,
          wasteFactor: 0.05,
        },
        {
          zoneId: 'zone-2',
          x: options?.invalidGeometry ? -100 : 1500,
          y: 0,
          width: 1500,
          height: 2400,
          skuId: 'sku-panel-002',
          panelWidth: 600,
          panelHeight: 1200,
          gapHorizontal: 3,
          gapVertical: 3,
          wasteFactor: 0.05,
        },
      ],
      lighting: [
        {
          componentId: 'light-1',
          skuId: 'sku-led-001',
          edges: [{ length: 3000 }],
          mountingType: 'DIRECT',
          mode: 'DISCRETE',
          unitLength: 300,
        },
      ],
      furniture: [
        {
          componentId: 'furn-1',
          skuId: 'sku-desk-001',
          quantity: 2,
          min: 1,
          max: 5,
        },
      ],
      hiddenComponents: [
        {
          componentId: 'hidden-1',
          skuId: 'sku-bracket-001',
          triggerType: 'ALWAYS',
          quantityRule: 'FIXED',
          fixedValue: 4,
        },
      ],
    },
    configuration: options?.lockedPermission ? {
      consultantActions: [
        { parameter: 'sku_selection', value: 'sku-other', actionType: 'SELECT_SKU' },
      ],
    } : {},
    rule_set: {},
  };

  const measurementData = {
    wall_width: 3000,
    wall_height: 2400,
    template_wall_width: 3000,
    template_wall_height: 2400,
  };

  const permissionsData = options?.lockedPermission
    ? [{ parameter: 'sku_selection', locked: true }]
    : [];

  const compatData: unknown[] = [];

  return { snapshotData, measurementData, permissionsData, compatData };
}

describe('bomStore integration - runPipeline with real pipeline', () => {
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

  it('should produce SUCCESS with valid snapshot data', async () => {
    const { fromTable } = await import('@/lib/supabase');
    const mockedFromTable = vi.mocked(fromTable);
    const mocks = createMockSupabaseResponses();

    let callCount = 0;
    mockedFromTable.mockImplementation(() => {
      callCount++;
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };
      if (callCount === 1) {
        // project_snapshot
        chain.single.mockResolvedValue({ data: mocks.snapshotData, error: null });
      } else if (callCount === 2) {
        // project_measurement
        chain.single.mockResolvedValue({ data: mocks.measurementData, error: null });
      } else if (callCount === 3) {
        // permission_rule (not single)
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: mocks.permissionsData, error: null }),
        } as unknown as ReturnType<typeof fromTable>;
      } else {
        // compatibility_rule (not single)
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: mocks.compatData, error: null }),
        } as unknown as ReturnType<typeof fromTable>;
      }
      return chain as unknown as ReturnType<typeof fromTable>;
    });

    await useBomStore.getState().runPipeline('proj-1', 'snap-1');

    const state = useBomStore.getState();
    expect(state.pipelineStatus).toBe('success');
    expect(state.pipelineErrors).toHaveLength(0);
    expect(state.pipelineOutputLines.length).toBeGreaterThan(0);
    expect(state.pipelineProgress).toBeNull();
    expect(state.error).toBeNull();

    // Verify output lines contain expected types
    const panelLines = state.pipelineOutputLines.filter(l => l.calculationRule === 'WALL_PANEL');
    const lightLines = state.pipelineOutputLines.filter(l => l.calculationRule === 'LIGHT');
    const furnLines = state.pipelineOutputLines.filter(l => l.calculationRule === 'FURNITURE');
    const hiddenLines = state.pipelineOutputLines.filter(l => l.calculationRule === 'HIDDEN_COMPONENT');

    expect(panelLines.length).toBeGreaterThan(0);
    expect(lightLines.length).toBeGreaterThan(0);
    expect(furnLines.length).toBeGreaterThan(0);
    expect(hiddenLines.length).toBeGreaterThan(0);
  });

  it('should produce BLOCKED with structured errors on fetch failure', async () => {
    const { fromTable } = await import('@/lib/supabase');
    const mockedFromTable = vi.mocked(fromTable);

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Row not found' } }),
    };
    mockedFromTable.mockReturnValue(mockChain as unknown as ReturnType<typeof fromTable>);

    await useBomStore.getState().runPipeline('proj-1', 'snap-1');

    const state = useBomStore.getState();
    expect(state.pipelineStatus).toBe('blocked');
    expect(state.error).toBe('Row not found');
    // Should now have a structured error in pipelineErrors
    expect(state.pipelineErrors).toHaveLength(1);
    expect(state.pipelineErrors[0].message).toContain('Row not found');
    expect(state.pipelineErrors[0].severity).toBe(ErrorSeverity.BLOCKING);
    expect(state.pipelineOutputLines).toHaveLength(0);
  });

  it('should produce BLOCKED with geometry errors on invalid zone data', async () => {
    const { fromTable } = await import('@/lib/supabase');
    const mockedFromTable = vi.mocked(fromTable);
    const mocks = createMockSupabaseResponses({ invalidGeometry: true });

    let callCount = 0;
    mockedFromTable.mockImplementation(() => {
      callCount++;
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };
      if (callCount === 1) {
        chain.single.mockResolvedValue({ data: mocks.snapshotData, error: null });
      } else if (callCount === 2) {
        chain.single.mockResolvedValue({ data: mocks.measurementData, error: null });
      } else if (callCount === 3) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: mocks.permissionsData, error: null }),
        } as unknown as ReturnType<typeof fromTable>;
      } else {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: mocks.compatData, error: null }),
        } as unknown as ReturnType<typeof fromTable>;
      }
      return chain as unknown as ReturnType<typeof fromTable>;
    });

    await useBomStore.getState().runPipeline('proj-1', 'snap-1');

    const state = useBomStore.getState();
    expect(state.pipelineStatus).toBe('blocked');
    expect(state.pipelineErrors.length).toBeGreaterThan(0);
    expect(state.pipelineErrors.some(
      e => e.code === ErrorCode.GEO_ZONE_NEGATIVE_DIMENSION ||
           e.code === ErrorCode.GEO_ZONE_INVALID_POSITION
    )).toBe(true);
  });

  it('should produce BLOCKED with permission errors when consultant violates rules', async () => {
    const { fromTable } = await import('@/lib/supabase');
    const mockedFromTable = vi.mocked(fromTable);
    const mocks = createMockSupabaseResponses({ lockedPermission: true });

    let callCount = 0;
    mockedFromTable.mockImplementation(() => {
      callCount++;
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };
      if (callCount === 1) {
        chain.single.mockResolvedValue({ data: mocks.snapshotData, error: null });
      } else if (callCount === 2) {
        chain.single.mockResolvedValue({ data: mocks.measurementData, error: null });
      } else if (callCount === 3) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: mocks.permissionsData, error: null }),
        } as unknown as ReturnType<typeof fromTable>;
      } else {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: mocks.compatData, error: null }),
        } as unknown as ReturnType<typeof fromTable>;
      }
      return chain as unknown as ReturnType<typeof fromTable>;
    });

    await useBomStore.getState().runPipeline('proj-1', 'snap-1');

    const state = useBomStore.getState();
    expect(state.pipelineStatus).toBe('blocked');
    expect(state.pipelineErrors.some(e => e.code === ErrorCode.PERM_LOCKED_PARAMETER)).toBe(true);
  });

  it('should reset pipeline state with resetPipeline', async () => {
    useBomStore.setState({
      pipelineStatus: 'blocked',
      pipelineErrors: [{
        code: ErrorCode.GEO_ZONE_OVERLAP,
        severity: ErrorSeverity.BLOCKING,
        category: ErrorCategory.GEOMETRY,
        message: 'test error',
      }],
      pipelineWarnings: [],
      pipelineProgress: 'Step 3',
      pipelineOutputLines: [],
    });

    useBomStore.getState().resetPipeline();

    const state = useBomStore.getState();
    expect(state.pipelineStatus).toBe('idle');
    expect(state.pipelineErrors).toHaveLength(0);
    expect(state.pipelineProgress).toBeNull();
  });
});
