import { useCallback, useRef, useState } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { snapToGrid } from '@/lib/coordinates';
import {
  canAddZone,
  constrainToWall,
  hasOverlap,
  MIN_ZONE_WIDTH,
  MIN_ZONE_HEIGHT,
} from '@/canvas/utils/zoneConstraints';
import { doesZoneCrossCorner } from '@/canvas/utils/segmentConstraint';
import { assignSegment } from '@/canvas/utils/segmentAssignment';
import { CanvasMode, ZoneWidthStrategy, ZoneHeightStrategy, ZonePositionStrategy } from '@/types/database';
import type { BoundingBox } from '@/types/canvas';
import type { HistoryState } from '@/canvas/history/useHistory';

/**
 * Custom hook for creating new zones via click-drag on empty canvas area.
 * DESIGNER mode only. Enforces min size 200x200mm, max 12 zones.
 */
export function useZoneCreate(history?: HistoryState) {
  const mode = useCanvasStore((s) => s.mode);
  const gridConfig = useCanvasStore((s) => s.gridConfig);
  const addZone = useProjectStore((s) => s.addZone);
  const zones = useProjectStore((s) => s.zones);
  const currentTemplate = useProjectStore((s) => s.currentTemplate);

  const [isCreating, setIsCreating] = useState(false);
  const [createPreview, setCreatePreview] = useState<BoundingBox | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const canCreate = mode === CanvasMode.DESIGNER;

  const handleCreateStart = useCallback(
    (canvasX: number, canvasY: number) => {
      if (!canCreate || !currentTemplate) return;
      if (!canAddZone(zones.length)) return;

      const x = gridConfig.snapEnabled ? snapToGrid(canvasX, gridConfig.size) : Math.round(canvasX);
      const y = gridConfig.snapEnabled ? snapToGrid(canvasY, gridConfig.size) : Math.round(canvasY);

      startPos.current = { x, y };
      setIsCreating(true);
      setCreatePreview({ x, y, width: 0, height: 0 });
    },
    [canCreate, currentTemplate, zones.length, gridConfig],
  );

  const handleCreateMove = useCallback(
    (canvasX: number, canvasY: number) => {
      if (!isCreating || !startPos.current || !currentTemplate) return;

      const wallWidth = currentTemplate.wall_geometry.base_width_mm;
      const wallHeight = currentTemplate.wall_geometry.base_height_mm;

      let endX = gridConfig.snapEnabled ? snapToGrid(canvasX, gridConfig.size) : Math.round(canvasX);
      let endY = gridConfig.snapEnabled ? snapToGrid(canvasY, gridConfig.size) : Math.round(canvasY);

      // Clamp to wall
      endX = Math.max(0, Math.min(endX, wallWidth));
      endY = Math.max(0, Math.min(endY, wallHeight));

      const x = Math.min(startPos.current.x, endX);
      const y = Math.min(startPos.current.y, endY);
      const width = Math.abs(endX - startPos.current.x);
      const height = Math.abs(endY - startPos.current.y);

      setCreatePreview({ x, y, width, height });
    },
    [isCreating, currentTemplate, gridConfig],
  );

  const handleCreateEnd = useCallback(() => {
    if (!isCreating || !createPreview || !currentTemplate) {
      setIsCreating(false);
      setCreatePreview(null);
      startPos.current = null;
      return;
    }

    const wallWidth = currentTemplate.wall_geometry.base_width_mm;
    const wallHeight = currentTemplate.wall_geometry.base_height_mm;

    // Enforce minimum size
    if (createPreview.width < MIN_ZONE_WIDTH || createPreview.height < MIN_ZONE_HEIGHT) {
      setIsCreating(false);
      setCreatePreview(null);
      startPos.current = null;
      return;
    }

    // Constrain to wall
    const constrained = constrainToWall(
      createPreview.x,
      createPreview.y,
      createPreview.width,
      createPreview.height,
      wallWidth,
      wallHeight,
    );

    // Check for overlap with existing zones
    const newBox = {
      x: constrained.x,
      y: constrained.y,
      width: createPreview.width,
      height: createPreview.height,
    };
    if (hasOverlap(newBox, zones)) {
      setIsCreating(false);
      setCreatePreview(null);
      startPos.current = null;
      return;
    }

    // L_CORNER: reject if zone would cross corner boundary
    const { wallGeometry, measurements } = useProjectStore.getState();
    if (wallGeometry === 'L_CORNER' && measurements?.segment_a_width_mm != null) {
      const cornerAt = { x: measurements.segment_a_width_mm, y: 0 };
      if (doesZoneCrossCorner(newBox, cornerAt)) {
        setIsCreating(false);
        setCreatePreview(null);
        startPos.current = null;
        return;
      }
    }

    // Compute segment assignment
    const segment = wallGeometry === 'L_CORNER' && measurements?.segment_a_width_mm != null
      ? assignSegment(
          { x_mm: constrained.x, y_mm: constrained.y, width_mm: createPreview.width, height_mm: createPreview.height },
          { x: measurements.segment_a_width_mm, y: 0 },
          wallGeometry,
        )
      : null;

    void (() => {
      // Push current state to history before adding zone
      if (history) {
        history.pushState(zones);
      }
      return addZone({
        template_id: currentTemplate.template_id,
        x_mm: constrained.x,
        y_mm: constrained.y,
        width_mm: createPreview.width,
        height_mm: createPreview.height,
        width_strategy: ZoneWidthStrategy.FIXED,
        height_strategy: ZoneHeightStrategy.FIXED,
        position_strategy: ZonePositionStrategy.FIXED,
        segment,
      });
    })();

    setIsCreating(false);
    setCreatePreview(null);
    startPos.current = null;
  }, [isCreating, createPreview, currentTemplate, zones, addZone, history]);

  return {
    canCreate,
    isCreating,
    createPreview,
    handleCreateStart,
    handleCreateMove,
    handleCreateEnd,
  };
}
