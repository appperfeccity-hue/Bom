import { Layer, Line } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasLayer } from '@/types/canvas';

interface SnapGuidesLayerProps {
  wallWidth: number;
  wallHeight: number;
}

/**
 * Renders visual snap guide lines at active snap positions.
 * Vertical lines span the full wall height; horizontal lines span full wall width.
 * Displayed as thin dashed cyan lines while snapping is active during drag.
 */
export function SnapGuidesLayer({ wallWidth, wallHeight }: SnapGuidesLayerProps) {
  const visible = useCanvasStore((s) => s.layerVisibility[CanvasLayer.SNAP_GUIDES]);
  const activeSnapLines = useCanvasStore((s) => s.activeSnapLines);
  const zoom = useCanvasStore((s) => s.viewport.zoom);

  if (!visible) return null;

  const hasLines = activeSnapLines.vertical.length > 0 || activeSnapLines.horizontal.length > 0;
  if (!hasLines) return null;

  return (
    <Layer>
      {activeSnapLines.vertical.map((x, i) => (
        <Line
          key={`snap-v-${i}`}
          points={[x, 0, x, wallHeight]}
          stroke="#00bcd4"
          strokeWidth={1 / zoom}
          dash={[6 / zoom, 4 / zoom]}
          listening={false}
        />
      ))}
      {activeSnapLines.horizontal.map((y, i) => (
        <Line
          key={`snap-h-${i}`}
          points={[0, wallHeight - y, wallWidth, wallHeight - y]}
          stroke="#00bcd4"
          strokeWidth={1 / zoom}
          dash={[6 / zoom, 4 / zoom]}
          listening={false}
        />
      ))}
    </Layer>
  );
}
