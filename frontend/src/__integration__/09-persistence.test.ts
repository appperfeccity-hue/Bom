/**
 * Integration Test Area 9: Persistence
 *
 * Validates that:
 * - sortKeysDeep produces deterministic canonical form (save/reload hash stability)
 * - Snapshot -> runBomPipeline is reproducible (same snapshot always yields same BOM)
 * - Undo does not corrupt state (push two states, undo, verify previous state matches)
 *
 * Note: Snapshot building moved server-side in v1.1.8. Hash determinism is tested
 * via sortKeysDeep (the canonical sorting utility) rather than computeSnapshotHash.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { sortKeysDeep } from '@/lib/snapshotBuilder';
import { runBomPipeline } from '@/engines/bomPipeline';
import { useHistory, resetHistory } from '@/canvas/history/useHistory';
import type { TemplateZone } from '@/types/database';
import { ZoneWidthStrategy, ZoneHeightStrategy, ZonePositionStrategy } from '@/types/database';
import { createStraightWallPipelineInput, createMultiZoneMultiSkuPipelineInput } from './helpers/fixtures';

describe('Integration Area 9: Persistence', () => {
  describe('Save -> Reload produces identical canonical form', () => {
    it('sortKeysDeep -> JSON.stringify -> repeat -> identical string', () => {
      const snapshotData = {
        wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2400 },
        base_dimensions: { width_mm: 3000, height_mm: 2400 },
        zones: [
          { zone_id: 'z-persist-1', x_mm: 0, width_mm: 1500, primary_sku: { sku_id: 'sku-walnut-001', material: 'Walnut' } },
          { zone_id: 'z-persist-2', x_mm: 1500, width_mm: 1500, primary_sku: { sku_id: 'sku-walnut-002', material: 'Walnut' } },
        ],
        lighting: [],
        furniture: [],
        trims: [],
        hidden_components: [],
        calculation_parameters: {},
      };

      // Simulate "save": canonical form
      const canonical1 = JSON.stringify(sortKeysDeep(snapshotData));

      // Simulate "reload": same data, produce canonical form again
      const canonical2 = JSON.stringify(sortKeysDeep(snapshotData));

      expect(canonical1).toBe(canonical2);
    });

    it('canonical form is stable regardless of key insertion order', () => {
      const data1 = { zones: [{ width_mm: 1500, zone_id: 'z-1' }], wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000 } };
      const data2 = { wall_geometry: { base_width_mm: 3000, type: 'STRAIGHT' }, zones: [{ zone_id: 'z-1', width_mm: 1500 }] };

      const canonical1 = JSON.stringify(sortKeysDeep(data1));
      const canonical2 = JSON.stringify(sortKeysDeep(data2));
      const canonical3 = JSON.stringify(sortKeysDeep(data1));

      expect(canonical1).toBe(canonical2);
      expect(canonical2).toBe(canonical3);
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
