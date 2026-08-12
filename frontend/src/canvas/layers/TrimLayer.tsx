import { Layer, Line } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasLayer } from '@/types/canvas';

interface TrimLayerProps {
  wallHeight: number;
}

/**
 * Renders path-based lines for each trim item.
 * PHYSICAL type: thick solid line (strokeWidth 3/zoom, stroke #795548).
 * GEOMETRY type: thin dashed line (strokeWidth 1/zoom, dash [6/zoom, 4/zoom], stroke #9e9e9e).
 * Unknown types default to GEOMETRY style.
 * Converts from bottom-left origin (mm) to Konva top-left using wallHeight.
 */
export function TrimLayer({ wallHeight }: TrimLayerProps) {
  const visible = useCanvasStore((s) => s.layerVisibility[CanvasLayer.TRIMS]);
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const trims = useProjectStore((s) => s.trims);

  if (!visible) return null;

  return (
    <Layer listening={false}>
      {trims.map((item) => {
        // Flatten path_mm points with y-coordinate conversion
        const points = item.path_mm.flatMap((point) => [
          point.x,
          wallHeight - point.y,
        ]);

        const isPhysical = item.type === 'PHYSICAL';

        return (
          <Line
            key={item.id}
            points={points}
            stroke={isPhysical ? '#795548' : '#9e9e9e'}
            strokeWidth={isPhysical ? 3 / zoom : 1 / zoom}
            dash={isPhysical ? undefined : [6 / zoom, 4 / zoom]}
            listening={false}
            data-trim-id={item.id}
          />
        );
      })}
    </Layer>
  );
}
