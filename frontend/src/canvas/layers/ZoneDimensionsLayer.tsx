import React from 'react';
import { Layer, Line, Text } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode } from '@/types/database';
import { CanvasLayer } from '@/types/canvas';

interface ZoneDimensionsLayerProps {
  wallHeight: number;
}

/**
 * Renders dimension annotations (width and height labels) on each zone's edges.
 * Shows thin dimension lines with tick marks and centered text labels.
 * Visible in DESIGNER mode.
 */
export function ZoneDimensionsLayer({ wallHeight }: ZoneDimensionsLayerProps) {
  const visible = useCanvasStore((s) => s.layerVisibility[CanvasLayer.ZONE_DIMENSIONS]);
  const mode = useCanvasStore((s) => s.mode);
  const zones = useProjectStore((s) => s.zones);
  const zoom = useCanvasStore((s) => s.viewport.zoom);

  if (!visible || mode !== CanvasMode.DESIGNER) return null;
  if (zones.length === 0) return null;

  const tickSize = 4 / zoom;
  const fontSize = 10 / zoom;
  const lineOffset = 12 / zoom;

  return (
    <Layer listening={false}>
      {zones.map((zone) => {
        // Convert from bottom-left origin to top-left origin for Konva rendering
        const konvaX = zone.x_mm;
        const konvaY = wallHeight - zone.y_mm - zone.height_mm;
        const w = zone.width_mm;
        const h = zone.height_mm;

        return (
          <React.Fragment key={zone.zone_id}>
            {/* Width dimension line (below the zone) */}
            <Line
              points={[konvaX, konvaY + h + lineOffset, konvaX + w, konvaY + h + lineOffset]}
              stroke="#555555"
              strokeWidth={0.5 / zoom}
            />
            {/* Width left tick */}
            <Line
              points={[konvaX, konvaY + h + lineOffset - tickSize, konvaX, konvaY + h + lineOffset + tickSize]}
              stroke="#555555"
              strokeWidth={0.5 / zoom}
            />
            {/* Width right tick */}
            <Line
              points={[konvaX + w, konvaY + h + lineOffset - tickSize, konvaX + w, konvaY + h + lineOffset + tickSize]}
              stroke="#555555"
              strokeWidth={0.5 / zoom}
            />
            {/* Width label */}
            <Text
              x={konvaX + w / 2 - 20 / zoom}
              y={konvaY + h + lineOffset + tickSize + 1 / zoom}
              text={`${zone.width_mm}`}
              fontSize={fontSize}
              fill="#333333"
            />

            {/* Height dimension line (right side of zone) */}
            <Line
              points={[konvaX + w + lineOffset, konvaY, konvaX + w + lineOffset, konvaY + h]}
              stroke="#555555"
              strokeWidth={0.5 / zoom}
            />
            {/* Height top tick */}
            <Line
              points={[konvaX + w + lineOffset - tickSize, konvaY, konvaX + w + lineOffset + tickSize, konvaY]}
              stroke="#555555"
              strokeWidth={0.5 / zoom}
            />
            {/* Height bottom tick */}
            <Line
              points={[konvaX + w + lineOffset - tickSize, konvaY + h, konvaX + w + lineOffset + tickSize, konvaY + h]}
              stroke="#555555"
              strokeWidth={0.5 / zoom}
            />
            {/* Height label */}
            <Text
              x={konvaX + w + lineOffset + tickSize + 1 / zoom}
              y={konvaY + h / 2 - fontSize / 2}
              text={`${zone.height_mm}`}
              fontSize={fontSize}
              fill="#333333"
            />
          </React.Fragment>
        );
      })}
    </Layer>
  );
}
