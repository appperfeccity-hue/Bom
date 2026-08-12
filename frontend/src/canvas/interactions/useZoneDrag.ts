import { useCallback, useRef } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { snapToGrid } from '@/lib/coordinates';
import { constrainToWall } from '@/canvas/utils/zoneConstraints';
import { CanvasMode } from '@/types/database';
import type { TemplateZone } from '@/types/database';

/**
 * Custom hook for zone drag interaction (DESIGNER mode only).
 * On drag: snaps to grid, constrains within wall boundary.
 * On drag end: updates projectStore.updateZone() for autosave.
 */
export function useZoneDrag() {
  const mode = useCanvasStore((s) => s.mode);
  const gridConfig = useCanvasStore((s) => s.gridConfig);
  const updateZone = useProjectStore((s) => s.updateZone);
  const currentTemplate = useProjectStore((s) => s.currentTemplate);

  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const canDrag = mode === CanvasMode.DESIGNER;

  const handleDragStart = useCallback(
    (zone: TemplateZone, _e: unknown) => {
      if (!canDrag) return;
      dragStartPos.current = { x: zone.x_mm, y: zone.y_mm };
    },
    [canDrag],
  );

  const handleDragMove = useCallback(
    (zone: TemplateZone, newX: number, newY: number): { x: number; y: number } => {
      if (!canDrag || !currentTemplate) {
        return { x: zone.x_mm, y: zone.y_mm };
      }

      const wallWidth = currentTemplate.base_width_mm;
      const wallHeight = currentTemplate.base_height_mm;

      // Snap to grid if enabled
      let x = gridConfig.snapEnabled ? snapToGrid(newX, gridConfig.size) : Math.round(newX);
      let y = gridConfig.snapEnabled ? snapToGrid(newY, gridConfig.size) : Math.round(newY);

      // Constrain within wall boundary
      const constrained = constrainToWall(x, y, zone.width_mm, zone.height_mm, wallWidth, wallHeight);
      x = constrained.x;
      y = constrained.y;

      return { x, y };
    },
    [canDrag, currentTemplate, gridConfig],
  );

  const handleDragEnd = useCallback(
    (zone: TemplateZone, finalX: number, finalY: number) => {
      if (!canDrag) return;

      const updatedZone: TemplateZone = {
        ...zone,
        x_mm: finalX,
        y_mm: finalY,
      };

      void updateZone(updatedZone);
      dragStartPos.current = null;
    },
    [canDrag, updateZone],
  );

  return {
    canDrag,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
}
