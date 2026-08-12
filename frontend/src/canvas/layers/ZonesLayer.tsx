import { Layer, Rect, Text } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { useBomStore } from '@/stores/bomStore';
import { CanvasMode } from '@/types/database';
import { CanvasLayer } from '@/types/canvas';
import { useZoneValidation } from '@/canvas/utils/useZoneValidation';
import type { TemplateZone } from '@/types/database';

interface ZonesLayerProps {
  wallHeight: number;
}

/**
 * Renders all zones from projectStore as Konva Rects.
 * In DESIGNER mode: zones are interactive (clicks select, drag to move).
 * In CONSULTANT mode: read-only.
 */
export function ZonesLayer({ wallHeight }: ZonesLayerProps) {
  const visible = useCanvasStore((s) => s.layerVisibility[CanvasLayer.ZONES]);
  const mode = useCanvasStore((s) => s.mode);
  const selection = useCanvasStore((s) => s.selection);
  const selectZone = useCanvasStore((s) => s.selectZone);
  const toggleZoneSelection = useCanvasStore((s) => s.toggleZoneSelection);
  const highlightedZoneIds = useCanvasStore((s) => s.highlightedZoneIds);
  const setHighlightedBomLineIds = useCanvasStore((s) => s.setHighlightedBomLineIds);
  const zones = useProjectStore((s) => s.zones);
  const zoneSku = useProjectStore((s) => s.zoneSku);
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const validationMap = useZoneValidation();

  if (!visible) return null;

  const isDesigner = mode === CanvasMode.DESIGNER;

  const handleZoneClick = (zone: TemplateZone, e: { evt: Event }) => {
    if (isDesigner) {
      const nativeEvt = e.evt as MouseEvent | TouchEvent;
      const shiftHeld = 'shiftKey' in nativeEvt && (nativeEvt as MouseEvent).shiftKey;
      if (shiftHeld) {
        toggleZoneSelection(zone.id);
      } else {
        selectZone(zone.id);
      }

      // Highlight corresponding BOM lines for the clicked zone
      const bomLines = useBomStore.getState().masterBomLines;
      const matchingLineIds = bomLines
        .filter((line) => line.source_zone_id === zone.id)
        .map((line) => line.master_bom_line_id);
      setHighlightedBomLineIds(matchingLineIds);
    }
  };

  return (
    <Layer>
      {zones.map((zone) => {
        const isSelected = selection.selectedZoneIds.includes(zone.id);
        const isHighlighted = highlightedZoneIds.includes(zone.id);
        const hasErrors = validationMap.has(zone.id);

        // Convert from bottom-left origin to top-left (Konva)
        const screenY = wallHeight - zone.y_mm - zone.height_mm;

        // Determine stroke color: red for invalid, gold for highlighted, blue for selected
        const strokeColor = hasErrors
          ? '#f44336'
          : isHighlighted
            ? '#ffc107'
            : isSelected
              ? '#1976d2'
              : '#90caf9';

        return (
          <Rect
            key={zone.id}
            x={zone.x_mm}
            y={screenY}
            width={zone.width_mm}
            height={zone.height_mm}
            fill={isHighlighted ? '#fff8e1' : isSelected ? '#bbdefb' : '#e3f2fd'}
            stroke={strokeColor}
            strokeWidth={(isHighlighted ? 3 : isSelected || hasErrors ? 2 : 1) / zoom}
            onClick={(e) => handleZoneClick(zone, e)}
            onTap={(e) => handleZoneClick(zone, e)}
            listening={isDesigner}
            data-zone-id={zone.id}
          />
        );
      })}
      {/* Zone labels */}
      {zones.map((zone, index) => {
        const sku = zoneSku.get(zone.id);
        const label = sku ? sku.sku_code : `Zone ${index + 1}`;
        const screenY = wallHeight - zone.y_mm - zone.height_mm;

        return (
          <Text
            key={`label-${zone.id}`}
            x={zone.x_mm + 10}
            y={screenY + 10}
            text={label}
            fontSize={14 / zoom}
            fill="#333333"
            listening={false}
          />
        );
      })}
    </Layer>
  );
}
