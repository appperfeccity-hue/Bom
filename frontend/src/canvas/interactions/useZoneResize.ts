import { useCallback, useRef } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { snapToGrid } from '@/lib/coordinates';
import { clampDimensions, constrainToWall, hasOverlap } from '@/canvas/utils/zoneConstraints';
import { doesZoneCrossCorner } from '@/canvas/utils/segmentConstraint';
import { CanvasMode } from '@/types/database';
import type { TemplateZone } from '@/types/database';
import type { ZoneResizeHandle } from '@/types/canvas';
import type { HistoryState } from '@/canvas/history/useHistory';
import { usePermissionEnforcement } from '@/canvas/permissions/usePermissionEnforcement';

interface ResizeState {
  handle: ZoneResizeHandle;
  initialBounds: { x: number; y: number; width: number; height: number };
}

/**
 * Custom hook for zone resize via 8-point handles (DESIGNER mode, or CONSULTANT with zone edit permission).
 * Enforces min 200x200mm, max 3000x2700mm, snaps to grid, constrains to wall.
 */
export function useZoneResize(history?: HistoryState) {
  const mode = useCanvasStore((s) => s.mode);
  const gridConfig = useCanvasStore((s) => s.gridConfig);
  const setResizeHandle = useCanvasStore((s) => s.setResizeHandle);
  const updateZone = useProjectStore((s) => s.updateZone);
  const currentTemplate = useProjectStore((s) => s.currentTemplate);
  const zones = useProjectStore((s) => s.zones);
  const { canEditZone } = usePermissionEnforcement();

  const resizeState = useRef<ResizeState | null>(null);

  const canResize = mode === CanvasMode.DESIGNER || mode === CanvasMode.CONSULTANT;

  const handleResizeStart = useCallback(
    (zone: TemplateZone, handle: ZoneResizeHandle) => {
      if (!canResize) return;
      // In CONSULTANT mode, check if zone is editable via permissions
      if (mode === CanvasMode.CONSULTANT && !canEditZone(zone.zone_id)) return;
      resizeState.current = {
        handle,
        initialBounds: {
          x: zone.x_mm,
          y: zone.y_mm,
          width: zone.width_mm,
          height: zone.height_mm,
        },
      };
      setResizeHandle(handle);
    },
    [canResize, setResizeHandle, mode, canEditZone],
  );

  const handleResizeMove = useCallback(
    (
      zone: TemplateZone,
      deltaX: number,
      deltaY: number,
    ): { x: number; y: number; width: number; height: number } => {
      if (!canResize || !resizeState.current || !currentTemplate) {
        return { x: zone.x_mm, y: zone.y_mm, width: zone.width_mm, height: zone.height_mm };
      }
      // In CONSULTANT mode, check zone-level permission
      if (mode === CanvasMode.CONSULTANT && !canEditZone(zone.zone_id)) {
        return { x: zone.x_mm, y: zone.y_mm, width: zone.width_mm, height: zone.height_mm };
      }

      const { handle, initialBounds } = resizeState.current;
      const wallWidth = currentTemplate.wall_geometry.base_width_mm;
      const wallHeight = currentTemplate.wall_geometry.base_height_mm;

      let { x, y, width, height } = initialBounds;

      // Apply deltas based on handle direction
      switch (handle) {
        case 'e':
          width += deltaX;
          break;
        case 'w':
          x += deltaX;
          width -= deltaX;
          break;
        case 's':
          height += deltaY;
          break;
        case 'n':
          y += deltaY;
          height -= deltaY;
          break;
        case 'se':
          width += deltaX;
          height += deltaY;
          break;
        case 'sw':
          x += deltaX;
          width -= deltaX;
          height += deltaY;
          break;
        case 'ne':
          width += deltaX;
          y += deltaY;
          height -= deltaY;
          break;
        case 'nw':
          x += deltaX;
          width -= deltaX;
          y += deltaY;
          height -= deltaY;
          break;
      }

      // Snap to grid
      if (gridConfig.snapEnabled) {
        x = snapToGrid(x, gridConfig.size);
        y = snapToGrid(y, gridConfig.size);
        width = snapToGrid(width, gridConfig.size);
        height = snapToGrid(height, gridConfig.size);
      }

      // Clamp dimensions
      const clamped = clampDimensions(width, height);
      width = clamped.width;
      height = clamped.height;

      // Constrain position within wall
      const constrained = constrainToWall(x, y, width, height, wallWidth, wallHeight);
      x = constrained.x;
      y = constrained.y;

      return { x, y, width, height };
    },
    [canResize, currentTemplate, gridConfig, mode, canEditZone],
  );

  const handleResizeEnd = useCallback(
    (zone: TemplateZone, finalBounds: { x: number; y: number; width: number; height: number }) => {
      if (!canResize) return;
      // In CONSULTANT mode, check zone-level permission
      if (mode === CanvasMode.CONSULTANT && !canEditZone(zone.zone_id)) return;

      // Check for overlap at the final bounds
      const newBox = { x: finalBounds.x, y: finalBounds.y, width: finalBounds.width, height: finalBounds.height };
      if (hasOverlap(newBox, zones, zone.zone_id)) {
        // Revert - do not apply the resize
        resizeState.current = null;
        setResizeHandle(null);
        return;
      }

      // L_CORNER: reject resize that would cross corner boundary
      const { wallGeometry, measurements } = useProjectStore.getState();
      if (wallGeometry === 'L_CORNER' && measurements?.segment_a_width_mm != null) {
        const cornerAt = { x: measurements.segment_a_width_mm, y: 0 };
        if (doesZoneCrossCorner(newBox, cornerAt)) {
          resizeState.current = null;
          setResizeHandle(null);
          return;
        }
      }

      // Push current state to history before applying resize
      if (history) {
        history.pushState(zones);
      }

      const updatedZone: TemplateZone = {
        ...zone,
        x_mm: finalBounds.x,
        y_mm: finalBounds.y,
        width_mm: finalBounds.width,
        height_mm: finalBounds.height,
      };

      void updateZone(updatedZone);
      resizeState.current = null;
      setResizeHandle(null);
    },
    [canResize, updateZone, setResizeHandle, zones, history, mode, canEditZone],
  );

  return {
    canResize,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
  };
}
