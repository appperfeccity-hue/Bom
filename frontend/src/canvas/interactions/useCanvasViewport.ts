import { useCallback, useRef } from 'react';
import { useCanvasStore, clampZoom } from '@/stores/canvasStore';

/**
 * Custom hook for managing canvas viewport (zoom and pan).
 * Provides handlers for:
 * - Ctrl+scroll wheel zoom (centered on cursor)
 * - Middle-click or Space+left-click pan
 * - Touch pinch-zoom and two-finger pan
 * - Fit-to-viewport calculation
 */
export function useCanvasViewport() {
  const viewport = useCanvasStore((s) => s.viewport);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const pan = useCanvasStore((s) => s.pan);
  const resetViewport = useCanvasStore((s) => s.resetViewport);

  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const spaceHeld = useRef(false);

  // Touch state refs
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);

  /**
   * Handle wheel event for zoom (ctrl+scroll) or pan (scroll without ctrl).
   */
  const handleWheel = useCallback(
    (e: { evt: WheelEvent }) => {
      const evt = e.evt;
      evt.preventDefault();

      if (evt.ctrlKey || evt.metaKey) {
        // Zoom centered on cursor
        const scaleBy = 1.1;
        const oldZoom = viewport.zoom;
        const newZoom = evt.deltaY < 0
          ? clampZoom(oldZoom * scaleBy)
          : clampZoom(oldZoom / scaleBy);

        // Adjust pan to keep cursor position stable
        const mouseX = evt.offsetX;
        const mouseY = evt.offsetY;
        const dx = mouseX - (mouseX - viewport.panX) * (newZoom / oldZoom) - viewport.panX;
        const dy = mouseY - (mouseY - viewport.panY) * (newZoom / oldZoom) - viewport.panY;

        setZoom(newZoom);
        pan(dx, dy);
      } else {
        // Pan with scroll
        pan(-evt.deltaX, -evt.deltaY);
      }
    },
    [viewport, setZoom, pan],
  );

  /**
   * Start panning (middle-click or space+left-click).
   */
  const handleMouseDown = useCallback(
    (e: { evt: MouseEvent }) => {
      const evt = e.evt;
      if (evt.button === 1 || (spaceHeld.current && evt.button === 0)) {
        isPanning.current = true;
        lastPanPos.current = { x: evt.clientX, y: evt.clientY };
        evt.preventDefault();
      }
    },
    [],
  );

  /**
   * Continue panning on mouse move.
   */
  const handleMouseMove = useCallback(
    (e: { evt: MouseEvent }) => {
      if (!isPanning.current) return;
      const evt = e.evt;
      const dx = evt.clientX - lastPanPos.current.x;
      const dy = evt.clientY - lastPanPos.current.y;
      lastPanPos.current = { x: evt.clientX, y: evt.clientY };
      pan(dx, dy);
    },
    [pan],
  );

  /**
   * Stop panning on mouse up.
   */
  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  /**
   * Track space key for space+drag panning.
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      spaceHeld.current = true;
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      spaceHeld.current = false;
      isPanning.current = false;
    }
  }, []);

  /**
   * Calculate zoom level to fit the wall within the viewport with padding.
   */
  const fitToViewport = useCallback(
    (wallWidth: number, wallHeight: number, stageWidth: number, stageHeight: number) => {
      const padding = 40; // px padding on each side
      const availableWidth = stageWidth - padding * 2;
      const availableHeight = stageHeight - padding * 2;

      const zoomX = availableWidth / wallWidth;
      const zoomY = availableHeight / wallHeight;
      const newZoom = clampZoom(Math.min(zoomX, zoomY));

      // Center the wall
      const scaledWidth = wallWidth * newZoom;
      const scaledHeight = wallHeight * newZoom;
      const panX = (stageWidth - scaledWidth) / 2;
      const panY = (stageHeight - scaledHeight) / 2;

      resetViewport();
      setZoom(newZoom);
      pan(panX, panY);
    },
    [resetViewport, setZoom, pan],
  );

  /**
   * Handle touch start for pinch-zoom and two-finger pan.
   */
  const handleTouchStart = useCallback(
    (e: { evt: TouchEvent }) => {
      const evt = e.evt;
      if (evt.touches.length === 2) {
        evt.preventDefault();
        const t1 = evt.touches[0];
        const t2 = evt.touches[1];
        const dx = t2.clientX - t1.clientX;
        const dy = t2.clientY - t1.clientY;
        lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy);
        lastTouchCenter.current = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
      }
    },
    [],
  );

  /**
   * Handle touch move for pinch-zoom and two-finger pan.
   */
  const handleTouchMove = useCallback(
    (e: { evt: TouchEvent }) => {
      const evt = e.evt;
      if (evt.touches.length === 2) {
        evt.preventDefault();
        const t1 = evt.touches[0];
        const t2 = evt.touches[1];
        const dx = t2.clientX - t1.clientX;
        const dy = t2.clientY - t1.clientY;
        const newDistance = Math.sqrt(dx * dx + dy * dy);
        const newCenter = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };

        // Pinch-zoom
        if (lastTouchDistance.current !== null) {
          const scale = newDistance / lastTouchDistance.current;
          const currentViewport = useCanvasStore.getState().viewport;
          const newZoom = clampZoom(currentViewport.zoom * scale);
          setZoom(newZoom);
        }

        // Two-finger pan
        if (lastTouchCenter.current !== null) {
          const panDx = newCenter.x - lastTouchCenter.current.x;
          const panDy = newCenter.y - lastTouchCenter.current.y;
          pan(panDx, panDy);
        }

        lastTouchDistance.current = newDistance;
        lastTouchCenter.current = newCenter;
      }
    },
    [setZoom, pan],
  );

  /**
   * Handle touch end to reset pinch/pan state.
   */
  const handleTouchEnd = useCallback(
    (e: { evt: TouchEvent }) => {
      const evt = e.evt;
      if (evt.touches.length < 2) {
        lastTouchDistance.current = null;
        lastTouchCenter.current = null;
      }
    },
    [],
  );

  return {
    viewport,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleKeyDown,
    handleKeyUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    fitToViewport,
    isPanning,
    spaceHeld,
  };
}
