import { describe, it, expect } from 'vitest';
import {
  getLightingGeometry,
  isBehindPanel,
  requiresStructure,
} from '../lightingGeometry';

describe('lightingGeometry', () => {
  it('models COVE as wall -> structure -> light -> panel', () => {
    const cove = getLightingGeometry('COVE');
    expect(cove.layerOrder).toEqual(['WALL', 'STRUCTURE', 'LIGHT', 'PANEL']);
    expect(cove.mountingSurface).toBe('STRUCTURE');
    expect(cove.requiresStructure).toBe(true);
    expect(cove.createsZDepthBetweenWallAndPanel).toBe(true);
    expect(cove.offsetMm).toBe(10);
  });

  it('models PROFILE as wall -> panel -> light on the panel face', () => {
    const profile = getLightingGeometry('PROFILE');
    expect(profile.layerOrder).toEqual(['WALL', 'PANEL', 'LIGHT']);
    expect(profile.mountingSurface).toBe('PANEL_FACE');
    expect(profile.requiresStructure).toBe(false);
    expect(profile.createsZDepthBetweenWallAndPanel).toBe(false);
    expect(profile.offsetMm).toBe(5);
  });

  it('models DIRECT with no offset and no structure', () => {
    const direct = getLightingGeometry('DIRECT');
    expect(direct.layerOrder).toEqual(['WALL', 'LIGHT']);
    expect(direct.offsetMm).toBe(0);
    expect(direct.requiresStructure).toBe(false);
  });

  it('distinguishes cove and profile geometry', () => {
    expect(isBehindPanel('COVE')).toBe(true);
    expect(isBehindPanel('PROFILE')).toBe(false);
    expect(requiresStructure('COVE')).toBe(true);
    expect(requiresStructure('PROFILE')).toBe(false);
    expect(getLightingGeometry('COVE').layerOrder).not.toEqual(
      getLightingGeometry('PROFILE').layerOrder,
    );
  });
});
