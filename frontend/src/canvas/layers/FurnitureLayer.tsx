import { Layer, Rect, Group } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasLayer } from '@/types/canvas';

interface FurnitureLayerProps {
  wallHeight: number;
}

/** Default furniture item dimensions for rendering. */
const DEFAULT_FURNITURE_SIZE = 200;

/**
 * Renders positioned rectangles for each furniture item.
 * Uses position_x_mm/position_y_mm and orientation from the DB schema.
 * Converts from bottom-left origin (mm) to Konva top-left using wallHeight.
 */
export function FurnitureLayer({ wallHeight }: FurnitureLayerProps) {
  const visible = useCanvasStore((s) => s.layerVisibility[CanvasLayer.FURNITURE]);
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const furniture = useProjectStore((s) => s.furniture);

  if (!visible) return null;

  return (
    <Layer listening={false}>
      {furniture.map((item) => {
        const width = item.orientation === 'HORIZONTAL' ? DEFAULT_FURNITURE_SIZE : DEFAULT_FURNITURE_SIZE / 2;
        const height = item.orientation === 'VERTICAL' ? DEFAULT_FURNITURE_SIZE : DEFAULT_FURNITURE_SIZE / 2;
        const screenY = wallHeight - item.position_y_mm - height;

        return (
          <Group
            key={item.furniture_id}
            x={item.position_x_mm}
            y={screenY}
            listening={false}
            data-furniture-id={item.furniture_id}
          >
            <Rect
              x={0}
              y={0}
              width={width}
              height={height}
              fill="#f0f0f0"
              stroke="#999999"
              strokeWidth={1 / zoom}
              listening={false}
            />
          </Group>
        );
      })}
    </Layer>
  );
}
