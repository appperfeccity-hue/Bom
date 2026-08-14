import { Layer, Rect, Text } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { useBomStore } from '@/stores/bomStore';
import { CanvasLayer } from '@/types/canvas';
import { useZoneValidation } from '@/canvas/utils/useZoneValidation';
import type { TemplateZone } from '@/types/database';

interface ZonesLayerProps {
  wallHeight: number;
}

/** Extra hit stroke width for touch devices to make zones easier to tap. */
const TOUCH_HIT_PADDING = 10;

/** Detect if user has a coarse pointer (touch device). */
function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/**
 * Renders all zones from projectStore as Konva Rects.
 * Zones are now system-generated (from wallConfigEngine) and read-only
 * in both DESIGNER and CONSULTANT modes (Rule 65).
 * Selection is allowed for SKU assignment viewing.
 * A visual indicator (dashed stroke pattern) shows zones are system-generated.
 */
export function ZonesLayer({ wallHeight }: ZonesLayerProps) {
  const visible = useCanvasStore((s) => s.layerVisibility[CanvasLayer.ZONES]);
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

  const handleZoneClick = (zone: TemplateZone, e: { evt: Event }) => {
    // Allow selection for SKU viewing (read-only - no editing)
    const nativeEvt = e.evt as MouseEvent | TouchEvent;
    const shiftHeld = 'shiftKey' in nativeEvt && (nativeEvt as MouseEvent).shiftKey;
    if (shiftHeld) {
      toggleZoneSelection(zone.zone_id);
    } else {
      selectZone(zone.zone_id);
    }

    // Highlight corresponding BOM lines for the clicked zone
    const bomLines = useBomStore.getState().masterBomLines;
    const matchingLineIds = bomLines
      .filter((line) => line.source_zone_id === zone.zone_id)
      .map((line) => line.master_bom_line_id);
    setHighlightedBomLineIds(matchingLineIds);
  };

  return (
    <Layer>
      {zones.map((zone) => {
        const isSelected = selection.selectedZoneIds.includes(zone.zone_id);
        const isHighlighted = highlightedZoneIds.includes(zone.zone_id);
        const hasErrors = validationMap.has(zone.zone_id);

        // Convert from bottom-left origin to top-left (Konva)
        const screenY = wallHeight - zone.y_mm - zone.height_mm;

        // Determine stroke color based on zone state
        // --color-error, --color-accent, --color-accent, --color-ink-secondary
        const strokeColor = hasErrors
          ? '#B0413E'
          : isHighlighted
            ? '#9A7B4F'
            : isSelected
              ? '#9A7B4F'
              : '#6E6E6E';

        // Determine fill color based on zone state
        // error 4%, accent 12%, accent 8%, canvas tint 50%
        const fillColor = hasErrors
          ? 'rgba(176, 65, 62, 0.04)'
          : isHighlighted
            ? 'rgba(154, 123, 79, 0.12)'
            : isSelected
              ? 'rgba(154, 123, 79, 0.08)'
              : 'rgba(246, 245, 243, 0.5)';

        return (
          <Rect
            key={zone.zone_id}
            x={zone.x_mm}
            y={screenY}
            width={zone.width_mm}
            height={zone.height_mm}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={(isHighlighted ? 2 : isSelected ? 1.5 : hasErrors ? 1.5 : 1) / zoom}
            hitStrokeWidth={isTouchDevice() ? TOUCH_HIT_PADDING / zoom : 0}
            onClick={(e) => handleZoneClick(zone, e)}
            onTap={(e) => handleZoneClick(zone, e)}
            listening={true}
            data-zone-id={zone.zone_id}
          />
        );
      })}
      {/* Zone labels */}
      {zones.map((zone, index) => {
        const sku = zoneSku.get(zone.zone_id);
        const label = sku ? sku.sku_code : `Zone ${index + 1}`;
        const screenY = wallHeight - zone.y_mm - zone.height_mm;

        return (
          <Text
            key={`label-${zone.zone_id}`}
            x={zone.x_mm + 10}
            y={screenY + 10}
            text={label}
            fontSize={14 / zoom}
            fill="#1A1A1A" /* --color-ink-primary */
            listening={false}
          />
        );
      })}
    </Layer>
  );
}
