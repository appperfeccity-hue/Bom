import { Layer, Rect } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasLayer } from '@/types/canvas';

interface LightingLayerProps {
  wallHeight: number;
}

/** Color map for lighting mounting types. */
const MOUNTING_COLORS: Record<string, string> = {
  DIRECT: '#FFD700',
  PROFILE: '#87CEEB',
  COVE: '#4FC3F7',
};

/**
 * Renders lighting items as indicators.
 * Since lighting no longer has explicit coordinates, this renders a placeholder
 * bar at the top of the wall for each lighting item, color-coded by mounting_type.
 */
export function LightingLayer(_props: LightingLayerProps) {
  const visible = useCanvasStore((s) => s.layerVisibility[CanvasLayer.LIGHTING]);
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const lighting = useProjectStore((s) => s.lighting);

  if (!visible) return null;

  return (
    <Layer listening={false}>
      {lighting.map((item, index) => {
        const color = MOUNTING_COLORS[item.mounting_type] ?? '#FFFFFF';
        // Render as a thin strip at the top of the wall, spaced by index
        const stripHeight = 20;
        const yOffset = index * (stripHeight + 5);

        return (
          <Rect
            key={item.lighting_id}
            x={0}
            y={yOffset}
            width={100}
            height={stripHeight}
            fill={color}
            opacity={0.6}
            stroke={color}
            strokeWidth={1 / zoom}
            listening={false}
            data-lighting-id={item.lighting_id}
          />
        );
      })}
    </Layer>
  );
}
