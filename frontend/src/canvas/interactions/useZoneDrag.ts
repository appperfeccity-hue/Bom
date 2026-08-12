import { useCallback, useRef } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { snapToGrid } from '@/lib/coordinates';
import { constrainToWall, hasOverlap } from '@/canvas/utils/zoneConstraints';
import { doesZoneCrossCorner } from '@/canvas/utils/segmentConstraint';
import { getSnapCandidates, snapToEdges, SNAP_THRESHOLD } from '@/canvas/utils/snapEngine';
import { CanvasMode } from '@/types/database';
import type { TemplateZone } from '@/types/database';
import type { HistoryState } from '@/canvas/history/useHistory';
import { usePermissionEnforcement } from '@/canvas/permissions/usePermissionEnforcement';

/**
 * Custom hook for zone drag interaction (DESIGNER mode only, or CONSULTANT with zone edit permission).
 * On drag: snaps to grid, constrains within wall boundary.
 * On drag end: updates projectStore.updateZone() for autosave.
 * When dragging a zone that is part of a multi-selection, moves all selected zones by the same delta.
 */
export function useZoneDrag(history?: HistoryState) {
  const mode = useCanvasStore((s) => s.mode);
  const gridConfig = useCanvasStore((s) => s.gridConfig);
  const updateZone = useProjectStore((s) => s.updateZone);
  const currentTemplate = useProjectStore((s) => s.currentTemplate);
  const zones = useProjectStore((s) => s.zones);
  const { canEditZone } = usePermissionEnforcement();

  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const canDrag = mode === CanvasMode.DESIGNER || mode === CanvasMode.CONSULTANT;

  const handleDragStart = useCallback(
    (zone: TemplateZone, _e: unknown) => {
      if (!canDrag) return;
      // In CONSULTANT mode, check if zone is editable via permissions
      if (mode === CanvasMode.CONSULTANT && !canEditZone(zone.id)) return;
      dragStartPos.current = { x: zone.x_mm, y: zone.y_mm };
    },
    [canDrag, mode, canEditZone],
  );

  const handleDragMove = useCallback(
    (zone: TemplateZone, newX: number, newY: number): { x: number; y: number } => {
      if (!canDrag || !currentTemplate) {
        return { x: zone.x_mm, y: zone.y_mm };
      }
      // In CONSULTANT mode, check zone-level permission
      if (mode === CanvasMode.CONSULTANT && !canEditZone(zone.id)) {
        return { x: zone.x_mm, y: zone.y_mm };
      }

      const wallWidth = currentTemplate.base_width_mm;
      const wallHeight = currentTemplate.base_height_mm;
      const selection = useCanvasStore.getState().selection;
      const selectedIds = selection.selectedZoneIds;
      const isMultiDrag = selectedIds.length > 1 && selectedIds.includes(zone.id);

      // Snap to grid if enabled
      let x = gridConfig.snapEnabled ? snapToGrid(newX, gridConfig.size) : Math.round(newX);
      let y = gridConfig.snapEnabled ? snapToGrid(newY, gridConfig.size) : Math.round(newY);

      if (isMultiDrag) {
        // For multi-drag, constrain the group bounding box
        const allZones = useProjectStore.getState().zones;
        const selectedZones = allZones.filter((z) => selectedIds.includes(z.id));
        const dx = x - zone.x_mm;
        const dy = y - zone.y_mm;

        const groupMinX = Math.min(...selectedZones.map((z) => z.x_mm + dx));
        const groupMinY = Math.min(...selectedZones.map((z) => z.y_mm + dy));
        const groupMaxX = Math.max(...selectedZones.map((z) => z.x_mm + z.width_mm + dx));
        const groupMaxY = Math.max(...selectedZones.map((z) => z.y_mm + z.height_mm + dy));

        const groupW = groupMaxX - groupMinX;
        const groupH = groupMaxY - groupMinY;

        const constrained = constrainToWall(groupMinX, groupMinY, groupW, groupH, wallWidth, wallHeight);
        const constrainedDx = constrained.x - (groupMinX - dx);
        const constrainedDy = constrained.y - (groupMinY - dy);

        x = zone.x_mm + constrainedDx;
        y = zone.y_mm + constrainedDy;
      } else {
        // Single zone: constrain within wall boundary
        const constrained = constrainToWall(x, y, zone.width_mm, zone.height_mm, wallWidth, wallHeight);
        x = constrained.x;
        y = constrained.y;

        // Apply edge snapping
        const allZones = useProjectStore.getState().zones;
        const otherZones = allZones.filter((z) => z.id !== zone.id);
        const candidates = getSnapCandidates(otherZones, wallWidth, wallHeight);
        const snapResult = snapToEdges(x, y, zone.width_mm, zone.height_mm, candidates, SNAP_THRESHOLD);
        x = snapResult.x;
        y = snapResult.y;

        // Update active snap lines for visual feedback
        const activeVertical: number[] = snapResult.snappedVertical !== null ? [snapResult.snappedVertical] : [];
        const activeHorizontal: number[] = snapResult.snappedHorizontal !== null ? [snapResult.snappedHorizontal] : [];
        useCanvasStore.getState().setActiveSnapLines({ vertical: activeVertical, horizontal: activeHorizontal });
      }

      return { x, y };
    },
    [canDrag, currentTemplate, gridConfig, mode, canEditZone],
  );

  const handleDragEnd = useCallback(
    (zone: TemplateZone, finalX: number, finalY: number) => {
      if (!canDrag) return;
      // In CONSULTANT mode, check zone-level permission
      if (mode === CanvasMode.CONSULTANT && !canEditZone(zone.id)) return;

      // Clear snap lines on drag end
      useCanvasStore.getState().clearActiveSnapLines();

      const selection = useCanvasStore.getState().selection;
      const selectedIds = selection.selectedZoneIds;
      const isMultiDrag = selectedIds.length > 1 && selectedIds.includes(zone.id);

      if (isMultiDrag) {
        // Batch move all selected zones by the same delta
        const dx = finalX - zone.x_mm;
        const dy = finalY - zone.y_mm;

        if (dx === 0 && dy === 0) {
          dragStartPos.current = null;
          return;
        }

        const allZones = useProjectStore.getState().zones;
        const selectedZones = allZones.filter((z) => selectedIds.includes(z.id));
        const nonSelectedZones = allZones.filter((z) => !selectedIds.includes(z.id));

        // Check for overlap of each moved zone against non-selected zones
        for (const sz of selectedZones) {
          const newBox = { x: sz.x_mm + dx, y: sz.y_mm + dy, width: sz.width_mm, height: sz.height_mm };
          if (hasOverlap(newBox, nonSelectedZones)) {
            // Revert to start position (cancel the drag)
            if (dragStartPos.current) {
              const revertedZone: TemplateZone = {
                ...zone,
                x_mm: dragStartPos.current.x,
                y_mm: dragStartPos.current.y,
              };
              void updateZone(revertedZone);
            }
            dragStartPos.current = null;
            return;
          }
        }

        // L_CORNER: reject multi-drag if any zone would cross corner boundary
        const { wallGeometry, measurements } = useProjectStore.getState();
        if (wallGeometry === 'L_CORNER' && measurements?.segment_a_width_mm != null) {
          const cornerAt = { x: measurements.segment_a_width_mm, y: 0 };
          for (const sz of selectedZones) {
            const newBox = { x: sz.x_mm + dx, y: sz.y_mm + dy, width: sz.width_mm, height: sz.height_mm };
            if (doesZoneCrossCorner(newBox, cornerAt)) {
              if (dragStartPos.current) {
                const revertedZone: TemplateZone = {
                  ...zone,
                  x_mm: dragStartPos.current.x,
                  y_mm: dragStartPos.current.y,
                };
                void updateZone(revertedZone);
              }
              dragStartPos.current = null;
              return;
            }
          }
        }

        // Push current state to history before applying drag
        if (history) {
          history.pushState(allZones);
        }

        // Move all selected zones
        for (const sz of selectedZones) {
          const updatedZone: TemplateZone = {
            ...sz,
            x_mm: sz.x_mm + dx,
            y_mm: sz.y_mm + dy,
          };
          void updateZone(updatedZone);
        }
        dragStartPos.current = null;
      } else {
        // Single zone drag
        const newBox = { x: finalX, y: finalY, width: zone.width_mm, height: zone.height_mm };
        if (hasOverlap(newBox, zones, zone.id)) {
          // Revert to start position (cancel the drag)
          if (dragStartPos.current) {
            const revertedZone: TemplateZone = {
              ...zone,
              x_mm: dragStartPos.current.x,
              y_mm: dragStartPos.current.y,
            };
            void updateZone(revertedZone);
          }
          dragStartPos.current = null;
          return;
        }

        // L_CORNER: reject drag that would cross corner boundary
        const { wallGeometry, measurements } = useProjectStore.getState();
        if (wallGeometry === 'L_CORNER' && measurements?.segment_a_width_mm != null) {
          const cornerAt = { x: measurements.segment_a_width_mm, y: 0 };
          if (doesZoneCrossCorner(newBox, cornerAt)) {
            if (dragStartPos.current) {
              const revertedZone: TemplateZone = {
                ...zone,
                x_mm: dragStartPos.current.x,
                y_mm: dragStartPos.current.y,
              };
              void updateZone(revertedZone);
            }
            dragStartPos.current = null;
            return;
          }
        }

        // Push current state to history before applying drag
        if (history) {
          history.pushState(zones);
        }

        const updatedZone: TemplateZone = {
          ...zone,
          x_mm: finalX,
          y_mm: finalY,
        };

        void updateZone(updatedZone);
        dragStartPos.current = null;
      }
    },
    [canDrag, updateZone, zones, history, mode, canEditZone],
  );

  return {
    canDrag,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
}
