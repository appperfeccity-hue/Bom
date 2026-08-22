import { describe, it, expect } from 'vitest';
import {
  normalizeWallType,
  denormalizeWallType,
  isLShape,
  isAcceptedWallType,
  wallTypeLabel,
  L_SHAPE_CORNER_ORIGIN,
} from '../wallType';

describe('wallType alias helper', () => {
  it('normalizes the legacy and canonical corner values to L_SHAPE', () => {
    expect(normalizeWallType('L_CORNER')).toBe('L_SHAPE');
    expect(normalizeWallType('L_SHAPE')).toBe('L_SHAPE');
  });

  it('leaves STRAIGHT untouched and falls back to STRAIGHT for unknown values', () => {
    expect(normalizeWallType('STRAIGHT')).toBe('STRAIGHT');
    expect(normalizeWallType(null)).toBe('STRAIGHT');
    expect(normalizeWallType(undefined)).toBe('STRAIGHT');
    expect(normalizeWallType('CURVED')).toBe('STRAIGHT');
  });

  it('denormalizes to the vocabulary the target column accepts', () => {
    expect(denormalizeWallType('L_SHAPE', 'LEGACY')).toBe('L_CORNER');
    expect(denormalizeWallType('L_CORNER', 'LEGACY')).toBe('L_CORNER');
    expect(denormalizeWallType('L_CORNER', 'CANONICAL')).toBe('L_SHAPE');
    expect(denormalizeWallType('L_SHAPE')).toBe('L_SHAPE');
    expect(denormalizeWallType('STRAIGHT', 'LEGACY')).toBe('STRAIGHT');
  });

  it('accepts both values in readers and validators', () => {
    expect(isLShape('L_CORNER')).toBe(true);
    expect(isLShape('L_SHAPE')).toBe(true);
    expect(isLShape('STRAIGHT')).toBe(false);
    expect(isAcceptedWallType('L_CORNER')).toBe(true);
    expect(isAcceptedWallType('L_SHAPE')).toBe(true);
    expect(isAcceptedWallType('STRAIGHT')).toBe(true);
    expect(isAcceptedWallType('L_BEND')).toBe(false);
  });

  it('labels both corner values with the canonical display name', () => {
    expect(wallTypeLabel('L_CORNER')).toBe('L-Shape');
    expect(wallTypeLabel('L_SHAPE')).toBe('L-Shape');
    expect(wallTypeLabel('STRAIGHT')).toBe('Straight');
  });

  it('places the L_SHAPE corner point at the canvas origin (spec section 3)', () => {
    expect(L_SHAPE_CORNER_ORIGIN).toEqual({ x: 0, y: 0 });
  });
});
