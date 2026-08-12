import { Layer, Rect } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode } from '@/types/database';
import { CanvasLayer } from '@/types/canvas';
import type { ZoneResizeHandle } from '@/types/canvas';

/**
 * Renders selection UI for the currently selected zone.
 * Shows 8-point resize handles at corners and edge midpoints.
 * Only shown in DESIGNER mode.
 */
interface SelectionLayerProps {
  wallHeight: number;
}

const HANDLE_SIZE = 8;

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

  if (!visible || mode !== CanvasMode.DESIGNER || !selection.selectedZoneId) {
    return null;
  }

  const selectedZone = zones.find((z) => z.id === selection.selectedZoneId);
  if (!selectedZone) return null;

  // Convert to screen coordinates (top-left origin)
  const screenY = wallHeight - selectedZone.y_mm - selectedZone.height_mm;
  const x = selectedZone.x_mm;
  const w = selectedZone.width_mm;
  const h = selectedZone.height_mm;

  const handleSizeScaled = HANDLE_SIZE / zoom;
  const halfHandle = handleSizeScaled / 2;

  // 8-point handle positions relative to zone bounding box
  const handles: HandlePosition[] = [
    { handle: 'nw', x: x - halfHandle, y: screenY - halfHandle, cursor: 'nwse-resize' },
    { handle: 'n', x: x + w / 2 - halfHandle, y: screenY - halfHandle, cursor: 'ns-resize' },
    { handle: 'ne', x: x + w - halfHandle, y: screenY - halfHandle, cursor: 'nesw-resize' },
    { handle: 'e', x: x + w - halfHandle, y: screenY + h / 2 - halfHandle, cursor: 'ew-resize' },
    { handle: 'se', x: x + w - halfHandle, y: screenY + h - halfHandle, cursor: 'nwse-resize' },
    { handle: 's', x: x + w / 2 - halfHandle, y: screenY + h - halfHandle, cursor: 'ns-resize' },
    { handle: 'sw', x: x - halfHandle, y: screenY + h - halfHandle, cursor: 'nesw-resize' },
    { handle: 'w', x: x - halfHandle, y: screenY + h / 2 - halfHandle, cursor: 'ew-resize' },
  ];

  return (
    <Layer>
      {/* Selection outline */}
      <Rect
        x={x}
        y={screenY}
        width={w}
        height={h}
        stroke="#1976d2"
        strokeWidth={2 / zoom}
        dash={[6 / zoom, 3 / zoom]}
        listening={false}
      />
      {/* Resize handles */}
      {handles.map((hp) => (
        <Rect
          key={hp.handle}
          x={hp.x}
          y={hp.y}
          width={handleSizeScaled}
          height={handleSizeScaled}
          fill="#ffffff"
          stroke="#1976d2"
          strokeWidth={1 / zoom}
          data-handle={hp.handle}
        />
      ))}
    </Layer>
  );
}
