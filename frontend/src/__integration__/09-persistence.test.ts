/**
 * Integration Test Area 9: Persistence
 *
 * Validates that:
 * - buildSnapshotData -> computeSnapshotHash -> same inputs -> identical hash (save/reload)
 * - Snapshot -> runBomPipeline is reproducible (same snapshot always yields same BOM)
 * - Undo does not corrupt state (push two states, undo, verify previous state matches)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { buildSnapshotData, computeSnapshotHash } from '@/lib/snapshotBuilder';
import { runBomPipeline } from '@/engines/bomPipeline';
import { useHistory, resetHistory } from '@/canvas/history/useHistory';
import type { Template, TemplateZone, TemplateLighting, TemplateFurniture, TemplateTrim, SkuMaster } from '@/types/database';
import { TemplateStatus, AdaptationStrategy, ZoneWidthStrategy, ZoneHeightStrategy, ZonePositionStrategy, ProductType, SkuStatus, QuantityMode } from '@/types/database';
import { createStraightWallPipelineInput, createMultiZoneMultiSkuPipelineInput } from './helpers/fixtures';

// --- Fixtures ---

function createTemplate(): Template {
  return {
    template_id: 'tmpl-persist-001',
    name: 'Persistence Test Template',
    description: null,
    wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2400 },
    status: TemplateStatus.ACTIVE,
    adaptation_strategy: AdaptationStrategy.PROPORTIONAL,
    design_family_id: null,
    design_subfamily_id: null,
    wall_application: null,
    priority_zone_id: null,
    waste_factor: null,
    metadata: null,
    created_by: 'designer-001',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

function createZones(): TemplateZone[] {
  return [
    {
      zone_id: 'z-persist-1',
      template_id: 'tmpl-persist-001',
      x_mm: 0,
      y_mm: 0,
      width_mm: 1500,
      height_mm: 2400,
      width_strategy: ZoneWidthStrategy.PROPORTIONAL,
      height_strategy: ZoneHeightStrategy.DERIVED_FROM_WALL,
      position_strategy: ZonePositionStrategy.FIXED,
      segment: null,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      zone_id: 'z-persist-2',
      template_id: 'tmpl-persist-001',
      x_mm: 1500,
      y_mm: 0,
      width_mm: 1500,
      height_mm: 2400,
      width_strategy: ZoneWidthStrategy.PROPORTIONAL,
      height_strategy: ZoneHeightStrategy.DERIVED_FROM_WALL,
      position_strategy: ZonePositionStrategy.FIXED,
      segment: null,
      created_at: '2024-01-01T00:00:00Z',
    },
  ];
}

function createSkuMaster(id: string): SkuMaster {
  return {
    sku_id: id,
    sku_code: `CODE-${id}`,
    product_type: ProductType.WALL_PANEL,
    family_id: 'family-001',
    category_id: 'category-001',
    width_mm: 600,
    height_mm: 1200,
    thickness_mm: 12,
    depth_mm: null,
    unit_length_mm: null,
    material: 'Walnut',
    colour: 'Dark',
    finish: 'Satin',
    pattern_identity: null,
    gh_mm: 3,
    gv_mm: 3,
    quantity_mode: QuantityMode.DISCRETE,
    commercial_attributes: {},
    status: SkuStatus.ACTIVE,
    created_by: 'admin',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

describe('Integration Area 9: Persistence', () => {
  describe('Save -> Reload produces identical hash', () => {
    it('buildSnapshotData -> computeSnapshotHash -> repeat -> identical hash', async () => {
      const template = createTemplate();
      const zones = createZones();
      const lighting: TemplateLighting[] = [];
      const furniture: TemplateFurniture[] = [];
      const trims: TemplateTrim[] = [];
      const skuMap = new Map<string, SkuMaster>();
      skuMap.set('z-persist-1', createSkuMaster('sku-walnut-001'));
      skuMap.set('z-persist-2', createSkuMaster('sku-walnut-002'));

      // Simulate "save"
      const snapshot1 = buildSnapshotData(template, zones, lighting, furniture, trims, skuMap);
      const hash1 = await computeSnapshotHash(snapshot1);

      // Simulate "reload" (build from same inputs)
      const snapshot2 = buildSnapshotData(template, zones, lighting, furniture, trims, skuMap);
      const hash2 = await computeSnapshotHash(snapshot2);

      expect(hash1).toBe(hash2);
    });

    it('hash is stable across multiple computations of same snapshot', async () => {
      const template = createTemplate();
      const zones = createZones();
      const skuMap = new Map<string, SkuMaster>();
      skuMap.set('z-persist-1', createSkuMaster('sku-walnut-001'));

      const snapshot = buildSnapshotData(template, zones, [], [], [], skuMap);

      const hash1 = await computeSnapshotHash(snapshot);
      const hash2 = await computeSnapshotHash(snapshot);
      const hash3 = await computeSnapshotHash(snapshot);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });
  });

  describe('Snapshot -> BOM pipeline is reproducible', () => {
    it('same snapshot always yields same BOM output', () => {
      const input = createStraightWallPipelineInput();

      const output1 = runBomPipeline(input);
      const output2 = runBomPipeline(input);
      const output3 = runBomPipeline(input);

      expect(output1.status).toBe('SUCCESS');
      expect(output1.actualBomLines).toEqual(output2.actualBomLines);
      expect(output2.actualBomLines).toEqual(output3.actualBomLines);
    });

    it('complex multi-zone snapshot produces reproducible BOM', () => {
      const input = createMultiZoneMultiSkuPipelineInput();

      const output1 = runBomPipeline(input);
      const output2 = runBomPipeline(input);

      expect(output1.status).toBe('SUCCESS');
      expect(output1).toEqual(output2);
    });

    it('BOM line IDs are deterministic for same input', () => {
      const input = createStraightWallPipelineInput();

      const output1 = runBomPipeline(input);
      const output2 = runBomPipeline(input);

      const lineIds1 = output1.actualBomLines.map(l => l.lineId);
      const lineIds2 = output2.actualBomLines.map(l => l.lineId);

      expect(lineIds1).toEqual(lineIds2);
    });
  });

  describe('Undo does not corrupt state', () => {
    beforeEach(() => {
      resetHistory();
    });

    it('push two history states, undo returns to first state exactly', () => {
      const { result } = renderHook(() => useHistory());

      const state1: TemplateZone[] = [
        {
          zone_id: 'zone-1',
          template_id: 'tmpl-001',
          x_mm: 0,
          y_mm: 0,
          width_mm: 1500,
          height_mm: 2400,
          width_strategy: ZoneWidthStrategy.PROPORTIONAL,
          height_strategy: ZoneHeightStrategy.DERIVED_FROM_WALL,
          position_strategy: ZonePositionStrategy.FIXED,
          segment: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      const state2: TemplateZone[] = [
        {
          ...state1[0],
          width_mm: 2000, // Modified
          x_mm: 100,      // Modified
        },
      ];

      // Push initial state
      act(() => {
        result.current.pushState(state1);
      });

      // Push modified state
      act(() => {
        result.current.pushState(state2);
      });

      expect(result.current.canUndo).toBe(true);

      // Undo
      let undoneState: TemplateZone[] | null = null;
      act(() => {
        undoneState = result.current.undo();
      });

      // Verify we get back state1 exactly
      expect(undoneState).not.toBeNull();
      expect(undoneState).toHaveLength(1);
      expect(undoneState![0].width_mm).toBe(1500);
      expect(undoneState![0].x_mm).toBe(0);
    });

    it('undo does not mutate the history entry', () => {
      const { result } = renderHook(() => useHistory());

      const state1: TemplateZone[] = [
        {
          zone_id: 'zone-1',
          template_id: 'tmpl-001',
          x_mm: 0,
          y_mm: 0,
          width_mm: 1500,
          height_mm: 2400,
          width_strategy: ZoneWidthStrategy.PROPORTIONAL,
          height_strategy: ZoneHeightStrategy.DERIVED_FROM_WALL,
          position_strategy: ZonePositionStrategy.FIXED,
          segment: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      const state2: TemplateZone[] = [
        { ...state1[0], width_mm: 2000 },
      ];

      act(() => { result.current.pushState(state1); });
      act(() => { result.current.pushState(state2); });

      // Undo twice -> first returns state1, second returns null (no more)
      let firstUndo: TemplateZone[] | null = null;
      act(() => { firstUndo = result.current.undo(); });

      expect(firstUndo![0].width_mm).toBe(1500);

      // Redo back to state2
      let redoState: TemplateZone[] | null = null;
      act(() => { redoState = result.current.redo(); });

      expect(redoState![0].width_mm).toBe(2000);

      // Undo again should still give us state1 unchanged
      let secondUndo: TemplateZone[] | null = null;
      act(() => { secondUndo = result.current.undo(); });

      expect(secondUndo![0].width_mm).toBe(1500);
    });

    it('push after undo clears redo stack', () => {
      const { result } = renderHook(() => useHistory());

      const state1: TemplateZone[] = [
        {
          zone_id: 'zone-1',
          template_id: 'tmpl-001',
          x_mm: 0,
          y_mm: 0,
          width_mm: 1000,
          height_mm: 2400,
          width_strategy: ZoneWidthStrategy.PROPORTIONAL,
          height_strategy: ZoneHeightStrategy.DERIVED_FROM_WALL,
          position_strategy: ZonePositionStrategy.FIXED,
          segment: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];
      const state2: TemplateZone[] = [{ ...state1[0], width_mm: 2000 }];
      const state3: TemplateZone[] = [{ ...state1[0], width_mm: 3000 }];

      act(() => { result.current.pushState(state1); });
      act(() => { result.current.pushState(state2); });

      // Undo to state1
      act(() => { result.current.undo(); });

      // Push new state3 (should clear state2 from redo)
      act(() => { result.current.pushState(state3); });

      expect(result.current.canRedo).toBe(false);
      expect(result.current.canUndo).toBe(true);
    });
  });
});
