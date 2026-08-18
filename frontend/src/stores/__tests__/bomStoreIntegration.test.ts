/**
 * Integration tests for the BOM store pipeline action.
 *
 * These tests exercise runPipeline through the store with realistic
 * mocked Supabase responses, testing the complete flow from data fetching
 * through pipeline execution to state updates.
 *
 * The pipeline now uses snapshot mappers (v1/v2) to convert snapshot_data
 * into BomPipelineInput, reading permissions and compatibility from the
 * snapshot itself rather than querying non-existent tables.
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
 * Creates mock Supabase responses that simulate a realistic project.
 * The new pipeline fetches: project_snapshot, project_measurement,
 * project_configuration, and project_obstruction.
 * Permissions/compatibility come from snapshot_data (v2 mapper).
 */
function createMockSupabaseResponses(options?: {
  snapshotError?: boolean;
  measurementError?: boolean;
  invalidGeometry?: boolean;
  lockedPermission?: boolean;
  useV2Snapshot?: boolean;
}) {
  const useV2 = options?.useV2Snapshot ?? false;

  // V1 snapshot: camelCase zones (old client-built format)
  const v1SnapshotData = {
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
      base_dimensions: { width_mm: 3000, height_mm: 2400 },
    },
  };

  // V2 snapshot: snake_case zones with frozen permissions/compatibility
  const v2SnapshotData = {
    snapshot_data: {
      snapshot_version: 2,
      template: {
        template_id: 'tpl-1',
        name: 'Test',
        wall_application: 'FEATURE_WALL',
        adaptation_strategy: 'PROPORTIONAL',
        priority_zone_id: null,
        waste_factor: 0.05,
        metadata: null,
      },
      wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2400 },
      base_dimensions: { width_mm: 3000, height_mm: 2400 },
      zones: [
        {
          zone_id: 'zone-1',
          x_mm: 0,
          y_mm: 0,
          width_mm: options?.invalidGeometry ? -100 : 1500,
          height_mm: 2400,
          width_strategy: 'PROPORTIONAL',
          height_strategy: 'DERIVED_FROM_WALL',
          position_strategy: 'FIXED',
          primary_sku: {
            sku_id: 'sku-panel-001',
            width_mm: 600,
            height_mm: 1200,
            gh_mm: 3,
            gv_mm: 3,
          },
          alternatives: [],
        },
        {
          zone_id: 'zone-2',
          x_mm: options?.invalidGeometry ? -100 : 1500,
          y_mm: 0,
          width_mm: 1500,
          height_mm: 2400,
          width_strategy: 'PROPORTIONAL',
          height_strategy: 'DERIVED_FROM_WALL',
          position_strategy: 'FIXED',
          primary_sku: {
            sku_id: 'sku-panel-002',
            width_mm: 600,
            height_mm: 1200,
            gh_mm: 3,
            gv_mm: 3,
          },
          alternatives: [],
        },
      ],
      lighting: [
        {
          lighting_id: 'light-1',
          template_id: 'tpl-1',
          sku_id: 'sku-led-001',
          edge_selection: JSON.stringify([{ length: 3000 }]),
          mounting_type: 'DIRECT',
          quantity_rule: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
      furniture: [
        {
          furniture_id: 'furn-1',
          template_id: 'tpl-1',
          sku_id: 'sku-desk-001',
          position_x_mm: 100,
          position_y_mm: 200,
          orientation: 'HORIZONTAL',
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
      trims: [],
      hidden_components: [
        {
          hidden_component_id: 'hidden-1',
          sku_id: 'sku-bracket-001',
          trigger_type: 'ALWAYS',
          trigger_condition: null,
          quantity_rule: 'FIXED',
          fixed_value: 4,
        },
      ],
      calculation_parameters: {},
      template_wall_configuration: null,
      consultant_permissions: options?.lockedPermission
        ? [{ permission_id: 'p1', parameter_key: 'sku_selection', parameter_type: 'SKU', edit_mode: 'LOCKED', min_value: null, max_value: null, allowed_values: null, source_component_id: null }]
        : [],
      site_obstructions: [],
      sku_compatibility: [],
      rule_set: null,
    },
  };

  const snapshotData = useV2 ? v2SnapshotData : v1SnapshotData;

  // Add configuration with consultant actions for locked permission test
  const configurationData = options?.lockedPermission
    ? { configuration_data: { consultantActions: [{ parameter: 'sku_selection', value: 'sku-other', actionType: 'SELECT_SKU' }] } }
    : null;

  const measurementData = {
    wall_width_mm: 3000,
    wall_height_mm: 2400,
  };

  return { snapshotData, measurementData, configurationData };
}

/**
 * Helper to set up mock fromTable for the new pipeline flow:
 * Call 1: project_snapshot (single)
 * Call 2: project_measurement (single)
 * Call 3: project_configuration (single, may return null)
 * Call 4: project_obstruction (array via eq)
 */
function setupMockFromTable(
  mockedFromTable: ReturnType<typeof vi.mocked<typeof import('@/lib/supabase')['fromTable']>>,
  mocks: ReturnType<typeof createMockSupabaseResponses>,
  options?: { snapshotError?: boolean; measurementError?: boolean },
) {
  let callCount = 0;
  mockedFromTable.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // project_snapshot
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(
          options?.snapshotError
            ? { data: null, error: { message: 'Snapshot not found' } }
            : { data: mocks.snapshotData, error: null }
        ),
      } as unknown as ReturnType<typeof mockedFromTable>;
    } else if (callCount === 2) {
      // project_measurement
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(
          options?.measurementError
            ? { data: null, error: { message: 'Measurement not found' } }
            : { data: mocks.measurementData, error: null }
        ),
      } as unknown as ReturnType<typeof mockedFromTable>;
    } else if (callCount === 3) {
      // project_configuration
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mocks.configurationData, error: null }),
      } as unknown as ReturnType<typeof mockedFromTable>;
    } else {
      // project_obstruction
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as unknown as ReturnType<typeof mockedFromTable>;
    }
  });
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

  it('should produce SUCCESS with valid v1 snapshot data', async () => {
    const { fromTable } = await import('@/lib/supabase');
    const mockedFromTable = vi.mocked(fromTable);
    const mocks = createMockSupabaseResponses();
    setupMockFromTable(mockedFromTable, mocks);

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
    // V1 legacy snapshots have no hidden_components (they degrade explicitly)
    expect(hiddenLines.length).toBe(0);
  });

  it('should produce SUCCESS with valid v2 snapshot data', async () => {
    const { fromTable } = await import('@/lib/supabase');
    const mockedFromTable = vi.mocked(fromTable);
    const mocks = createMockSupabaseResponses({ useV2Snapshot: true });
    setupMockFromTable(mockedFromTable, mocks);

    await useBomStore.getState().runPipeline('proj-1', 'snap-1');

    const state = useBomStore.getState();
    expect(state.pipelineStatus).toBe('success');
    expect(state.pipelineErrors).toHaveLength(0);
    expect(state.pipelineOutputLines.length).toBeGreaterThan(0);
    expect(state.pipelineProgress).toBeNull();
    expect(state.error).toBeNull();

    // v2 should produce panel lines + hidden component lines
    const panelLines = state.pipelineOutputLines.filter(l => l.calculationRule === 'WALL_PANEL');
    const hiddenLines = state.pipelineOutputLines.filter(l => l.calculationRule === 'HIDDEN_COMPONENT');

    expect(panelLines.length).toBeGreaterThan(0);
    expect(hiddenLines.length).toBeGreaterThan(0);
  });

  it('should produce BLOCKED with structured errors on fetch failure', async () => {
    const { fromTable } = await import('@/lib/supabase');
    const mockedFromTable = vi.mocked(fromTable);
    const mocks = createMockSupabaseResponses();
    setupMockFromTable(mockedFromTable, mocks, { snapshotError: true });

    await useBomStore.getState().runPipeline('proj-1', 'snap-1');

    const state = useBomStore.getState();
    expect(state.pipelineStatus).toBe('blocked');
    expect(state.error).toBe('Snapshot not found');
    // Should now have a structured error in pipelineErrors
    expect(state.pipelineErrors).toHaveLength(1);
    expect(state.pipelineErrors[0].message).toContain('Snapshot not found');
    expect(state.pipelineErrors[0].severity).toBe(ErrorSeverity.BLOCKING);
    expect(state.pipelineOutputLines).toHaveLength(0);
  });

  it('should produce BLOCKED with geometry errors on invalid zone data (v1)', async () => {
    const { fromTable } = await import('@/lib/supabase');
    const mockedFromTable = vi.mocked(fromTable);
    const mocks = createMockSupabaseResponses({ invalidGeometry: true });
    setupMockFromTable(mockedFromTable, mocks);

    await useBomStore.getState().runPipeline('proj-1', 'snap-1');

    const state = useBomStore.getState();
    expect(state.pipelineStatus).toBe('blocked');
    expect(state.pipelineErrors.length).toBeGreaterThan(0);
    expect(state.pipelineErrors.some(
      e => e.code === ErrorCode.GEO_ZONE_NEGATIVE_DIMENSION ||
           e.code === ErrorCode.GEO_ZONE_INVALID_POSITION
    )).toBe(true);
  });

  it('should produce BLOCKED with geometry errors on invalid zone data (v2)', async () => {
    const { fromTable } = await import('@/lib/supabase');
    const mockedFromTable = vi.mocked(fromTable);
    const mocks = createMockSupabaseResponses({ invalidGeometry: true, useV2Snapshot: true });
    setupMockFromTable(mockedFromTable, mocks);

    await useBomStore.getState().runPipeline('proj-1', 'snap-1');

    const state = useBomStore.getState();
    expect(state.pipelineStatus).toBe('blocked');
    expect(state.pipelineErrors.length).toBeGreaterThan(0);
    expect(state.pipelineErrors.some(
      e => e.code === ErrorCode.GEO_ZONE_NEGATIVE_DIMENSION ||
           e.code === ErrorCode.GEO_ZONE_INVALID_POSITION
    )).toBe(true);
  });

  it('should produce BLOCKED with permission errors when consultant violates rules (v2)', async () => {
    const { fromTable } = await import('@/lib/supabase');
    const mockedFromTable = vi.mocked(fromTable);
    const mocks = createMockSupabaseResponses({ lockedPermission: true, useV2Snapshot: true });
    setupMockFromTable(mockedFromTable, mocks);

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

  it('should produce deterministic output for identical inputs', async () => {
    const { fromTable } = await import('@/lib/supabase');
    const mockedFromTable = vi.mocked(fromTable);
    const mocks = createMockSupabaseResponses({ useV2Snapshot: true });

    // Run pipeline twice with same data
    setupMockFromTable(mockedFromTable, mocks);
    await useBomStore.getState().runPipeline('proj-1', 'snap-1');
    const firstOutput = [...useBomStore.getState().pipelineOutputLines];

    useBomStore.getState().resetPipeline();
    setupMockFromTable(mockedFromTable, mocks);
    await useBomStore.getState().runPipeline('proj-1', 'snap-1');
    const secondOutput = [...useBomStore.getState().pipelineOutputLines];

    expect(JSON.stringify(firstOutput)).toBe(JSON.stringify(secondOutput));
  });
});
