import { Layer, Group, Line, Rect } from 'react-konva';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasLayer } from '@/types/canvas';
import { getLightingGeometry } from '@/engines/lightingGeometry';
import type { MountingType } from '@/engines/types';

interface LightingLayerProps {
  wallHeight: number;
}

/** Color map for lighting mounting types. */
const MOUNTING_COLORS: Record<string, string> = {
  DIRECT: '#FFD700',
  PROFILE: '#87CEEB',
  COVE: '#4FC3F7',
};

/** Structure (cove pocket) outline colour. */
const STRUCTURE_COLOR = '#8A6D3B';
/** Panel outline colour used to show what the light sits behind / on. */
const PANEL_COLOR = '#1A1A1A';

/**
 * Renders lighting items as indicators, drawn per installation geometry
 * (spec sections 18-20) so COVE and PROFILE are visibly different:
 *   COVE    - structure bracket + light recessed BEHIND the panel outline
 *   PROFILE - light strip on the panel FACE, in front of the panel outline
 *   DIRECT  - light strip on the wall, no panel or structure
 */
export function LightingLayer(_props: LightingLayerProps) {
  const visible = useCanvasStore((s) => s.layerVisibility[CanvasLayer.LIGHTING]);
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const lighting = useProjectStore((s) => s.lighting);

  if (!visible) return null;

  const stroke = 1 / zoom;

  return (
    <Layer listening={false}>
      {lighting.map((item, index) => {
        const mountingType = item.mounting_type as MountingType;
        const geometry = getLightingGeometry(mountingType);
        const color = MOUNTING_COLORS[mountingType] ?? '#FFFFFF';
        const stripHeight = 20;
        const yOffset = index * (stripHeight + 5);

        return (
          <Group
            key={item.lighting_id}
            name={`lighting-${geometry.mountingType}`}
            data-lighting-id={item.lighting_id}
          >
            {/* COVE: structure creating the Z-depth pocket between wall and panel */}
            {geometry.requiresStructure && (
              <Line
                name="cove-structure"
                points={[0, yOffset, 0, yOffset + stripHeight, 100, yOffset + stripHeight]}
                stroke={STRUCTURE_COLOR}
                strokeWidth={stroke * 2}
                listening={false}
              />
            )}

            {/* The luminaire itself */}
            <Rect
              name="light-body"
              x={geometry.createsZDepthBetweenWallAndPanel ? 6 : 0}
              y={yOffset}
              width={geometry.createsZDepthBetweenWallAndPanel ? 88 : 100}
              height={geometry.createsZDepthBetweenWallAndPanel ? stripHeight - 6 : stripHeight}
              fill={color}
              /* Cove light is behind the panel, so it reads as recessed. */
              opacity={geometry.createsZDepthBetweenWallAndPanel ? 0.35 : 0.6}
              stroke={color}
              strokeWidth={stroke}
              listening={false}
            />

            {/* Panel outline: in front of a cove light, behind a profile light */}
            {geometry.layerOrder.includes('PANEL') && (
              <Rect
                name="panel-outline"
                x={0}
                y={yOffset}
                width={100}
                height={stripHeight}
                stroke={PANEL_COLOR}
                strokeWidth={stroke}
                dash={
                  geometry.createsZDepthBetweenWallAndPanel
                    ? undefined
                    : [4 / zoom, 3 / zoom]
                }
                listening={false}
              />
            )}
          </Group>
        );
      })}
    </Layer>
  );
}
