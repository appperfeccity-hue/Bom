import { useCallback, useRef } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode } from '@/types/database';
import type { BoundingBox } from '@/types/canvas';

/**
 * Custom hook for marquee (rubber-band) selection on the canvas.
 * Tracks mousedown on empty canvas -> mousemove -> mouseup to select
 * all zones intersecting the drawn rectangle.
 * Only active in DESIGNER mode.
 */
export function useMarqueeSelect() {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const activeRef = useRef(false);

  const handleMarqueeStart = useCallback(
    (canvasX: number, canvasY: number) => {
      const mode = useCanvasStore.getState().mode;
      if (mode !== CanvasMode.DESIGNER) return;

      startRef.current = { x: canvasX, y: canvasY };
      activeRef.current = true;
    },
    [],
  );

  const handleMarqueeMove = useCallback(
    (canvasX: number, canvasY: number) => {
      if (!activeRef.current || !startRef.current) return;

      const start = startRef.current;
      const rect: BoundingBox = {
        x: Math.min(start.x, canvasX),
        y: Math.min(start.y, canvasY),
        width: Math.abs(canvasX - start.x),
        height: Math.abs(canvasY - start.y),
      };

      useCanvasStore.getState().setMarqueeRect(rect);
    },
    [],
  );

  const handleMarqueeEnd = useCallback(() => {
    if (!activeRef.current) return;

    const marqueeRect = useCanvasStore.getState().selection.marqueeRect;
    if (marqueeRect && marqueeRect.width > 5 && marqueeRect.height > 5) {
      const zones = useProjectStore.getState().zones;
      useCanvasStore.getState().selectZonesInRect(marqueeRect, zones);
    }

    activeRef.current = false;
    startRef.current = null;
    useCanvasStore.getState().setMarqueeRect(null);
  }, []);

  const cancelMarquee = useCallback(() => {
    activeRef.current = false;
    startRef.current = null;
    useCanvasStore.getState().setMarqueeRect(null);
  }, []);

  return {
    isMarqueeActive: activeRef.current,
    handleMarqueeStart,
    handleMarqueeMove,
    handleMarqueeEnd,
    cancelMarquee,
  };
}
