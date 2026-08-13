import { useCallback, useMemo } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode } from '@/types/database';
import type { WallParamPermissionMode } from '@/types/database';

export type EditMode = 'LOCKED' | 'RESTRICTED' | 'FREE';

export interface SnapshotPermission {
  permission_id: string;
  template_id: string;
  parameter_key: string;
  parameter_type: string;
  edit_mode: EditMode;
  min_value: number | null;
  max_value: number | null;
  allowed_values: string[] | null;
}

/**
 * Wall configuration permission entry from the snapshot.
 * Rule 72: Consultant can only change parameters explicitly marked ALLOWED by Designer.
 */
export interface WallConfigPermission {
  parameter_key: string;
  permission_mode: WallParamPermissionMode;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface PermissionEnforcement {
  getFieldPermission: (parameterKey: string) => SnapshotPermission | null;
  isFieldLocked: (parameterKey: string) => boolean;
  validateField: (parameterKey: string, value: unknown) => ValidationResult;
  canEditZone: (zoneId: string) => boolean;
  /** Check if a wall config parameter is allowed for consultant editing (Rule 72) */
  isWallParamAllowed: (param: string) => boolean;
}

/**
 * Hook that reads permissions from the loaded project snapshot and exposes
 * enforcement helpers. Only active in CONSULTANT mode with a loaded snapshot.
 */
export function usePermissionEnforcement(): PermissionEnforcement {
  const mode = useCanvasStore((s) => s.mode);
  const currentSnapshot = useProjectStore((s) => s.currentSnapshot);

  const permissions: SnapshotPermission[] = useMemo(() => {
    if (mode !== CanvasMode.CONSULTANT || !currentSnapshot) {
      return [];
    }
    const snapshotData = currentSnapshot.snapshot_data;
    if (!snapshotData || !Array.isArray(snapshotData.permissions)) {
      return [];
    }
    return snapshotData.permissions as SnapshotPermission[];
  }, [mode, currentSnapshot]);

  /**
   * Wall configuration permissions from the snapshot.
   * Rule 72: Consultant can only change parameters explicitly marked ALLOWED.
   */
  const wallConfigPermissions: WallConfigPermission[] = useMemo(() => {
    if (mode !== CanvasMode.CONSULTANT || !currentSnapshot) {
      return [];
    }
    const snapshotData = currentSnapshot.snapshot_data;
    if (!snapshotData || !Array.isArray(snapshotData.consultant_permissions)) {
      return [];
    }
    return snapshotData.consultant_permissions as WallConfigPermission[];
  }, [mode, currentSnapshot]);

  const getFieldPermission = useCallback(
    (parameterKey: string): SnapshotPermission | null => {
      return permissions.find((p) => p.parameter_key === parameterKey) ?? null;
    },
    [permissions],
  );

  const isFieldLocked = useCallback(
    (parameterKey: string): boolean => {
      const permission = getFieldPermission(parameterKey);
      if (!permission) return false;
      return permission.edit_mode === 'LOCKED';
    },
    [getFieldPermission],
  );

  /**
   * Validates a field value against snapshot permissions.
   *
   * IMPORTANT: This must be called as the FIRST validation step before any
   * generic measurement constraints (e.g., min/max clamping in UI components).
   * Permission-specific ranges take priority over generic ranges. If a consumer
   * applies generic validation after this function, it may incorrectly override
   * the permission-defined boundaries.
   */
  const validateField = useCallback(
    (parameterKey: string, value: unknown): ValidationResult => {
      const permission = getFieldPermission(parameterKey);

      // No permission or FREE - always valid
      if (!permission || permission.edit_mode === 'FREE') {
        return { valid: true };
      }

      // LOCKED - cannot edit at all
      if (permission.edit_mode === 'LOCKED') {
        return { valid: false, error: 'This field is locked and cannot be edited' };
      }

      // RESTRICTED - check constraints
      if (permission.edit_mode === 'RESTRICTED') {
        // Check allowed_values if present (selection-type fields)
        if (permission.allowed_values && Array.isArray(permission.allowed_values)) {
          const strValue = String(value);
          if (!permission.allowed_values.includes(strValue)) {
            return {
              valid: false,
              error: `Value must be one of: ${permission.allowed_values.join(', ')}`,
            };
          }
          return { valid: true };
        }

        // Check numeric min/max constraints
        const numValue = typeof value === 'number' ? value : Number(value);
        if (isNaN(numValue)) {
          return { valid: false, error: 'Value must be a number' };
        }

        if (permission.min_value !== null && numValue < permission.min_value) {
          return {
            valid: false,
            error: `Value must be at least ${permission.min_value}`,
          };
        }

        if (permission.max_value !== null && numValue > permission.max_value) {
          return {
            valid: false,
            error: `Value must be at most ${permission.max_value}`,
          };
        }

        return { valid: true };
      }

      return { valid: true };
    },
    [getFieldPermission],
  );

  const canEditZone = useCallback(
    (zoneId: string): boolean => {
      // In DESIGNER mode or no snapshot, always allow
      if (mode !== CanvasMode.CONSULTANT || !currentSnapshot) {
        return true;
      }

      // If zoneId is not a valid UUID, skip permission lookup and allow edit
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(zoneId)) {
        return true;
      }

      // Check if there's a zone-level LOCKED permission
      // Zone-level permissions use parameter_key matching the zone ID pattern
      const zonePermission = permissions.find(
        (p) => p.parameter_key === `zone_${zoneId}` && p.edit_mode === 'LOCKED',
      );

      if (zonePermission) {
        return false;
      }

      return true;
    },
    [mode, currentSnapshot, permissions],
  );

  /**
   * Check if a wall configuration parameter is allowed for consultant editing.
   * Rule 72: Consultant can only change parameters explicitly marked ALLOWED by Designer.
   * Rule 73: Consultant cannot manually edit panel frames.
   *
   * Parameters: wall_width, wall_height, panel_gap, fit_algorithm, fit_intensity,
   * mounting_type, rows, columns.
   *
   * In DESIGNER mode, all parameters are always allowed.
   * In CONSULTANT mode, only parameters with permission_mode === 'ALLOWED' can be changed.
   */
  const isWallParamAllowed = useCallback(
    (param: string): boolean => {
      // In DESIGNER mode, always allowed
      if (mode !== CanvasMode.CONSULTANT) {
        return true;
      }

      // No snapshot means no permissions loaded - default to locked (Rule 72)
      if (!currentSnapshot) {
        return false;
      }

      // Find the permission for this wall config parameter
      const wallPermission = wallConfigPermissions.find(
        (p) => p.parameter_key === param,
      );

      // If no explicit permission exists, default to LOCKED (Rule 72)
      if (!wallPermission) {
        return false;
      }

      return wallPermission.permission_mode === 'ALLOWED';
    },
    [mode, currentSnapshot, wallConfigPermissions],
  );

  return {
    getFieldPermission,
    isFieldLocked,
    validateField,
    canEditZone,
    isWallParamAllowed,
  };
}
