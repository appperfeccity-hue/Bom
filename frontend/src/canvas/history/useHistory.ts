import { useCallback, useEffect, useState } from 'react';
import type { TemplateZone } from '@/types/database';

/** Maximum number of history entries to retain. */
const MAX_HISTORY_SIZE = 50;

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  pushState: (zones: TemplateZone[]) => void;
  undo: () => TemplateZone[] | null;
  redo: () => TemplateZone[] | null;
}

/**
 * Module-level history stack (singleton).
 * This allows the history to be shared across components (CanvasContainer + Toolbar)
 * without prop drilling or React context.
 */
let stack: TemplateZone[][] = [];
let cursor = -1;

/** Subscribers that get notified when history changes. */
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((fn) => fn());
}

/** Reset history state (useful for testing). */
export function resetHistory() {
  stack = [];
  cursor = -1;
  notifySubscribers();
}

/**
 * Custom hook that manages an undo/redo stack of TemplateZone[] snapshots.
 *
 * The hook does NOT directly mutate projectStore - it returns the state
 * to apply so the caller can decide how to apply it.
 *
 * Stack management:
 * - pushState() records a deep-copy snapshot
 * - undo() moves back in the stack and returns the previous state
 * - redo() moves forward in the stack and returns the next state
 * - New pushState() after undo clears the redo stack (forward entries)
 * - Stack is capped at MAX_HISTORY_SIZE entries
 */
export function useHistory(): HistoryState {
  // Use a counter state to force re-renders when history changes
  const [, setTick] = useState(0);

  // Subscribe this component instance to history changes from other components
  const forceUpdate = useCallback(() => setTick((t) => t + 1), []);

  // Register subscriber on mount and clean up on unmount
  useEffect(() => {
    subscribers.add(forceUpdate);
    return () => {
      subscribers.delete(forceUpdate);
    };
  }, [forceUpdate]);

  const canUndo = cursor > 0;
  const canRedo = cursor < stack.length - 1;

  const pushState = useCallback((zones: TemplateZone[]) => {
    // Deep copy the zone array (each zone is a plain object)
    const snapshot = zones.map((z) => ({ ...z }));

    // If we're not at the end of the stack, truncate forward entries
    if (cursor < stack.length - 1) {
      stack = stack.slice(0, cursor + 1);
    }

    stack.push(snapshot);

    // Enforce max size by dropping oldest entries
    if (stack.length > MAX_HISTORY_SIZE) {
      const excess = stack.length - MAX_HISTORY_SIZE;
      stack = stack.slice(excess);
    }

    cursor = stack.length - 1;
    notifySubscribers();
  }, []);

  const undo = useCallback((): TemplateZone[] | null => {
    if (cursor <= 0) return null;
    cursor -= 1;
    notifySubscribers();
    // Return a copy of the snapshot at the new cursor position
    return stack[cursor].map((z) => ({ ...z }));
  }, []);

  const redo = useCallback((): TemplateZone[] | null => {
    if (cursor >= stack.length - 1) return null;
    cursor += 1;
    notifySubscribers();
    return stack[cursor].map((z) => ({ ...z }));
  }, []);

  return {
    canUndo,
    canRedo,
    pushState,
    undo,
    redo,
  };
}
