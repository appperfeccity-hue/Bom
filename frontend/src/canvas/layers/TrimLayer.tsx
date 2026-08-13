import { Layer, Rect } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasLayer } from '@/types/canvas';

interface TrimLayerProps {
  wallHeight: number;
}

/**
 * Renders trim items as indicators.
 * PHYSICAL type: brown indicator.
 * GEOMETRY type: grey indicator.
 * Since trims no longer have path_mm coordinates, renders as colored bars.
 */
export function TrimLayer({ wallHeight }: TrimLayerProps) {
  const visible = useCanvasStore((s) => s.layerVisibility[CanvasLayer.TRIMS]);
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const trims = useProjectStore((s) => s.trims);

  if (!visible) return null;

  return (
    <Layer listening={false}>
      {trims.map((item, index) => {
        const isPhysical = item.trim_type === 'PHYSICAL';
        const barHeight = 10;
        const yPos = wallHeight - (index + 1) * (barHeight + 5);

        return (
          <Rect
            key={item.trim_id}
            x={0}
            y={yPos}
            width={80}
            height={barHeight}
            fill={isPhysical ? '#795548' : '#9e9e9e'}
            opacity={0.7}
            strokeWidth={1 / zoom}
            listening={false}
            data-trim-id={item.trim_id}
          />
        );
      })}
    </Layer>
  );
}
