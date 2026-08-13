import { Layer, Circle, Text } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasLayer } from '@/types/canvas';
import { useZoneValidation } from '@/canvas/utils/useZoneValidation';

interface ValidationOverlayLayerProps {
  wallHeight: number;
}

/**
 * Renders error badge indicators on zones that have validation errors.
 * For each invalid zone, renders a small red circle badge with the error count
 * at the top-right corner of the zone.
 * Visibility is tied to the ZONES layer visibility.
 */
export function ValidationOverlayLayer({ wallHeight }: ValidationOverlayLayerProps) {
  const visible = useCanvasStore((s) => s.layerVisibility[CanvasLayer.ZONES]);
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const zones = useProjectStore((s) => s.zones);
  const validationMap = useZoneValidation();

  if (!visible) return null;

  const invalidZones = zones.filter((z) => validationMap.has(z.zone_id));

  if (invalidZones.length === 0) return null;

  return (
    <Layer>
      {invalidZones.map((zone) => {
        const validation = validationMap.get(zone.zone_id);
        if (!validation) return null;

        const errorCount = validation.errors.length;
        // Position badge at top-right corner of the zone (in screen coords)
        const screenY = wallHeight - zone.y_mm - zone.height_mm;
        const badgeX = zone.x_mm + zone.width_mm - 12 / zoom;
        const badgeY = screenY + 12 / zoom;
        const radius = 10 / zoom;

        return (
          <Circle
            key={`badge-${zone.zone_id}`}
            x={badgeX}
            y={badgeY}
            radius={radius}
            fill="#f44336"
            listening={false}
          />
        );
      })}
      {invalidZones.map((zone) => {
        const validation = validationMap.get(zone.zone_id);
        if (!validation) return null;

        const errorCount = validation.errors.length;
        const screenY = wallHeight - zone.y_mm - zone.height_mm;
        const badgeX = zone.x_mm + zone.width_mm - 12 / zoom;
        const badgeY = screenY + 12 / zoom;

        return (
          <Text
            key={`badge-text-${zone.zone_id}`}
            x={badgeX - 5 / zoom}
            y={badgeY - 5 / zoom}
            text={String(errorCount)}
            fontSize={10 / zoom}
            fill="#ffffff"
            fontStyle="bold"
            listening={false}
          />
        );
      })}
    </Layer>
  );
}
