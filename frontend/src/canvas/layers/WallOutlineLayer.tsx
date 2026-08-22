import { Layer, Line, Rect } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasLayer } from '@/types/canvas';
import type { WallGeometryType } from '@/types/database';
import { isLShape } from '@/engines/wallType';

interface WallOutlineLayerProps {
  wallWidth: number;
  wallHeight: number;
  wallGeometry: WallGeometryType;
  /** For L_SHAPE: width of segment A (horizontal) */
  segmentAWidth?: number;
  /** For L_SHAPE: width of segment B (vertical) */
  segmentBWidth?: number;
}

/**
 * Renders wall boundary as a thick stroke.
 * STRAIGHT: single rectangle.
 * L_SHAPE (legacy L_CORNER): two connected rectangles at 90 degrees,
 * with the corner point at the canvas origin (0,0).
 */
export function WallOutlineLayer({
  wallWidth,
  wallHeight,
  wallGeometry,
  segmentAWidth,
  segmentBWidth,
}: WallOutlineLayerProps) {
  const visible = useCanvasStore((s) => s.layerVisibility[CanvasLayer.WALL_OUTLINE]);
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const installationArea = useProjectStore((s) => s.installationArea);

  if (!visible) return null;

  // Stroke width adjusts with zoom so it appears consistent
  const strokeWidth = 2 / zoom;

  /**
   * PARTIAL installation area: the parent boundary of all zones, drawn dashed
   * inside the wall outline. FULL coverage needs no separate outline.
   */
  const areaOutline =
    installationArea && installationArea.coverage === 'PARTIAL' ? (
      <Rect
        name="installation-area-outer-edge"
        x={installationArea.outerEdge.x_mm}
        y={installationArea.outerEdge.y_mm}
        width={installationArea.outerEdge.width_mm}
        height={installationArea.outerEdge.height_mm}
        stroke="#8A6D3B"
        strokeWidth={strokeWidth}
        dash={[8 / zoom, 6 / zoom]}
        listening={false}
      />
    ) : null;

  if (isLShape(wallGeometry) && segmentAWidth && segmentBWidth) {
    // L-shape: two rectangles forming an L
    // Segment A is horizontal (bottom), Segment B is vertical (left)
    const points = [
      0, 0,
      segmentAWidth, 0,
      segmentAWidth, segmentBWidth,
      wallWidth, segmentBWidth,
      wallWidth, wallHeight,
      0, wallHeight,
      0, 0,
    ];

    return (
      <Layer listening={false}>
        <Line
          points={points}
          stroke="#1A1A1A" /* --color-ink-primary */
          strokeWidth={strokeWidth}
          closed
          listening={false}
        />
        {areaOutline}
      </Layer>
    );
  }

  // STRAIGHT: simple rectangle
  const points = [
    0, 0,
    wallWidth, 0,
    wallWidth, wallHeight,
    0, wallHeight,
  ];

  return (
    <Layer listening={false}>
      <Line
        points={points}
        stroke="#1A1A1A" /* --color-ink-primary */
        strokeWidth={strokeWidth}
        closed
        listening={false}
      />
      {areaOutline}
    </Layer>
  );
}
