import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissionEnforcement } from '@/canvas/permissions/usePermissionEnforcement';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode } from '@/types/database';
import type { ProjectSnapshot } from '@/types/database';

vi.mock('@/lib/supabase', () => ({
  fromTable: () => ({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }), order: () => Promise.resolve({ data: [], error: null }) }), order: () => Promise.resolve({ data: [], error: null }) }),
    insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) }),
    upsert: () => Promise.resolve({ data: null, error: null }),
  }),
}));

const mockSnapshot: ProjectSnapshot = {
  id: 'snap-1',
  project_id: 'proj-1',
  template_id: 'tmpl-1',
  snapshot_data: {
    permissions: [
      {
        permission_id: 'perm-1',
        template_id: 'tmpl-1',
        parameter_key: 'wall_width_mm',
        parameter_type: 'measurement',
        edit_mode: 'LOCKED',
        min_value: null,
        max_value: null,
        allowed_values: null,
      },
      {
        permission_id: 'perm-2',
        template_id: 'tmpl-1',
        parameter_key: 'wall_height_mm',
        parameter_type: 'measurement',
        edit_mode: 'RESTRICTED',
        min_value: 600,
        max_value: 3000,
        allowed_values: null,
      },
      {
        permission_id: 'perm-3',
        template_id: 'tmpl-1',
        parameter_key: 'segment_a_width_mm',
        parameter_type: 'measurement',
        edit_mode: 'FREE',
        min_value: null,
        max_value: null,
        allowed_values: null,
      },
      {
        permission_id: 'perm-4',
        template_id: 'tmpl-1',
        parameter_key: 'finish_type',
        parameter_type: 'selection',
        edit_mode: 'RESTRICTED',
        min_value: null,
        max_value: null,
        allowed_values: ['matte', 'gloss', 'satin'],
      },
      {
        permission_id: 'perm-5',
        template_id: 'tmpl-1',
        parameter_key: 'zone_zone-locked',
        parameter_type: 'zone',
        edit_mode: 'LOCKED',
        min_value: null,
        max_value: null,
        allowed_values: null,
      },
    ],
  },
  created_by: 'user-1',
  created_at: '2024-01-01',
  version: 1,
};

describe('usePermissionEnforcement', () => {
  beforeEach(() => {
    useCanvasStore.setState({ mode: CanvasMode.DESIGNER });
    useProjectStore.setState({ currentSnapshot: null });
  });

  it('returns no restrictions when no snapshot loaded', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    useProjectStore.setState({ currentSnapshot: null });

    const { result } = renderHook(() => usePermissionEnforcement());

    expect(result.current.isFieldLocked('wall_width_mm')).toBe(false);
    expect(result.current.validateField('wall_width_mm', 1000)).toEqual({ valid: true });
    expect(result.current.canEditZone('zone-1')).toBe(true);
  });

  it('returns no restrictions when in DESIGNER mode', () => {
    useCanvasStore.setState({ mode: CanvasMode.DESIGNER });
    useProjectStore.setState({ currentSnapshot: mockSnapshot });

    const { result } = renderHook(() => usePermissionEnforcement());

    expect(result.current.isFieldLocked('wall_width_mm')).toBe(false);
    expect(result.current.validateField('wall_width_mm', 1000)).toEqual({ valid: true });
    expect(result.current.canEditZone('zone-locked')).toBe(true);
  });

  it('isFieldLocked returns true for LOCKED fields', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    useProjectStore.setState({ currentSnapshot: mockSnapshot });

    const { result } = renderHook(() => usePermissionEnforcement());

    expect(result.current.isFieldLocked('wall_width_mm')).toBe(true);
    expect(result.current.isFieldLocked('wall_height_mm')).toBe(false);
    expect(result.current.isFieldLocked('segment_a_width_mm')).toBe(false);
  });

  it('validateField returns error for out-of-range RESTRICTED value', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    useProjectStore.setState({ currentSnapshot: mockSnapshot });

    const { result } = renderHook(() => usePermissionEnforcement());

    // Below min
    const belowMin = result.current.validateField('wall_height_mm', 500);
    expect(belowMin.valid).toBe(false);
    expect(belowMin.error).toContain('at least 600');

    // Above max
    const aboveMax = result.current.validateField('wall_height_mm', 5000);
    expect(aboveMax.valid).toBe(false);
    expect(aboveMax.error).toContain('at most 3000');
  });

  it('validateField passes for valid RESTRICTED value', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    useProjectStore.setState({ currentSnapshot: mockSnapshot });

    const { result } = renderHook(() => usePermissionEnforcement());

    const valid = result.current.validateField('wall_height_mm', 1500);
    expect(valid.valid).toBe(true);
    expect(valid.error).toBeUndefined();
  });

  it('validateField checks allowed_values for RESTRICTED selection fields', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    useProjectStore.setState({ currentSnapshot: mockSnapshot });

    const { result } = renderHook(() => usePermissionEnforcement());

    // Valid value
    const valid = result.current.validateField('finish_type', 'matte');
    expect(valid.valid).toBe(true);

    // Invalid value
    const invalid = result.current.validateField('finish_type', 'brushed');
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toContain('must be one of');
  });

  it('FREE fields always validate', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    useProjectStore.setState({ currentSnapshot: mockSnapshot });

    const { result } = renderHook(() => usePermissionEnforcement());

    expect(result.current.validateField('segment_a_width_mm', 99999)).toEqual({ valid: true });
    expect(result.current.validateField('segment_a_width_mm', -100)).toEqual({ valid: true });
  });

  it('validateField returns error for LOCKED fields', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    useProjectStore.setState({ currentSnapshot: mockSnapshot });

    const { result } = renderHook(() => usePermissionEnforcement());

    const locked = result.current.validateField('wall_width_mm', 1000);
    expect(locked.valid).toBe(false);
    expect(locked.error).toContain('locked');
  });

  it('canEditZone returns false for zones with LOCKED permission', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    useProjectStore.setState({ currentSnapshot: mockSnapshot });

    const { result } = renderHook(() => usePermissionEnforcement());

    expect(result.current.canEditZone('zone-locked')).toBe(false);
    expect(result.current.canEditZone('zone-other')).toBe(true);
  });

  it('getFieldPermission returns the permission config for a given key', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    useProjectStore.setState({ currentSnapshot: mockSnapshot });

    const { result } = renderHook(() => usePermissionEnforcement());

    const perm = result.current.getFieldPermission('wall_height_mm');
    expect(perm).not.toBeNull();
    expect(perm!.edit_mode).toBe('RESTRICTED');
    expect(perm!.min_value).toBe(600);
    expect(perm!.max_value).toBe(3000);
  });

  it('getFieldPermission returns null for unknown fields', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    useProjectStore.setState({ currentSnapshot: mockSnapshot });

    const { result } = renderHook(() => usePermissionEnforcement());

    expect(result.current.getFieldPermission('unknown_field')).toBeNull();
  });
});
