import { Layer, Line } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasLayer } from '@/types/canvas';

interface GridLayerProps {
  wallWidth: number;
  wallHeight: number;
}

/**
 * Renders a 100mm grid using Konva Lines.
 * Minor grid lines at gridSize intervals (light gray).
 * Major grid lines every 500mm (slightly darker).
 */
export function GridLayer({ wallWidth, wallHeight }: GridLayerProps) {
  const visible = useCanvasStore((s) => s.layerVisibility[CanvasLayer.GRID]);
  const gridSize = useCanvasStore((s) => s.gridConfig.size);

  if (!visible) return null;

  const lines: React.ReactElement[] = [];
  const majorInterval = 500; // Major grid every 500mm

  // Vertical lines
  for (let x = 0; x <= wallWidth; x += gridSize) {
    const isMajor = x % majorInterval === 0;
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, 0, x, wallHeight]}
        stroke={isMajor ? '#c0c0c0' : '#e0e0e0'}
        strokeWidth={isMajor ? 0.5 : 0.25}
        listening={false}
      />,
    );
  }

  // Horizontal lines
  for (let y = 0; y <= wallHeight; y += gridSize) {
    const isMajor = y % majorInterval === 0;
    lines.push(
      <Line
        key={`h-${y}`}
        points={[0, y, wallWidth, y]}
        stroke={isMajor ? '#c0c0c0' : '#e0e0e0'}
        strokeWidth={isMajor ? 0.5 : 0.25}
        listening={false}
      />,
    );
  }

  return <Layer listening={false}>{lines}</Layer>;
}
