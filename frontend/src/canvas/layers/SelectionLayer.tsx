import { Layer, Rect } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode } from '@/types/database';
import { CanvasLayer } from '@/types/canvas';

/**
 * Renders selection UI for the currently selected zone(s).
 * Shows selection outlines and combined bounding box for multi-selection.
 * Renders marquee rectangle when actively selecting.
 *
 * Note: Resize handles have been removed (Rule 65). Panel frame zones are
 * system-generated and read-only - they cannot be manually resized.
 */
interface SelectionLayerProps {
  wallHeight: number;
}

export function SelectionLayer({ wallHeight }: SelectionLayerProps) {
  const visible = useCanvasStore((s) => s.layerVisibility[CanvasLayer.SELECTION]);
  const mode = useCanvasStore((s) => s.mode);
  const selection = useCanvasStore((s) => s.selection);
  const zones = useProjectStore((s) => s.zones);
  const zoom = useCanvasStore((s) => s.viewport.zoom);

  if (!visible || mode !== CanvasMode.DESIGNER) {
    return null;
  }

  const selectedZoneIds = selection.selectedZoneIds;
  const marqueeRect = selection.marqueeRect;
  const hasSelection = selectedZoneIds.length > 0;

  if (!hasSelection && !marqueeRect) {
    return null;
  }

  const selectedZones = zones.filter((z) => selectedZoneIds.includes(z.zone_id));

  // Compute combined bounding box for all selected zones (in canvas coords)
  let groupScreenX = 0;
  let groupScreenY = 0;
  let groupW = 0;
  let groupH = 0;

  if (selectedZones.length > 0) {
    const minX = Math.min(...selectedZones.map((z) => z.x_mm));
    const maxX = Math.max(...selectedZones.map((z) => z.x_mm + z.width_mm));
    const minY = Math.min(...selectedZones.map((z) => z.y_mm));
    const maxY = Math.max(...selectedZones.map((z) => z.y_mm + z.height_mm));

    groupScreenX = minX;
    groupScreenY = wallHeight - maxY; // Convert top of combined box to screen Y
    groupW = maxX - minX;
    groupH = maxY - minY;
  }

  return (
    <Layer>
      {/* Selection outlines for all selected zones */}
      {selectedZones.map((zone) => {
        const screenY = wallHeight - zone.y_mm - zone.height_mm;
        return (
          <Rect
            key={`selection-${zone.zone_id}`}
            x={zone.x_mm}
            y={screenY}
            width={zone.width_mm}
            height={zone.height_mm}
            stroke="#1976d2"
            strokeWidth={2 / zoom}
            dash={[6 / zoom, 3 / zoom]}
            listening={false}
          />
        );
      })}

      {/* Multi-selection combined bounding box */}
      {selectedZones.length > 1 && (
        <Rect
          x={groupScreenX}
          y={groupScreenY}
          width={groupW}
          height={groupH}
          stroke="#1976d2"
          strokeWidth={1 / zoom}
          dash={[4 / zoom, 4 / zoom]}
          listening={false}
        />
      )}

      {/* Marquee rectangle (rubber-band selection preview) */}
      {marqueeRect && (
        <Rect
          x={marqueeRect.x}
          y={wallHeight - marqueeRect.y - marqueeRect.height}
          width={marqueeRect.width}
          height={marqueeRect.height}
          fill="rgba(25, 118, 210, 0.08)"
          stroke="#1976d2"
          strokeWidth={1 / zoom}
          dash={[4 / zoom, 2 / zoom]}
          listening={false}
        />
      )}
    </Layer>
  );
}
