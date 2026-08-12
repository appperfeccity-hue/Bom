import { Layer, Rect } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasLayer } from '@/types/canvas';

interface LightingLayerProps {
  wallHeight: number;
}

/** Color map for lighting types. */
const LIGHTING_COLORS: Record<string, string> = {
  CEILING: '#FFD700',
  WALL: '#87CEEB',
  UNDER_SHELF: '#4FC3F7',
};

/**
 * Renders LED strip representations for each lighting item.
 * Color-coded by mounting type (type field).
 * Converts from bottom-left origin (mm) to Konva top-left using wallHeight.
 */
export function LightingLayer({ wallHeight }: LightingLayerProps) {
  const visible = useCanvasStore((s) => s.layerVisibility[CanvasLayer.LIGHTING]);
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const lighting = useProjectStore((s) => s.lighting);

  if (!visible) return null;

  return (
    <Layer listening={false}>
      {lighting.map((item) => {
        const screenY = wallHeight - item.y_mm - item.height_mm;
        const color = LIGHTING_COLORS[item.type] ?? '#FFFFFF';

        return (
          <Rect
            key={item.id}
            x={item.x_mm}
            y={screenY}
            width={item.width_mm}
            height={item.height_mm}
            fill={color}
            opacity={0.6}
            stroke={color}
            strokeWidth={1 / zoom}
            listening={false}
            data-lighting-id={item.id}
          />
        );
      })}
    </Layer>
  );
}
