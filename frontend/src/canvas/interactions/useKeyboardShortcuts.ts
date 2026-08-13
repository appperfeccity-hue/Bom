import { useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import type { HistoryState } from '@/canvas/history/useHistory';

interface UseKeyboardShortcutsOptions {
  history: HistoryState;
}

/**
 * Custom hook for handling keyboard shortcuts on the canvas.
 *
 * Handles:
 * - Ctrl+Z: Undo (applies to wall configuration changes)
 * - Ctrl+Shift+Z: Redo
 * - Escape: Clear selection
 *
 * Removed (Rule 65 - zones are system-generated and read-only):
 * - Delete/Backspace: Zone deletion removed
 * - Ctrl+C/V/D: Zone copy/paste/duplicate removed
 * - Arrow keys: Zone nudge removed
 *
 * Returns a handleKeyDown callback for window event listener.
 */
export function useKeyboardShortcuts({ history }: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const clearSelection = useCanvasStore.getState().clearSelection;

      // Ctrl+Shift+Z: Redo (must check before Ctrl+Z)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        const redoState = history.redo();
        if (redoState) {
          useProjectStore.setState({ zones: redoState });
        }
        return;
      }

      // Ctrl+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        const undoState = history.undo();
        if (undoState) {
          useProjectStore.setState({ zones: undoState });
        }
        return;
      }

      // Escape: Clear selection
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSelection();
        return;
      }
    },
    [history],
  );

  return { handleKeyDown };
}
