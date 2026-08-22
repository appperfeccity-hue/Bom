/**
 * Lighting installation geometry (spec sections 18-20).
 *
 * COVE and PROFILE are different PHYSICAL installation relationships, not just
 * different numeric offsets:
 *   COVE:    wall -> structure -> cove light -> panel   (light sits in the
 *            Z-depth the structure creates BETWEEN wall and panel)
 *   PROFILE: wall -> panel -> profile light             (light mounts on the
 *            panel FACE; no structure)
 *   DIRECT:  wall -> light                              (no offset, no structure)
 *
 * The lightEngine offsets (DIRECT=0, PROFILE=5, COVE=10) remain the quantity
 * math; this module only describes the geometry so the two are not drawn or
 * reasoned about as the same thing.
 */

import type { LightingInstallationGeometry, MountingType } from './types';

export const LIGHTING_GEOMETRY: Record<MountingType, LightingInstallationGeometry> = {
  DIRECT: {
    mountingType: 'DIRECT',
    layerOrder: ['WALL', 'LIGHT'],
    mountingSurface: 'WALL',
    requiresStructure: false,
    /** Light sits in the wall plane. */
    createsZDepthBetweenWallAndPanel: false,
    offsetMm: 0,
  },
  PROFILE: {
    mountingType: 'PROFILE',
    layerOrder: ['WALL', 'PANEL', 'LIGHT'],
    mountingSurface: 'PANEL_FACE',
    requiresStructure: false,
    createsZDepthBetweenWallAndPanel: false,
    offsetMm: 5,
  },
  COVE: {
    mountingType: 'COVE',
    layerOrder: ['WALL', 'STRUCTURE', 'LIGHT', 'PANEL'],
    mountingSurface: 'STRUCTURE',
    requiresStructure: true,
    createsZDepthBetweenWallAndPanel: true,
    offsetMm: 10,
  },
};

export function getLightingGeometry(
  mountingType: MountingType,
): LightingInstallationGeometry {
  return LIGHTING_GEOMETRY[mountingType] ?? LIGHTING_GEOMETRY.DIRECT;
}

/** True when the light is installed behind the panel (cove pocket). */
export function isBehindPanel(mountingType: MountingType): boolean {
  return getLightingGeometry(mountingType).createsZDepthBetweenWallAndPanel;
}

/** True when the mounting type needs a supporting structure (cove only). */
export function requiresStructure(mountingType: MountingType): boolean {
  return getLightingGeometry(mountingType).requiresStructure;
}
