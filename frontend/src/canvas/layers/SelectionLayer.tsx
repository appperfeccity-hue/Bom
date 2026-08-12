import { Layer, Rect } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode } from '@/types/database';
import { CanvasLayer } from '@/types/canvas';
import type { ZoneResizeHandle } from '@/types/canvas';
import { useZoneResize } from '@/canvas/interactions/useZoneResize';

/**
 * Renders selection UI for the currently selected zone(s).
 * Shows 8-point resize handles for single selection.
 * Shows combined bounding box for multi-selection.
 * Renders marquee rectangle when actively selecting.
 * Only shown in DESIGNER mode.
 */
interface SelectionLayerProps {
  wallHeight: number;
}

const HANDLE_SIZE = 8;
const TOUCH_HANDLE_SIZE = 16;

/** Detect if user has a coarse pointer (touch device). */
function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

interface HandlePosition {
  handle: ZoneResizeHandle;
  x: number;
  y: number;
  cursor: string;
}

export function SelectionLayer({ wallHeight }: SelectionLayerProps) {
  const visible = useCanvasStore((s) => s.layerVisibility[CanvasLayer.SELECTION]);
  const mode = useCanvasStore((s) => s.mode);
  const selection = useCanvasStore((s) => s.selection);
  const zones = useProjectStore((s) => s.zones);
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const { handleResizeStart } = useZoneResize();

  if (!visible || mode !== CanvasMode.DESIGNER) {
    return null;
  }

  const selectedZoneIds = selection.selectedZoneIds;
  const marqueeRect = selection.marqueeRect;
  const hasSelection = selectedZoneIds.length > 0;

  if (!hasSelection && !marqueeRect) {
    return null;
  }

  const selectedZones = zones.filter((z) => selectedZoneIds.includes(z.id));

  const effectiveHandleSize = isTouchDevice() ? TOUCH_HANDLE_SIZE : HANDLE_SIZE;
  const handleSizeScaled = effectiveHandleSize / zoom;
  const halfHandle = handleSizeScaled / 2;

  // For single selection, show resize handles on the selected zone
  const isSingleSelect = selectedZones.length === 1;
  const singleZone = isSingleSelect ? selectedZones[0] : null;

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

  // Single-zone handles
  let handles: HandlePosition[] = [];
  if (singleZone) {
    const screenY = wallHeight - singleZone.y_mm - singleZone.height_mm;
    const x = singleZone.x_mm;
    const w = singleZone.width_mm;
    const h = singleZone.height_mm;

    handles = [
      { handle: 'nw', x: x - halfHandle, y: screenY - halfHandle, cursor: 'nwse-resize' },
      { handle: 'n', x: x + w / 2 - halfHandle, y: screenY - halfHandle, cursor: 'ns-resize' },
      { handle: 'ne', x: x + w - halfHandle, y: screenY - halfHandle, cursor: 'nesw-resize' },
      { handle: 'e', x: x + w - halfHandle, y: screenY + h / 2 - halfHandle, cursor: 'ew-resize' },
      { handle: 'se', x: x + w - halfHandle, y: screenY + h - halfHandle, cursor: 'nwse-resize' },
      { handle: 's', x: x + w / 2 - halfHandle, y: screenY + h - halfHandle, cursor: 'ns-resize' },
      { handle: 'sw', x: x - halfHandle, y: screenY + h - halfHandle, cursor: 'nesw-resize' },
      { handle: 'w', x: x - halfHandle, y: screenY + h / 2 - halfHandle, cursor: 'ew-resize' },
    ];
  }

  return (
    <Layer>
      {/* Selection outlines for all selected zones */}
      {selectedZones.map((zone) => {
        const screenY = wallHeight - zone.y_mm - zone.height_mm;
        return (
          <Rect
            key={`selection-${zone.id}`}
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

      {/* Resize handles (single selection only) */}
      {singleZone &&
        handles.map((hp) => (
          <Rect
            key={hp.handle}
            x={hp.x}
            y={hp.y}
            width={handleSizeScaled}
            height={handleSizeScaled}
            fill="#ffffff"
            stroke="#1976d2"
            strokeWidth={1 / zoom}
            onMouseDown={() => handleResizeStart(singleZone, hp.handle)}
            onTouchStart={() => handleResizeStart(singleZone, hp.handle)}
            data-handle={hp.handle}
          />
        ))}

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
