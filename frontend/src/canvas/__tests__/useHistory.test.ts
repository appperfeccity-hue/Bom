import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistory, resetHistory } from '@/canvas/history/useHistory';
import type { TemplateZone } from '@/types/database';

const makeZone = (id: string, x: number = 0, y: number = 0): TemplateZone => ({
  id,
  template_id: 'tmpl-1',
  name: `Zone ${id}`,
  x_mm: x,
  y_mm: y,
  width_mm: 400,
  height_mm: 400,
  width_strategy: 'FIXED' as never,
  height_strategy: 'FIXED' as never,
  position_strategy: 'ABSOLUTE' as never,
  z_index: 0,
  created_at: '',
  updated_at: '',
});

describe('useHistory', () => {
  beforeEach(() => {
    resetHistory();
  });

  it('initial state has canUndo=false and canRedo=false', () => {
    const { result } = renderHook(() => useHistory());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('after two pushState calls, canUndo becomes true', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.pushState([makeZone('z1', 0, 0)]);
      result.current.pushState([makeZone('z1', 100, 0)]);
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('undo returns previous state', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.pushState([makeZone('z1', 0, 0)]);
      result.current.pushState([makeZone('z1', 100, 0)]);
    });

    let undoResult: ReturnType<typeof result.current.undo> = null;
    act(() => {
      undoResult = result.current.undo();
    });

    expect(undoResult).not.toBeNull();
    expect(undoResult![0].x_mm).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('redo returns next state after undo', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.pushState([makeZone('z1', 0, 0)]);
      result.current.pushState([makeZone('z1', 100, 0)]);
    });

    act(() => {
      result.current.undo();
    });

    let redoResult: ReturnType<typeof result.current.redo> = null;
    act(() => {
      redoResult = result.current.redo();
    });

    expect(redoResult).not.toBeNull();
    expect(redoResult![0].x_mm).toBe(100);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('new pushState after undo clears redo stack', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.pushState([makeZone('z1', 0, 0)]);
      result.current.pushState([makeZone('z1', 100, 0)]);
    });

    act(() => {
      result.current.undo();
    });

    // Push a new state - clears redo
    act(() => {
      result.current.pushState([makeZone('z1', 200, 0)]);
    });

    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(true);

    // Undo should go back to initial state (zones1), not zones2
    let undoResult: ReturnType<typeof result.current.undo> = null;
    act(() => {
      undoResult = result.current.undo();
    });

    expect(undoResult![0].x_mm).toBe(0);
  });

  it('max stack size is respected', () => {
    const { result } = renderHook(() => useHistory());

    // Push 55 states in a single act to avoid excessive re-renders
    act(() => {
      for (let i = 0; i < 55; i++) {
        result.current.pushState([makeZone('z1', i * 10, 0)]);
      }
    });

    // Should be able to undo at most 49 times (50 entries max, cursor at 49, can go to 0)
    let undoCount = 0;
    act(() => {
      let state = result.current.undo();
      while (state !== null) {
        undoCount++;
        state = result.current.undo();
      }
    });

    expect(undoCount).toBe(49);
  });

  it('undo returns null when at beginning of stack', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.pushState([makeZone('z1')]);
    });

    let undoResult: ReturnType<typeof result.current.undo> = null;
    act(() => {
      undoResult = result.current.undo();
    });

    expect(undoResult).toBeNull();
  });

  it('redo returns null when at end of stack', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.pushState([makeZone('z1')]);
    });

    let redoResult: ReturnType<typeof result.current.redo> = null;
    act(() => {
      redoResult = result.current.redo();
    });

    expect(redoResult).toBeNull();
  });

  it('pushState creates a deep copy', () => {
    const { result } = renderHook(() => useHistory());
    const zones = [makeZone('z1', 0, 0)];

    act(() => {
      result.current.pushState(zones);
    });

    // Mutate the original
    zones[0].x_mm = 999;

    act(() => {
      result.current.pushState([makeZone('z1', 100, 0)]);
    });

    let undoResult: ReturnType<typeof result.current.undo> = null;
    act(() => {
      undoResult = result.current.undo();
    });

    // Should get the original value, not the mutated one
    expect(undoResult![0].x_mm).toBe(0);
  });

  it('resetHistory clears all state so canUndo is false', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.pushState([makeZone('z1', 0, 0)]);
      result.current.pushState([makeZone('z1', 100, 0)]);
    });

    expect(result.current.canUndo).toBe(true);

    act(() => {
      resetHistory();
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('subscriber is cleaned up on unmount', () => {
    const { result, unmount } = renderHook(() => useHistory());

    act(() => {
      result.current.pushState([makeZone('z1', 0, 0)]);
      result.current.pushState([makeZone('z1', 100, 0)]);
    });

    expect(result.current.canUndo).toBe(true);

    // Unmount should clean up the subscriber without errors
    unmount();

    // After unmount, calling resetHistory should not throw
    // (it notifies subscribers, but the unmounted one should be removed)
    expect(() => resetHistory()).not.toThrow();
  });
});
