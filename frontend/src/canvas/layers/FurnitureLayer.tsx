import { Layer, Rect, Text, Group } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasLayer } from '@/types/canvas';

interface FurnitureLayerProps {
  wallHeight: number;
}

/**
 * Renders positioned rectangles with name labels for each furniture item.
 * Applies rotation_deg around the center of each rectangle.
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
        const screenY = wallHeight - item.y_mm - item.height_mm;

        return (
          <Group
            key={item.id}
            x={item.x_mm + item.width_mm / 2}
            y={screenY + item.height_mm / 2}
            offsetX={item.width_mm / 2}
            offsetY={item.height_mm / 2}
            rotation={item.rotation_deg}
            listening={false}
            data-furniture-id={item.id}
          >
            <Rect
              x={0}
              y={0}
              width={item.width_mm}
              height={item.height_mm}
              fill="#f0f0f0"
              stroke="#999999"
              strokeWidth={1 / zoom}
              listening={false}
            />
            <Text
              x={0}
              y={item.height_mm / 2 - 7 / zoom}
              width={item.width_mm}
              text={item.name}
              fontSize={14 / zoom}
              fill="#333333"
              align="center"
              listening={false}
            />
          </Group>
        );
      })}
    </Layer>
  );
}
