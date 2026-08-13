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

/** Timestamp of the last arrow-nudge history push. Used to batch rapid nudges. */
let lastNudgeTime = 0;

/** Debounce interval in milliseconds for batching arrow nudge history entries. */
const NUDGE_DEBOUNCE_MS = 300;

/** Reset the nudge debounce timer (useful for testing). */
export function resetNudgeTimer() {
  lastNudgeTime = 0;
}

/**
 * Custom hook for handling keyboard shortcuts on the canvas.
 *
 * Handles:
 * - Ctrl+Z: Undo
 * - Ctrl+Shift+Z: Redo
 * - Delete/Backspace: Remove selected zone(s) (Designer mode only)
 * - Escape: Clear selection
 * - Arrow keys: Nudge selected zone(s) by grid size (snap) or 1mm (no snap)
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

      // Ctrl+C: Copy selected zones to clipboard (Designer mode only)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (mode !== CanvasMode.DESIGNER) return;
        if (selection.selectedZoneIds.length === 0) return;
        e.preventDefault();
        useCanvasStore.getState().copySelection(zones);
        return;
      }

      // Ctrl+V: Paste clipboard zones (Designer mode only)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (mode !== CanvasMode.DESIGNER) return;
        if (!currentTemplate) return;
        e.preventDefault();
        const wallWidth = currentTemplate.wall_geometry.base_width_mm;
        const wallHeight = currentTemplate.wall_geometry.base_height_mm;
        const newZones = useCanvasStore.getState().pasteClipboard(
          zones,
          wallWidth,
          wallHeight,
          history.pushState,
        );
        if (newZones.length > 0) {
          // Add pasted zones to projectStore
          useProjectStore.setState({ zones: [...zones, ...newZones] });
        }
        return;
      }

      // Ctrl+D: Duplicate selected zones (Designer mode only)
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        if (mode !== CanvasMode.DESIGNER) return;
        if (selection.selectedZoneIds.length === 0) return;
        if (!currentTemplate) return;
        e.preventDefault();
        const wallWidth = currentTemplate.wall_geometry.base_width_mm;
        const wallHeight = currentTemplate.wall_geometry.base_height_mm;
        const newZones = useCanvasStore.getState().duplicateSelection(
          zones,
          wallWidth,
          wallHeight,
          history.pushState,
        );
        if (newZones.length > 0) {
          // Add duplicated zones to projectStore
          useProjectStore.setState({ zones: [...zones, ...newZones] });
        }
        return;
      }

      // Delete / Backspace: Remove selected zone(s) (Designer mode only)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (mode !== CanvasMode.DESIGNER) return;
        const selectedIds = selection.selectedZoneIds;
        if (selectedIds.length === 0) return;
        e.preventDefault();

        // Push current state to history before deleting (single push for batch)
        history.pushState(zones);

        // Remove all selected zones
        for (const id of selectedIds) {
          void useProjectStore.getState().removeZone(id);
        }
        clearSelection();
        return;
      }

      // Escape: Clear selection
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSelection();
        return;
      }

      // Arrow keys: Nudge selected zone(s)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (mode !== CanvasMode.DESIGNER) return;
        const selectedIds = selection.selectedZoneIds;
        if (selectedIds.length === 0) return;
        if (!currentTemplate) return;
        e.preventDefault();

        const nudgeAmount = gridConfig.snapEnabled ? gridConfig.size : 1;
        const selectedZones = zones.filter((z) => selectedIds.includes(z.zone_id));
        if (selectedZones.length === 0) return;

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

        const wallWidth = currentTemplate.wall_geometry.base_width_mm;
        const wallHeight = currentTemplate.wall_geometry.base_height_mm;

        // Compute group bounding box to constrain as a unit
        const groupMinX = Math.min(...selectedZones.map((z) => z.x_mm));
        const groupMinY = Math.min(...selectedZones.map((z) => z.y_mm));
        const groupMaxX = Math.max(...selectedZones.map((z) => z.x_mm + z.width_mm));
        const groupMaxY = Math.max(...selectedZones.map((z) => z.y_mm + z.height_mm));

        const groupW = groupMaxX - groupMinX;
        const groupH = groupMaxY - groupMinY;

        // Constrain group to wall boundary
        const constrained = constrainToWall(
          groupMinX + dx,
          groupMinY + dy,
          groupW,
          groupH,
          wallWidth,
          wallHeight,
        );

        const actualDx = constrained.x - groupMinX;
        const actualDy = constrained.y - groupMinY;

        if (actualDx === 0 && actualDy === 0) return;

        // Check for overlap: each moved zone against non-selected zones
        const nonSelectedZones = zones.filter((z) => !selectedIds.includes(z.zone_id));
        for (const zone of selectedZones) {
          const newBox = {
            x: zone.x_mm + actualDx,
            y: zone.y_mm + actualDy,
            width: zone.width_mm,
            height: zone.height_mm,
          };
          if (hasOverlap(newBox, nonSelectedZones)) {
            return; // Cannot nudge - would overlap
          }
        }

        // Push current state to history before nudging (batched: skip if last nudge was within debounce window)
        const now = Date.now();
        if (now - lastNudgeTime > NUDGE_DEBOUNCE_MS) {
          history.pushState(zones);
        }
        lastNudgeTime = now;

        // Move all selected zones
        for (const zone of selectedZones) {
          const updatedZone: TemplateZone = {
            ...zone,
            x_mm: zone.x_mm + actualDx,
            y_mm: zone.y_mm + actualDy,
          };
          void useProjectStore.getState().updateZone(updatedZone);
        }
        return;
      }
    },
    [history],
  );

  return { handleKeyDown };
}
