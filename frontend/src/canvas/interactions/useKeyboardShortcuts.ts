import { useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { constrainToWall, hasOverlap } from '@/canvas/utils/zoneConstraints';
import { CanvasMode } from '@/types/database';
import type { TemplateZone } from '@/types/database';
import type { HistoryState } from '@/canvas/history/useHistory';

interface UseKeyboardShortcutsOptions {
  history: HistoryState;
}

/**
 * Custom hook for handling keyboard shortcuts on the canvas.
 *
 * Handles:
 * - Ctrl+Z: Undo
 * - Ctrl+Shift+Z: Redo
 * - Delete/Backspace: Remove selected zone (Designer mode only)
 * - Escape: Clear selection
 * - Arrow keys: Nudge selected zone by grid size (snap) or 1mm (no snap)
 *
 * Returns a handleKeyDown callback for window event listener.
 */
export function useKeyboardShortcuts({ history }: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mode = useCanvasStore.getState().mode;
      const gridConfig = useCanvasStore.getState().gridConfig;
      const selection = useCanvasStore.getState().selection;
      const clearSelection = useCanvasStore.getState().clearSelection;
      const zones = useProjectStore.getState().zones;
      const currentTemplate = useProjectStore.getState().currentTemplate;

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

      // Delete / Backspace: Remove selected zone (Designer mode only)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (mode !== CanvasMode.DESIGNER) return;
        if (!selection.selectedZoneId) return;
        e.preventDefault();

        // Push current state to history before deleting
        history.pushState(zones);
        void useProjectStore.getState().removeZone(selection.selectedZoneId);
        clearSelection();
        return;
      }

      // Escape: Clear selection
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSelection();
        return;
      }

      // Arrow keys: Nudge selected zone
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (mode !== CanvasMode.DESIGNER) return;
        if (!selection.selectedZoneId) return;
        if (!currentTemplate) return;
        e.preventDefault();

        const nudgeAmount = gridConfig.snapEnabled ? gridConfig.size : 1;
        const zone = zones.find((z) => z.id === selection.selectedZoneId);
        if (!zone) return;

        let dx = 0;
        let dy = 0;

        switch (e.key) {
          case 'ArrowLeft':
            dx = -nudgeAmount;
            break;
          case 'ArrowRight':
            dx = nudgeAmount;
            break;
          case 'ArrowUp':
            dy = nudgeAmount; // Up increases y in bottom-left origin
            break;
          case 'ArrowDown':
            dy = -nudgeAmount; // Down decreases y in bottom-left origin
            break;
        }

        const newX = zone.x_mm + dx;
        const newY = zone.y_mm + dy;

        const wallWidth = currentTemplate.base_width_mm;
        const wallHeight = currentTemplate.base_height_mm;

        // Constrain to wall boundary
        const constrained = constrainToWall(
          newX,
          newY,
          zone.width_mm,
          zone.height_mm,
          wallWidth,
          wallHeight,
        );

        // Check for overlap with other zones
        const newBox = {
          x: constrained.x,
          y: constrained.y,
          width: zone.width_mm,
          height: zone.height_mm,
        };
        if (hasOverlap(newBox, zones, zone.id)) {
          return; // Cannot nudge - would overlap
        }

        // Push current state to history before nudging
        history.pushState(zones);

        const updatedZone: TemplateZone = {
          ...zone,
          x_mm: constrained.x,
          y_mm: constrained.y,
        };
        void useProjectStore.getState().updateZone(updatedZone);
        return;
      }
    },
    [history],
  );

  return { handleKeyDown };
}
