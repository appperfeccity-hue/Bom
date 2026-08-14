import { Layer, Line } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasLayer } from '@/types/canvas';
import type { WallGeometryType } from '@/types/database';

interface WallOutlineLayerProps {
  wallWidth: number;
  wallHeight: number;
  wallGeometry: WallGeometryType;
  /** For L_CORNER: width of segment A (horizontal) */
  segmentAWidth?: number;
  /** For L_CORNER: width of segment B (vertical) */
  segmentBWidth?: number;
}

/**
 * Renders wall boundary as a thick stroke.
 * STRAIGHT: single rectangle.
 * L_CORNER: two connected rectangles at 90 degrees.
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

  if (!visible) return null;

  // Stroke width adjusts with zoom so it appears consistent
  const strokeWidth = 2 / zoom;

  if (wallGeometry === 'L_CORNER' && segmentAWidth && segmentBWidth) {
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
    </Layer>
  );
}
