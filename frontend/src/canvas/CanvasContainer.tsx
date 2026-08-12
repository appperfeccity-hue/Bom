import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode } from '@/types/database';
import { GridLayer } from './layers/GridLayer';
import { WallOutlineLayer } from './layers/WallOutlineLayer';
import { ZonesLayer } from './layers/ZonesLayer';
import { SkuPlacementLayer } from './layers/SkuPlacementLayer';
import { ValidationOverlayLayer } from './layers/ValidationOverlayLayer';
import { LightingLayer } from './layers/LightingLayer';
import { FurnitureLayer } from './layers/FurnitureLayer';
import { TrimLayer } from './layers/TrimLayer';
import { SelectionLayer } from './layers/SelectionLayer';
import { MeasurementsLayer } from './layers/MeasurementsLayer';
import { useCanvasViewport } from './interactions/useCanvasViewport';
import { useZoneCreate } from './interactions/useZoneCreate';
import { useKeyboardShortcuts } from './interactions/useKeyboardShortcuts';
import { useHistory } from './history/useHistory';
import { resetHistory } from './history/useHistory';
import { screenToCanvas } from '@/lib/coordinates';

interface CanvasContainerProps {
  mode: CanvasMode;
}

/**
 * Main canvas wrapper component.
 * Sets up the Konva Stage with responsive sizing.
 * Handles zoom, pan, and zone creation interactions.
 * Renders layers in correct z-order.
 */
export function CanvasContainer({ mode }: CanvasContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

  const viewport = useCanvasStore((s) => s.viewport);
  const setMode = useCanvasStore((s) => s.setMode);
  const currentTemplate = useProjectStore((s) => s.currentTemplate);
  const measurements = useProjectStore((s) => s.measurements);
  const wallGeometry = useProjectStore((s) => s.wallGeometry);

  const {
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleKeyDown,
    handleKeyUp,
    fitToViewport,
  } = useCanvasViewport();

  const history = useHistory();

  const {
    isCreating,
    createPreview,
    handleCreateStart,
    handleCreateMove,
    handleCreateEnd,
  } = useZoneCreate(history);

  const { handleKeyDown: handleShortcutKeyDown } = useKeyboardShortcuts({ history });

  // Set mode when prop changes
  useEffect(() => {
    setMode(mode);
  }, [mode, setMode]);

  // Responsive sizing
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setStageSize({ width, height });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard events for space+drag pan and shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      handleKeyDown(e);
      handleShortcutKeyDown(e);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp, handleShortcutKeyDown]);

  // Fit to viewport on initial load and template change only (not on every resize)
  const hasInitialized = useRef(false);
  const lastTemplateId = useRef<string | null>(null);

  useEffect(() => {
    if (currentTemplate && stageSize.width > 0) {
      const templateChanged = lastTemplateId.current !== currentTemplate.id;
      if (!hasInitialized.current || templateChanged) {
        hasInitialized.current = true;
        lastTemplateId.current = currentTemplate.id;
        // Clear history when switching templates/projects
        if (templateChanged) {
          resetHistory();
        }
        fitToViewport(
          currentTemplate.base_width_mm,
          currentTemplate.base_height_mm,
          stageSize.width,
          stageSize.height,
        );
      }
    }
  }, [currentTemplate, stageSize, fitToViewport]);

  const wallWidth = currentTemplate?.base_width_mm ?? 3000;
  const wallHeight = currentTemplate?.base_height_mm ?? 2400;

  // Handle click on empty canvas area for zone creation
  const handleStageMouseDown = (e: { evt: MouseEvent; target: { getStage: () => unknown } }) => {
    // Forward to pan handler
    handleMouseDown(e as { evt: MouseEvent });

    // Zone creation on left click in designer mode on empty canvas
    if (
      mode === CanvasMode.DESIGNER &&
      e.evt.button === 0 &&
      e.target === e.target.getStage()
    ) {
      const point = screenToCanvas(
        { x: e.evt.offsetX - viewport.panX, y: e.evt.offsetY - viewport.panY },
        wallHeight,
        { zoom: viewport.zoom, panX: 0, panY: 0 },
      );
      handleCreateStart(point.x, point.y);
    }
  };

  const handleStageMouseMove = (e: { evt: MouseEvent }) => {
    handleMouseMove(e);
    if (isCreating) {
      const point = screenToCanvas(
        { x: e.evt.offsetX - viewport.panX, y: e.evt.offsetY - viewport.panY },
        wallHeight,
        { zoom: viewport.zoom, panX: 0, panY: 0 },
      );
      handleCreateMove(point.x, point.y);
    }
  };

  const handleStageMouseUp = () => {
    handleMouseUp();
    if (isCreating) {
      handleCreateEnd();
    }
  };

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}
      data-testid="canvas-container"
    >
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        scaleX={viewport.zoom}
        scaleY={viewport.zoom}
        x={viewport.panX}
        y={viewport.panY}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        data-testid="canvas-stage"
      >
        <GridLayer wallWidth={wallWidth} wallHeight={wallHeight} />
        <WallOutlineLayer
          wallWidth={wallWidth}
          wallHeight={wallHeight}
          wallGeometry={wallGeometry}
          segmentAWidth={measurements?.segment_a_width_mm ?? undefined}
          segmentBWidth={measurements?.segment_b_width_mm ?? undefined}
        />
        <ZonesLayer wallHeight={wallHeight} />
        <SkuPlacementLayer wallHeight={wallHeight} />
        <ValidationOverlayLayer wallHeight={wallHeight} />
        <LightingLayer wallHeight={wallHeight} />
        <FurnitureLayer wallHeight={wallHeight} />
        <TrimLayer wallHeight={wallHeight} />
        <MeasurementsLayer wallWidth={wallWidth} wallHeight={wallHeight} />
        <SelectionLayer wallHeight={wallHeight} />

        {/* Creation preview rectangle */}
        {isCreating && createPreview && (
          <Layer>
            <Rect
              x={createPreview.x}
              y={wallHeight - createPreview.y - createPreview.height}
              width={createPreview.width}
              height={createPreview.height}
              fill="rgba(25, 118, 210, 0.1)"
              stroke="#1976d2"
              strokeWidth={1 / viewport.zoom}
              dash={[4 / viewport.zoom, 4 / viewport.zoom]}
              listening={false}
            />
          </Layer>
        )}
      </Stage>
    </div>
  );
}
