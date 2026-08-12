import { useCallback, useMemo } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode } from '@/types/database';

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

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface PermissionEnforcement {
  getFieldPermission: (parameterKey: string) => SnapshotPermission | null;
  isFieldLocked: (parameterKey: string) => boolean;
  validateField: (parameterKey: string, value: unknown) => ValidationResult;
  canEditZone: (zoneId: string) => boolean;
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

  return {
    getFieldPermission,
    isFieldLocked,
    validateField,
    canEditZone,
  };
}
