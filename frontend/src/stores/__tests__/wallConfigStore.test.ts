import { describe, it, expect, beforeEach } from 'vitest';
import { useWallConfigStore } from '../wallConfigStore';
import type { WallConfigInput, Obstruction } from '@/engines/types';

/**
 * Tests for wallConfigStore:
 * - State management (config, permissions, frames)
 * - regenerateFrames produces deterministic output
 * - Undo/redo on config changes
 * - Obstruction CRUD
 * - Permission management
 */

describe('wallConfigStore', () => {
  beforeEach(() => {
    useWallConfigStore.getState().reset();
  });

  describe('initial state', () => {
    it('has default wall configuration', () => {
      const state = useWallConfigStore.getState();
      expect(state.config.wall_type).toBe('STRAIGHT');
      expect(state.config.total_width_mm).toBe(3000);
      expect(state.config.total_height_mm).toBe(2400);
      expect(state.config.rows).toBe(1);
      expect(state.config.columns).toBe(3);
      expect(state.config.panel_gap_mm).toBe(0);
      expect(state.config.fit_algorithm).toBe('EQUAL');
      expect(state.config.fit_intensity_percent).toBe(0);
      expect(state.config.mounting_type).toBe('DIRECT');
      expect(state.config.obstructions).toEqual([]);
    });

    it('generates initial panel frames from default config', () => {
      const state = useWallConfigStore.getState();
      expect(state.panelFrames.length).toBe(3); // 1 row x 3 columns
      expect(state.generationError).toBeNull();
    });

    it('has all permissions LOCKED by default', () => {
      const state = useWallConfigStore.getState();
      expect(state.permissions.wall_width).toBe('LOCKED');
      expect(state.permissions.wall_height).toBe('LOCKED');
      expect(state.permissions.panel_gap).toBe('LOCKED');
      expect(state.permissions.fit_algorithm).toBe('LOCKED');
      expect(state.permissions.fit_intensity).toBe('LOCKED');
      expect(state.permissions.mounting_type).toBe('LOCKED');
      expect(state.permissions.rows).toBe('LOCKED');
      expect(state.permissions.columns).toBe('LOCKED');
    });

    it('has empty undo/redo stacks', () => {
      const state = useWallConfigStore.getState();
      expect(state.undoStack.length).toBe(0);
      expect(state.redoStack.length).toBe(0);
    });
  });

  describe('setWallConfig', () => {
    it('updates config partially and regenerates frames', () => {
      useWallConfigStore.getState().setWallConfig({ columns: 5 });
      const state = useWallConfigStore.getState();
      expect(state.config.columns).toBe(5);
      expect(state.panelFrames.length).toBe(5); // 1 row x 5 columns
    });

    it('preserves unmodified fields', () => {
      useWallConfigStore.getState().setWallConfig({ columns: 4 });
      const state = useWallConfigStore.getState();
      expect(state.config.total_width_mm).toBe(3000);
      expect(state.config.total_height_mm).toBe(2400);
      expect(state.config.fit_algorithm).toBe('EQUAL');
    });

    it('stores generation error on invalid config', () => {
      useWallConfigStore.getState().setWallConfig({
        total_width_mm: 10,
        columns: 100, // Would produce panels below 50mm
      });
      const state = useWallConfigStore.getState();
      expect(state.generationError).not.toBeNull();
      expect(state.panelFrames.length).toBe(0);
    });

    it('pushes previous state to undo stack', () => {
      useWallConfigStore.getState().setWallConfig({ columns: 4 });
      const state = useWallConfigStore.getState();
      expect(state.undoStack.length).toBe(1);
      expect(state.undoStack[0].config.columns).toBe(3); // Previous value
    });

    it('clears redo stack on new change', () => {
      const store = useWallConfigStore.getState();
      store.setWallConfig({ columns: 4 });
      store.undo();
      // After undo, redo stack has 1 entry
      expect(useWallConfigStore.getState().redoStack.length).toBe(1);
      // New change clears redo
      useWallConfigStore.getState().setWallConfig({ columns: 5 });
      expect(useWallConfigStore.getState().redoStack.length).toBe(0);
    });
  });

  describe('deterministic output', () => {
    it('same config always produces same frames', () => {
      const config: Partial<WallConfigInput> = {
        total_width_mm: 2000,
        total_height_mm: 1800,
        rows: 2,
        columns: 4,
        panel_gap_mm: 10,
        fit_algorithm: 'EQUAL',
      };

      useWallConfigStore.getState().setWallConfig(config);
      const frames1 = useWallConfigStore.getState().panelFrames;

      // Reset and reapply
      useWallConfigStore.getState().reset();
      useWallConfigStore.getState().setWallConfig(config);
      const frames2 = useWallConfigStore.getState().panelFrames;

      expect(frames1).toEqual(frames2);
    });

    it('regenerateFrames produces same output without config change', () => {
      useWallConfigStore.getState().setWallConfig({ columns: 4, rows: 2 });
      const framesBefore = useWallConfigStore.getState().panelFrames;

      useWallConfigStore.getState().regenerateFrames();
      const framesAfter = useWallConfigStore.getState().panelFrames;

      expect(framesBefore).toEqual(framesAfter);
    });
  });

  describe('obstructions', () => {
    it('addObstruction appends to config and regenerates frames', () => {
      const obs: Obstruction = {
        x_mm: 100,
        y_mm: 100,
        width_mm: 200,
        height_mm: 200,
        type: 'WINDOW',
      };

      useWallConfigStore.getState().addObstruction(obs);
      const state = useWallConfigStore.getState();
      expect(state.config.obstructions.length).toBe(1);
      expect(state.config.obstructions[0]).toEqual(obs);
    });

    it('removeObstruction removes by index', () => {
      const obs1: Obstruction = { x_mm: 0, y_mm: 0, width_mm: 100, height_mm: 100, type: 'DOOR' };
      const obs2: Obstruction = { x_mm: 500, y_mm: 500, width_mm: 100, height_mm: 100, type: 'PILLAR' };

      const store = useWallConfigStore.getState();
      store.addObstruction(obs1);
      useWallConfigStore.getState().addObstruction(obs2);

      useWallConfigStore.getState().removeObstruction(0);
      const state = useWallConfigStore.getState();
      expect(state.config.obstructions.length).toBe(1);
      expect(state.config.obstructions[0]).toEqual(obs2);
    });

    it('updateObstruction replaces obstruction at index', () => {
      const obs: Obstruction = { x_mm: 0, y_mm: 0, width_mm: 100, height_mm: 100, type: 'DOOR' };
      useWallConfigStore.getState().addObstruction(obs);

      const updated: Obstruction = { x_mm: 200, y_mm: 200, width_mm: 300, height_mm: 300, type: 'CUSTOM' };
      useWallConfigStore.getState().updateObstruction(0, updated);

      const state = useWallConfigStore.getState();
      expect(state.config.obstructions[0]).toEqual(updated);
    });

    it('obstruction operations push to undo stack', () => {
      const obs: Obstruction = { x_mm: 0, y_mm: 0, width_mm: 100, height_mm: 100, type: 'WINDOW' };
      useWallConfigStore.getState().addObstruction(obs);
      expect(useWallConfigStore.getState().undoStack.length).toBe(1);

      useWallConfigStore.getState().removeObstruction(0);
      expect(useWallConfigStore.getState().undoStack.length).toBe(2);
    });
  });

  describe('undo/redo', () => {
    it('undo reverts to previous config', () => {
      useWallConfigStore.getState().setWallConfig({ columns: 5 });
      expect(useWallConfigStore.getState().config.columns).toBe(5);

      useWallConfigStore.getState().undo();
      expect(useWallConfigStore.getState().config.columns).toBe(3); // Default
    });

    it('redo restores the undone change', () => {
      useWallConfigStore.getState().setWallConfig({ columns: 5 });
      useWallConfigStore.getState().undo();
      useWallConfigStore.getState().redo();
      expect(useWallConfigStore.getState().config.columns).toBe(5);
    });

    it('multiple undo/redo cycles work correctly', () => {
      useWallConfigStore.getState().setWallConfig({ columns: 4 });
      useWallConfigStore.getState().setWallConfig({ columns: 5 });
      useWallConfigStore.getState().setWallConfig({ columns: 6 });

      useWallConfigStore.getState().undo();
      expect(useWallConfigStore.getState().config.columns).toBe(5);

      useWallConfigStore.getState().undo();
      expect(useWallConfigStore.getState().config.columns).toBe(4);

      useWallConfigStore.getState().redo();
      expect(useWallConfigStore.getState().config.columns).toBe(5);
    });

    it('undo does nothing when stack is empty', () => {
      const stateBefore = useWallConfigStore.getState().config;
      useWallConfigStore.getState().undo();
      expect(useWallConfigStore.getState().config).toEqual(stateBefore);
    });

    it('redo does nothing when stack is empty', () => {
      useWallConfigStore.getState().setWallConfig({ columns: 5 });
      const stateBefore = useWallConfigStore.getState().config;
      useWallConfigStore.getState().redo();
      expect(useWallConfigStore.getState().config).toEqual(stateBefore);
    });

    it('canUndo returns correct boolean', () => {
      expect(useWallConfigStore.getState().canUndo()).toBe(false);
      useWallConfigStore.getState().setWallConfig({ columns: 4 });
      expect(useWallConfigStore.getState().canUndo()).toBe(true);
    });

    it('canRedo returns correct boolean', () => {
      expect(useWallConfigStore.getState().canRedo()).toBe(false);
      useWallConfigStore.getState().setWallConfig({ columns: 4 });
      useWallConfigStore.getState().undo();
      expect(useWallConfigStore.getState().canRedo()).toBe(true);
    });

    it('undo regenerates frames from previous config', () => {
      useWallConfigStore.getState().setWallConfig({ columns: 5 });
      expect(useWallConfigStore.getState().panelFrames.length).toBe(5);

      useWallConfigStore.getState().undo();
      expect(useWallConfigStore.getState().panelFrames.length).toBe(3); // Default 3 columns
    });
  });

  describe('permissions', () => {
    it('setPermission updates a single parameter permission', () => {
      useWallConfigStore.getState().setPermission('wall_width', 'ALLOWED');
      const state = useWallConfigStore.getState();
      expect(state.permissions.wall_width).toBe('ALLOWED');
      expect(state.permissions.wall_height).toBe('LOCKED'); // Others unchanged
    });

    it('setPermissions replaces all permissions', () => {
      useWallConfigStore.getState().setPermissions({
        wall_width: 'ALLOWED',
        wall_height: 'ALLOWED',
        panel_gap: 'LOCKED',
        fit_algorithm: 'ALLOWED',
        fit_intensity: 'LOCKED',
        mounting_type: 'LOCKED',
        rows: 'LOCKED',
        columns: 'ALLOWED',
      });

      const state = useWallConfigStore.getState();
      expect(state.permissions.wall_width).toBe('ALLOWED');
      expect(state.permissions.wall_height).toBe('ALLOWED');
      expect(state.permissions.panel_gap).toBe('LOCKED');
      expect(state.permissions.fit_algorithm).toBe('ALLOWED');
      expect(state.permissions.columns).toBe('ALLOWED');
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      useWallConfigStore.getState().setWallConfig({ columns: 5, rows: 3 });
      useWallConfigStore.getState().setPermission('wall_width', 'ALLOWED');
      useWallConfigStore.getState().addObstruction({
        x_mm: 0, y_mm: 0, width_mm: 100, height_mm: 100, type: 'DOOR',
      });

      useWallConfigStore.getState().reset();
      const state = useWallConfigStore.getState();

      expect(state.config.columns).toBe(3);
      expect(state.config.rows).toBe(1);
      expect(state.config.obstructions.length).toBe(0);
      expect(state.permissions.wall_width).toBe('LOCKED');
      expect(state.undoStack.length).toBe(0);
      expect(state.redoStack.length).toBe(0);
      expect(state.panelFrames.length).toBe(3); // 1 row x 3 columns
    });
  });

  describe('frame generation with different algorithms', () => {
    it('EQUAL algorithm produces equal-width frames', () => {
      useWallConfigStore.getState().setWallConfig({
        columns: 4,
        total_width_mm: 2000,
        fit_algorithm: 'EQUAL',
      });

      const { panelFrames } = useWallConfigStore.getState();
      expect(panelFrames.length).toBe(4);
      const widths = panelFrames.map((f) => f.width_mm);
      // All should be equal (500mm each)
      expect(widths.every((w) => Math.abs(w - 500) < 0.01)).toBe(true);
    });

    it('ALTERNATING algorithm produces alternating widths', () => {
      useWallConfigStore.getState().setWallConfig({
        columns: 4,
        total_width_mm: 2000,
        fit_algorithm: 'ALTERNATING',
        fit_intensity_percent: 50,
      });

      const { panelFrames } = useWallConfigStore.getState();
      expect(panelFrames.length).toBe(4);
      // With 50% intensity, even-indexed should be wider than odd-indexed
      expect(panelFrames[0].width_mm).toBeGreaterThan(panelFrames[1].width_mm);
      expect(panelFrames[2].width_mm).toBeGreaterThan(panelFrames[3].width_mm);
    });
  });
});
