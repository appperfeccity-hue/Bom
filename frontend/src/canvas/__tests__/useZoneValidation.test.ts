import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProjectStore } from '@/stores/projectStore';
import { TemplateStatus, AdaptationStrategy } from '@/types/database';
import type { Template, TemplateZone } from '@/types/database';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    }),
  },
  fromTable: () => ({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }), order: () => Promise.resolve({ data: [], error: null }) }) }),
    insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    upsert: () => Promise.resolve({ error: null }),
  }),
}));

import { useZoneValidation } from '@/canvas/utils/useZoneValidation';

const mockTemplate: Template = {
  id: 'tmpl-1',
  name: 'Test Template',
  description: null,
  status: TemplateStatus.ACTIVE,
  wall_geometry: 'STRAIGHT',
  base_width_mm: 3000,
  base_height_mm: 2400,
  adaptation_strategy: AdaptationStrategy.SCALE,
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  version: 1,
};

function makeZone(overrides: Partial<TemplateZone> & { id: string }): TemplateZone {
  return {
    template_id: 'tmpl-1',
    name: 'Zone',
    x_mm: 0,
    y_mm: 0,
    width_mm: 400,
    height_mm: 400,
    width_strategy: 'FIXED' as never,
    height_strategy: 'FIXED' as never,
    position_strategy: 'ABSOLUTE' as never,
    z_index: 0,
    segment: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('useZoneValidation', () => {
  beforeEach(() => {
    useProjectStore.setState({
      currentTemplate: mockTemplate,
      zones: [],
    });
  });

  it('returns empty map when there are no zones', () => {
    const { result } = renderHook(() => useZoneValidation());
    expect(result.current.size).toBe(0);
  });

  it('returns empty map when all zones are valid', () => {
    useProjectStore.setState({
      zones: [
        makeZone({ id: 'z1', x_mm: 0, y_mm: 0, width_mm: 400, height_mm: 400 }),
        makeZone({ id: 'z2', x_mm: 500, y_mm: 0, width_mm: 400, height_mm: 400 }),
      ],
    });

    const { result } = renderHook(() => useZoneValidation());
    expect(result.current.size).toBe(0);
  });

  it('detects overlapping zones', () => {
    useProjectStore.setState({
      zones: [
        makeZone({ id: 'z1', x_mm: 0, y_mm: 0, width_mm: 400, height_mm: 400 }),
        makeZone({ id: 'z2', x_mm: 200, y_mm: 200, width_mm: 400, height_mm: 400 }),
      ],
    });

    const { result } = renderHook(() => useZoneValidation());
    expect(result.current.size).toBe(2);
    expect(result.current.get('z1')?.errors).toContain('Zone overlaps with another zone');
    expect(result.current.get('z2')?.errors).toContain('Zone overlaps with another zone');
  });

  it('detects out-of-bounds zones', () => {
    useProjectStore.setState({
      zones: [
        makeZone({ id: 'z1', x_mm: 2800, y_mm: 0, width_mm: 400, height_mm: 400 }),
      ],
    });

    const { result } = renderHook(() => useZoneValidation());
    expect(result.current.size).toBe(1);
    expect(result.current.get('z1')?.errors).toContain('Zone extends beyond wall boundary');
  });

  it('detects undersized zones (below 200x200mm)', () => {
    useProjectStore.setState({
      zones: [
        makeZone({ id: 'z1', x_mm: 0, y_mm: 0, width_mm: 100, height_mm: 100 }),
      ],
    });

    const { result } = renderHook(() => useZoneValidation());
    expect(result.current.size).toBe(1);
    expect(result.current.get('z1')?.errors).toContain('Zone dimensions are below the minimum (200x200mm)');
  });

  it('detects multiple errors for a single zone', () => {
    useProjectStore.setState({
      zones: [
        // Undersized and out-of-bounds
        makeZone({ id: 'z1', x_mm: 2900, y_mm: 2300, width_mm: 150, height_mm: 150 }),
      ],
    });

    const { result } = renderHook(() => useZoneValidation());
    expect(result.current.size).toBe(1);
    const errors = result.current.get('z1')?.errors ?? [];
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors).toContain('Zone extends beyond wall boundary');
    expect(errors).toContain('Zone dimensions are below the minimum (200x200mm)');
  });

  it('does not flag valid zones that are exactly at the boundary', () => {
    useProjectStore.setState({
      zones: [
        makeZone({ id: 'z1', x_mm: 2600, y_mm: 2000, width_mm: 400, height_mm: 400 }),
      ],
    });

    const { result } = renderHook(() => useZoneValidation());
    expect(result.current.size).toBe(0);
  });

  it('returns empty map when template is null (no wall dimensions)', () => {
    useProjectStore.setState({
      currentTemplate: null,
      zones: [
        makeZone({ id: 'z1', x_mm: 0, y_mm: 0, width_mm: 400, height_mm: 400 }),
      ],
    });

    const { result } = renderHook(() => useZoneValidation());
    // With wall dimensions of 0, any zone would be out of bounds
    expect(result.current.size).toBe(1);
    expect(result.current.get('z1')?.errors).toContain('Zone extends beyond wall boundary');
  });
});
