import { describe, it, expect } from 'vitest';
import { generatePanelFrames } from '../wallConfigEngine';
import { EngineError } from '../types';
import type { WallConfigInput } from '../types';

/** Helper to create a basic valid config */
function makeConfig(overrides: Partial<WallConfigInput> = {}): WallConfigInput {
  return {
    wall_type: 'STRAIGHT',
    total_width_mm: 3000,
    total_height_mm: 2400,
    rows: 1,
    columns: 3,
    panel_gap_mm: 0,
    fit_algorithm: 'EQUAL',
    fit_intensity_percent: 0,
    mounting_type: 'DIRECT',
    obstructions: [],
    ...overrides,
  };
}

describe('wallConfigEngine', () => {
  describe('deterministic output', () => {
    it('same input always produces same output', () => {
      const config = makeConfig();
      const result1 = generatePanelFrames(config);
      const result2 = generatePanelFrames(config);
      expect(result1).toEqual(result2);
    });

    it('frame_ids are deterministic based on config and position', () => {
      const config = makeConfig();
      const frames = generatePanelFrames(config);
      expect(frames[0].frame_id).toBeTruthy();
      expect(frames[0].frame_id).toMatch(/^pf-/);
      // Same config yields same IDs
      const frames2 = generatePanelFrames(config);
      expect(frames[0].frame_id).toBe(frames2[0].frame_id);
    });

    it('different configs produce different frame_ids', () => {
      const config1 = makeConfig({ columns: 3 });
      const config2 = makeConfig({ columns: 4 });
      const frames1 = generatePanelFrames(config1);
      const frames2 = generatePanelFrames(config2);
      expect(frames1[0].frame_id).not.toBe(frames2[0].frame_id);
    });
  });

  describe('EQUAL algorithm', () => {
    it('divides wall equally by columns with no gaps', () => {
      const config = makeConfig({ total_width_mm: 3000, columns: 3, panel_gap_mm: 0 });
      const frames = generatePanelFrames(config);
      expect(frames).toHaveLength(3);
      expect(frames[0].width_mm).toBe(1000);
      expect(frames[1].width_mm).toBe(1000);
      expect(frames[2].width_mm).toBe(1000);
    });

    it('accounts for gaps between panels', () => {
      // Available width = 3000 - 2*10 = 2980; per column = 2980/3 = 993.33...
      // After rounding with sum-correction: widths should sum to 2980
      // Math.round(993.33) = 993 for each, sum = 2979, +1 correction on widest -> [994, 993, 993]
      const config = makeConfig({ total_width_mm: 3000, columns: 3, panel_gap_mm: 10 });
      const frames = generatePanelFrames(config);
      expect(frames).toHaveLength(3);
      // All widths should be integers
      frames.forEach((f) => expect(Number.isInteger(f.width_mm)).toBe(true));
      // Sum of widths should equal available width (2980)
      const totalWidth = frames.reduce((sum, f) => sum + f.width_mm, 0);
      expect(totalWidth).toBe(2980);
      // Each panel should be close to 993-994
      frames.forEach((f) => {
        expect(f.width_mm).toBeGreaterThanOrEqual(993);
        expect(f.width_mm).toBeLessThanOrEqual(994);
      });
    });

    it('single column gets full available width', () => {
      const config = makeConfig({ total_width_mm: 3000, columns: 1, panel_gap_mm: 0 });
      const frames = generatePanelFrames(config);
      expect(frames).toHaveLength(1);
      expect(frames[0].width_mm).toBe(3000);
    });

    it('positions panels correctly with gaps', () => {
      const config = makeConfig({ total_width_mm: 1000, columns: 2, panel_gap_mm: 100 });
      const frames = generatePanelFrames(config);
      expect(frames).toHaveLength(2);
      expect(frames[0].x_mm).toBe(0);
      // Panel width = (1000 - 100) / 2 = 450
      expect(frames[0].width_mm).toBe(450);
      expect(frames[1].x_mm).toBe(550); // 450 + 100 gap
      expect(frames[1].width_mm).toBe(450);
    });
  });

  describe('ADJUST_END_PANELS algorithm', () => {
    it('at intensity 0 produces equal panels', () => {
      const config = makeConfig({
        fit_algorithm: 'ADJUST_END_PANELS',
        fit_intensity_percent: 0,
        columns: 4,
      });
      const frames = generatePanelFrames(config);
      const widths = frames.map((f) => f.width_mm);
      // At 0% intensity, all should be equal
      expect(widths[0]).toBeCloseTo(widths[1], 5);
      expect(widths[1]).toBeCloseTo(widths[2], 5);
      expect(widths[2]).toBeCloseTo(widths[3], 5);
    });

    it('at intensity 100 end panels are narrower than center panels', () => {
      const config = makeConfig({
        fit_algorithm: 'ADJUST_END_PANELS',
        fit_intensity_percent: 100,
        columns: 4,
      });
      const frames = generatePanelFrames(config);
      const widths = frames.map((f) => f.width_mm);
      // End panels should be narrower
      expect(widths[0]).toBeLessThan(widths[1]);
      expect(widths[3]).toBeLessThan(widths[2]);
      // Center panels should be wider
      expect(widths[1]).toBeGreaterThan(widths[0]);
    });

    it('total width of all panels equals available width', () => {
      const config = makeConfig({
        fit_algorithm: 'ADJUST_END_PANELS',
        fit_intensity_percent: 75,
        columns: 5,
        panel_gap_mm: 10,
      });
      const frames = generatePanelFrames(config);
      const totalPanelWidth = frames.reduce((sum, f) => sum + f.width_mm, 0);
      const totalGaps = (5 - 1) * 10;
      expect(totalPanelWidth).toBeCloseTo(3000 - totalGaps, 5);
    });
  });

  describe('SPREAD_LEFT algorithm', () => {
    it('leftmost panel is narrower than rightmost at full intensity', () => {
      const config = makeConfig({
        fit_algorithm: 'SPREAD_LEFT',
        fit_intensity_percent: 100,
        columns: 4,
      });
      const frames = generatePanelFrames(config);
      expect(frames[0].width_mm).toBeLessThan(frames[3].width_mm);
    });

    it('widths increase from left to right', () => {
      const config = makeConfig({
        fit_algorithm: 'SPREAD_LEFT',
        fit_intensity_percent: 80,
        columns: 5,
      });
      const frames = generatePanelFrames(config);
      for (let i = 0; i < frames.length - 1; i++) {
        expect(frames[i].width_mm).toBeLessThan(frames[i + 1].width_mm);
      }
    });

    it('total width matches available width', () => {
      const config = makeConfig({
        fit_algorithm: 'SPREAD_LEFT',
        fit_intensity_percent: 100,
        columns: 4,
        panel_gap_mm: 5,
      });
      const frames = generatePanelFrames(config);
      const totalPanelWidth = frames.reduce((sum, f) => sum + f.width_mm, 0);
      const totalGaps = (4 - 1) * 5;
      expect(totalPanelWidth).toBeCloseTo(3000 - totalGaps, 5);
    });
  });

  describe('SPREAD_RIGHT algorithm', () => {
    it('rightmost panel is narrower than leftmost at full intensity', () => {
      const config = makeConfig({
        fit_algorithm: 'SPREAD_RIGHT',
        fit_intensity_percent: 100,
        columns: 4,
      });
      const frames = generatePanelFrames(config);
      expect(frames[3].width_mm).toBeLessThan(frames[0].width_mm);
    });

    it('widths decrease from left to right', () => {
      const config = makeConfig({
        fit_algorithm: 'SPREAD_RIGHT',
        fit_intensity_percent: 80,
        columns: 5,
      });
      const frames = generatePanelFrames(config);
      for (let i = 0; i < frames.length - 1; i++) {
        expect(frames[i].width_mm).toBeGreaterThan(frames[i + 1].width_mm);
      }
    });
  });

  describe('SPREAD_BOTH_ENDS algorithm', () => {
    it('end panels are narrower than center panels', () => {
      const config = makeConfig({
        fit_algorithm: 'SPREAD_BOTH_ENDS',
        fit_intensity_percent: 100,
        columns: 5,
      });
      const frames = generatePanelFrames(config);
      const widths = frames.map((f) => f.width_mm);
      // Center (index 2) should be wider than edges (index 0, 4)
      expect(widths[2]).toBeGreaterThan(widths[0]);
      expect(widths[2]).toBeGreaterThan(widths[4]);
    });

    it('is symmetric', () => {
      const config = makeConfig({
        fit_algorithm: 'SPREAD_BOTH_ENDS',
        fit_intensity_percent: 80,
        columns: 5,
      });
      const frames = generatePanelFrames(config);
      expect(frames[0].width_mm).toBeCloseTo(frames[4].width_mm, 5);
      expect(frames[1].width_mm).toBeCloseTo(frames[3].width_mm, 5);
    });
  });

  describe('CENTRE_FOCUS algorithm', () => {
    it('center panels are wider than outer panels', () => {
      const config = makeConfig({
        fit_algorithm: 'CENTRE_FOCUS',
        fit_intensity_percent: 100,
        columns: 5,
      });
      const frames = generatePanelFrames(config);
      const midIdx = 2;
      expect(frames[midIdx].width_mm).toBeGreaterThan(frames[0].width_mm);
      expect(frames[midIdx].width_mm).toBeGreaterThan(frames[4].width_mm);
    });
  });

  describe('OUTER_FOCUS algorithm', () => {
    it('outer panels are wider than center panels', () => {
      const config = makeConfig({
        fit_algorithm: 'OUTER_FOCUS',
        fit_intensity_percent: 100,
        columns: 5,
      });
      const frames = generatePanelFrames(config);
      const midIdx = 2;
      expect(frames[0].width_mm).toBeGreaterThan(frames[midIdx].width_mm);
      expect(frames[4].width_mm).toBeGreaterThan(frames[midIdx].width_mm);
    });
  });

  describe('ALTERNATING algorithm', () => {
    it('even-indexed panels are wider than odd-indexed at full intensity', () => {
      const config = makeConfig({
        fit_algorithm: 'ALTERNATING',
        fit_intensity_percent: 100,
        columns: 4,
      });
      const frames = generatePanelFrames(config);
      expect(frames[0].width_mm).toBeGreaterThan(frames[1].width_mm);
      expect(frames[2].width_mm).toBeGreaterThan(frames[3].width_mm);
    });

    it('at 0% intensity all panels are equal', () => {
      const config = makeConfig({
        fit_algorithm: 'ALTERNATING',
        fit_intensity_percent: 0,
        columns: 4,
      });
      const frames = generatePanelFrames(config);
      expect(frames[0].width_mm).toBeCloseTo(frames[1].width_mm, 5);
    });
  });

  describe('obstruction handling', () => {
    it('excludes panels that overlap with an obstruction', () => {
      // 3 columns x 1 row, obstruction covers center panel
      const config = makeConfig({
        total_width_mm: 3000,
        columns: 3,
        rows: 1,
        panel_gap_mm: 0,
        obstructions: [
          { x_mm: 1000, y_mm: 0, width_mm: 1000, height_mm: 2400, type: 'WINDOW' },
        ],
      });
      const frames = generatePanelFrames(config);
      // Center panel (1000-2000) overlaps with obstruction (1000-2000)
      expect(frames).toHaveLength(2);
      expect(frames[0].col_index).toBe(0);
      expect(frames[1].col_index).toBe(2);
    });

    it('keeps panels that do not overlap with obstruction', () => {
      const config = makeConfig({
        total_width_mm: 3000,
        columns: 3,
        rows: 1,
        panel_gap_mm: 0,
        obstructions: [
          // Small obstruction that only overlaps the first panel
          { x_mm: 100, y_mm: 100, width_mm: 200, height_mm: 200, type: 'PILLAR' },
        ],
      });
      const frames = generatePanelFrames(config);
      expect(frames).toHaveLength(2); // First panel excluded
      expect(frames[0].col_index).toBe(1);
      expect(frames[1].col_index).toBe(2);
    });

    it('excludes multiple panels if obstruction spans them', () => {
      const config = makeConfig({
        total_width_mm: 4000,
        columns: 4,
        rows: 1,
        panel_gap_mm: 0,
        obstructions: [
          // Wide door spanning panels 1 and 2 (1000-3000)
          { x_mm: 500, y_mm: 0, width_mm: 2500, height_mm: 2400, type: 'DOOR' },
        ],
      });
      const frames = generatePanelFrames(config);
      // Each panel is 1000mm wide: 0-1000, 1000-2000, 2000-3000, 3000-4000
      // Obstruction at 500-3000 overlaps panels 0(0-1000), 1(1000-2000), 2(2000-3000)
      expect(frames).toHaveLength(1);
      expect(frames[0].col_index).toBe(3);
    });

    it('handles multiple obstructions', () => {
      const config = makeConfig({
        total_width_mm: 5000,
        columns: 5,
        rows: 1,
        panel_gap_mm: 0,
        obstructions: [
          { x_mm: 0, y_mm: 0, width_mm: 500, height_mm: 2400, type: 'PILLAR' },
          { x_mm: 3500, y_mm: 0, width_mm: 500, height_mm: 2400, type: 'PILLAR' },
        ],
      });
      const frames = generatePanelFrames(config);
      // Each panel 1000mm: 0-1000, 1000-2000, 2000-3000, 3000-4000, 4000-5000
      // First obstruction (0-500) overlaps panel 0 (0-1000)
      // Second obstruction (3500-4000) overlaps panel 3 (3000-4000)
      expect(frames).toHaveLength(3);
      expect(frames.map((f) => f.col_index)).toEqual([1, 2, 4]);
    });

    it('row-level obstruction only removes affected rows', () => {
      const config = makeConfig({
        total_width_mm: 2000,
        total_height_mm: 2000,
        columns: 2,
        rows: 2,
        panel_gap_mm: 0,
        obstructions: [
          // Obstruction only in bottom row, left panel
          { x_mm: 0, y_mm: 0, width_mm: 500, height_mm: 500, type: 'CUSTOM' },
        ],
      });
      const frames = generatePanelFrames(config);
      // Row height = 1000, panel width = 1000
      // Row 0 panels at y=0: (0,0,1000,1000) and (1000,0,1000,1000)
      // Row 1 panels at y=1000: (0,1000,1000,1000) and (1000,1000,1000,1000)
      // Obstruction (0,0,500,500) overlaps row 0 col 0 panel
      expect(frames).toHaveLength(3);
    });
  });

  describe('row logic', () => {
    it('divides height equally by rows', () => {
      const config = makeConfig({ total_height_mm: 2400, rows: 2, panel_gap_mm: 0 });
      const frames = generatePanelFrames(config);
      expect(frames[0].height_mm).toBe(1200);
      // Check second row
      const row1Frame = frames.find((f) => f.row_index === 1);
      expect(row1Frame?.height_mm).toBe(1200);
    });

    it('accounts for vertical gaps between rows', () => {
      const config = makeConfig({ total_height_mm: 2400, rows: 2, panel_gap_mm: 10, columns: 1 });
      const frames = generatePanelFrames(config);
      // Available height = 2400 - 1*10 = 2390, row height = 1195
      expect(frames[0].height_mm).toBeCloseTo(1195, 5);
      expect(frames[1].height_mm).toBeCloseTo(1195, 5);
      // Second row y position
      expect(frames[1].y_mm).toBeCloseTo(1195 + 10, 5);
    });

    it('multiple rows and columns produce correct grid', () => {
      const config = makeConfig({
        total_width_mm: 2000,
        total_height_mm: 2000,
        rows: 2,
        columns: 2,
        panel_gap_mm: 0,
      });
      const frames = generatePanelFrames(config);
      expect(frames).toHaveLength(4);
      // All panels 1000x1000
      expect(frames.every((f) => f.width_mm === 1000)).toBe(true);
      expect(frames.every((f) => f.height_mm === 1000)).toBe(true);
    });
  });

  describe('Rule 63: panel_gap_mm is independent from SKU joint gaps', () => {
    it('uses panel_gap_mm for frame spacing (not SKU gh_mm/gv_mm)', () => {
      // This tests the structural gap is applied correctly
      const config = makeConfig({
        total_width_mm: 1000,
        columns: 2,
        panel_gap_mm: 20,
      });
      const frames = generatePanelFrames(config);
      // Available = 1000 - 20 = 980, panel width = 490 each
      expect(frames[0].width_mm).toBe(490);
      expect(frames[1].x_mm).toBe(510); // 490 + 20 gap
      expect(frames[1].width_mm).toBe(490);
    });
  });

  describe('Rule 69: minimum 50mm dimension', () => {
    it('throws EngineError when panel width would be below 50mm', () => {
      // 100mm wall / 3 columns = 33.3mm per panel < 50mm
      const config = makeConfig({
        total_width_mm: 100,
        columns: 3,
        panel_gap_mm: 0,
      });
      expect(() => generatePanelFrames(config)).toThrow(EngineError);
      expect(() => generatePanelFrames(config)).toThrow(/below minimum 50mm/);
    });

    it('throws EngineError when panel height would be below 50mm', () => {
      // 80mm height / 2 rows = 40mm per row < 50mm
      const config = makeConfig({
        total_height_mm: 80,
        rows: 2,
        panel_gap_mm: 0,
      });
      expect(() => generatePanelFrames(config)).toThrow(EngineError);
      expect(() => generatePanelFrames(config)).toThrow(/below minimum 50mm/);
    });

    it('boundary: exactly 50mm width does not throw', () => {
      const config = makeConfig({
        total_width_mm: 150,
        columns: 3,
        panel_gap_mm: 0,
      });
      const frames = generatePanelFrames(config);
      expect(frames[0].width_mm).toBe(50);
    });

    it('boundary: exactly 50mm height does not throw', () => {
      const config = makeConfig({
        total_height_mm: 50,
        rows: 1,
        panel_gap_mm: 0,
      });
      const frames = generatePanelFrames(config);
      expect(frames[0].height_mm).toBe(50);
    });

    it('throws when fit algorithm produces panel below 50mm', () => {
      // SPREAD_LEFT at full intensity with many columns - leftmost might go below 50mm
      const config = makeConfig({
        total_width_mm: 500,
        columns: 5,
        fit_algorithm: 'SPREAD_LEFT',
        fit_intensity_percent: 100,
        panel_gap_mm: 0,
      });
      // With 5 columns in 500mm, equal = 100mm each
      // SPREAD_LEFT at 100%: leftmost = 100*(1 + 1*(-0.5)) = 50mm, which is at boundary
      // This should not throw since it equals exactly 50mm
      const frames = generatePanelFrames(config);
      expect(frames.length).toBeGreaterThan(0);
    });
  });

  describe('L_CORNER walls', () => {
    it('assigns SEGMENT_A to panels on left side', () => {
      const config = makeConfig({
        wall_type: 'L_CORNER',
        total_width_mm: 4000,
        columns: 4,
        panel_gap_mm: 0,
        segment_a_width_mm: 2000,
        segment_b_width_mm: 2000,
      });
      const frames = generatePanelFrames(config);
      // Each panel is 1000mm wide
      // Panels at 0-1000 and 1000-2000 have midpoints 500 and 1500 -> SEGMENT_A
      expect(frames[0].segment).toBe('SEGMENT_A');
      expect(frames[1].segment).toBe('SEGMENT_A');
    });

    it('assigns SEGMENT_B to panels on right side', () => {
      const config = makeConfig({
        wall_type: 'L_CORNER',
        total_width_mm: 4000,
        columns: 4,
        panel_gap_mm: 0,
        segment_a_width_mm: 2000,
        segment_b_width_mm: 2000,
      });
      const frames = generatePanelFrames(config);
      // Panels at 2000-3000 and 3000-4000 have midpoints 2500 and 3500 -> SEGMENT_B
      expect(frames[2].segment).toBe('SEGMENT_B');
      expect(frames[3].segment).toBe('SEGMENT_B');
    });

    it('throws for L_CORNER without segment dimensions', () => {
      const config = makeConfig({
        wall_type: 'L_CORNER',
        total_width_mm: 4000,
        columns: 4,
        panel_gap_mm: 0,
      });
      expect(() => generatePanelFrames(config)).toThrow(EngineError);
      expect(() => generatePanelFrames(config)).toThrow(/L_CORNER/);
    });
  });

  describe('edge cases', () => {
    it('1 column, 1 row produces a single panel', () => {
      const config = makeConfig({ columns: 1, rows: 1, panel_gap_mm: 0 });
      const frames = generatePanelFrames(config);
      expect(frames).toHaveLength(1);
      expect(frames[0].width_mm).toBe(3000);
      expect(frames[0].height_mm).toBe(2400);
      expect(frames[0].is_edge_panel).toBe(true);
    });

    it('all panels are edge panels in a 1-row grid', () => {
      const config = makeConfig({ columns: 5, rows: 1, panel_gap_mm: 0 });
      const frames = generatePanelFrames(config);
      // In a single row, all panels have row_index 0 (first and last row)
      expect(frames.every((f) => f.is_edge_panel)).toBe(true);
    });

    it('inner panels are not edge panels in a 3x3 grid', () => {
      const config = makeConfig({
        total_width_mm: 3000,
        total_height_mm: 3000,
        columns: 3,
        rows: 3,
        panel_gap_mm: 0,
      });
      const frames = generatePanelFrames(config);
      expect(frames).toHaveLength(9);
      const centerPanel = frames.find((f) => f.row_index === 1 && f.col_index === 1);
      expect(centerPanel?.is_edge_panel).toBe(false);
      // Edges
      const topLeft = frames.find((f) => f.row_index === 0 && f.col_index === 0);
      expect(topLeft?.is_edge_panel).toBe(true);
    });

    it('max columns produce many thin panels', () => {
      const config = makeConfig({
        total_width_mm: 5000,
        columns: 50,
        panel_gap_mm: 0,
      });
      const frames = generatePanelFrames(config);
      expect(frames).toHaveLength(50);
      expect(frames[0].width_mm).toBe(100);
    });

    it('panel positions are contiguous (no gaps unaccounted for)', () => {
      const config = makeConfig({
        total_width_mm: 3000,
        columns: 4,
        panel_gap_mm: 20,
      });
      const frames = generatePanelFrames(config);
      // Total should be: sum(widths) + 3*20 = 3000
      const totalPanelWidth = frames.reduce((sum, f) => sum + f.width_mm, 0);
      expect(totalPanelWidth + 3 * 20).toBeCloseTo(3000, 5);
    });
  });

  describe('input validation', () => {
    it('throws for zero width', () => {
      expect(() => generatePanelFrames(makeConfig({ total_width_mm: 0 }))).toThrow(EngineError);
    });

    it('throws for negative width', () => {
      expect(() => generatePanelFrames(makeConfig({ total_width_mm: -100 }))).toThrow(EngineError);
    });

    it('throws for zero height', () => {
      expect(() => generatePanelFrames(makeConfig({ total_height_mm: 0 }))).toThrow(EngineError);
    });

    it('throws for negative height', () => {
      expect(() => generatePanelFrames(makeConfig({ total_height_mm: -100 }))).toThrow(EngineError);
    });

    it('throws for zero columns', () => {
      expect(() => generatePanelFrames(makeConfig({ columns: 0 }))).toThrow(EngineError);
    });

    it('throws for zero rows', () => {
      expect(() => generatePanelFrames(makeConfig({ rows: 0 }))).toThrow(EngineError);
    });

    it('throws for negative gap', () => {
      expect(() => generatePanelFrames(makeConfig({ panel_gap_mm: -5 }))).toThrow(EngineError);
    });

    it('throws for intensity below 0', () => {
      expect(() =>
        generatePanelFrames(makeConfig({ fit_intensity_percent: -1 })),
      ).toThrow(EngineError);
    });

    it('throws for intensity above 100', () => {
      expect(() =>
        generatePanelFrames(makeConfig({ fit_intensity_percent: 101 })),
      ).toThrow(EngineError);
    });

    it('throws when gaps exceed wall width', () => {
      expect(() =>
        generatePanelFrames(makeConfig({ total_width_mm: 100, columns: 10, panel_gap_mm: 20 })),
      ).toThrow(EngineError);
      expect(() =>
        generatePanelFrames(makeConfig({ total_width_mm: 100, columns: 10, panel_gap_mm: 20 })),
      ).toThrow(/exceed/);
    });

    it('throws when gaps exceed wall height', () => {
      expect(() =>
        generatePanelFrames(makeConfig({ total_height_mm: 100, rows: 10, panel_gap_mm: 20 })),
      ).toThrow(EngineError);
    });
  });

  describe('is_edge_panel property', () => {
    it('marks first and last row/column panels as edge', () => {
      const config = makeConfig({
        total_width_mm: 2000,
        total_height_mm: 2000,
        columns: 3,
        rows: 3,
        panel_gap_mm: 0,
      });
      const frames = generatePanelFrames(config);
      // All border panels should be edge
      const edgePanels = frames.filter((f) => f.is_edge_panel);
      const innerPanels = frames.filter((f) => !f.is_edge_panel);
      expect(edgePanels).toHaveLength(8); // 9 - 1 center = 8
      expect(innerPanels).toHaveLength(1);
    });
  });

  describe('fit intensity scaling', () => {
    it('higher intensity produces more variation in panel widths', () => {
      const config50 = makeConfig({
        fit_algorithm: 'CENTRE_FOCUS',
        fit_intensity_percent: 50,
        columns: 5,
      });
      const config100 = makeConfig({
        fit_algorithm: 'CENTRE_FOCUS',
        fit_intensity_percent: 100,
        columns: 5,
      });

      const frames50 = generatePanelFrames(config50);
      const frames100 = generatePanelFrames(config100);

      // Calculate variance
      const mean50 = 3000 / 5;
      const variance50 = frames50.reduce(
        (sum, f) => sum + Math.pow(f.width_mm - mean50, 2),
        0,
      ) / frames50.length;

      const mean100 = 3000 / 5;
      const variance100 = frames100.reduce(
        (sum, f) => sum + Math.pow(f.width_mm - mean100, 2),
        0,
      ) / frames100.length;

      expect(variance100).toBeGreaterThan(variance50);
    });
  });
});
