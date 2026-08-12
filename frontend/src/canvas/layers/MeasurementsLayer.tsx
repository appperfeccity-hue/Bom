import { Layer, Line, Text } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode } from '@/types/database';
import { CanvasLayer } from '@/types/canvas';

interface MeasurementsLayerProps {
  wallWidth: number;
  wallHeight: number;
}

/**
 * In CONSULTANT mode, renders dimension annotations:
 * wall width/height as dimension lines with values in mm.
 */
export function MeasurementsLayer({ wallWidth, wallHeight }: MeasurementsLayerProps) {
  const visible = useCanvasStore((s) => s.layerVisibility[CanvasLayer.MEASUREMENTS]);
  const mode = useCanvasStore((s) => s.mode);
  const measurements = useProjectStore((s) => s.measurements);
  const zoom = useCanvasStore((s) => s.viewport.zoom);

  if (!visible || mode !== CanvasMode.CONSULTANT) return null;

  const offset = 30 / zoom; // Offset for dimension lines from wall
  const fontSize = 12 / zoom;
  const arrowSize = 6 / zoom;

  const displayWidth = measurements?.wall_width_mm ?? wallWidth;
  const displayHeight = measurements?.wall_height_mm ?? wallHeight;

  return (
    <Layer listening={false}>
      {/* Width dimension line (below wall) */}
      <Line
        points={[0, wallHeight + offset, wallWidth, wallHeight + offset]}
        stroke="#666666"
        strokeWidth={1 / zoom}
      />
      {/* Width arrows */}
      <Line
        points={[0, wallHeight + offset - arrowSize, 0, wallHeight + offset + arrowSize]}
        stroke="#666666"
        strokeWidth={1 / zoom}
      />
      <Line
        points={[wallWidth, wallHeight + offset - arrowSize, wallWidth, wallHeight + offset + arrowSize]}
        stroke="#666666"
        strokeWidth={1 / zoom}
      />
      {/* Width label */}
      <Text
        x={wallWidth / 2 - 40 / zoom}
        y={wallHeight + offset + 5 / zoom}
        text={`${displayWidth} mm`}
        fontSize={fontSize}
        fill="#333333"
      />

      {/* Height dimension line (left of wall) */}
      <Line
        points={[-offset, 0, -offset, wallHeight]}
        stroke="#666666"
        strokeWidth={1 / zoom}
      />
      {/* Height arrows */}
      <Line
        points={[-offset - arrowSize, 0, -offset + arrowSize, 0]}
        stroke="#666666"
        strokeWidth={1 / zoom}
      />
      <Line
        points={[-offset - arrowSize, wallHeight, -offset + arrowSize, wallHeight]}
        stroke="#666666"
        strokeWidth={1 / zoom}
      />
      {/* Height label */}
      <Text
        x={-offset - 50 / zoom}
        y={wallHeight / 2}
        text={`${displayHeight} mm`}
        fontSize={fontSize}
        fill="#333333"
        rotation={-90}
      />
    </Layer>
  );
}
