import { useState, useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasMode } from '@/types/database';
import { fromTable } from '@/lib/supabase';
import { AddPermissionDialog } from './AddPermissionDialog';
import type {
  PermissionEditMode,
  PermissionParameterType,
} from '@/lib/measurementModel';

export interface ConsultantPermission {
  permission_id: string;
  template_id: string;
  parameter_key: string;
  parameter_type: PermissionParameterType;
  edit_mode: PermissionEditMode;
  min_value: number | null;
  max_value: number | null;
  allowed_values: unknown[] | null;
}

interface ConsultantPermissionsPanelProps {
  templateId: string;
}

/**
 * Panel showing per-template consultant permissions.
 * Lists existing permissions with the baseline vocabulary: parameter_key,
 * edit_mode, and the RESTRICTED bounds. Only visible in DESIGNER mode.
 */
export function ConsultantPermissionsPanel({ templateId }: ConsultantPermissionsPanelProps) {
  const mode = useCanvasStore((s) => s.mode);
  const [permissions, setPermissions] = useState<ConsultantPermission[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchPermissions = useCallback(async () => {
    const { data } = await fromTable('template_consultant_permission')
      .select('*')
      .eq('template_id', templateId);

    if (data) {
      setPermissions(data as ConsultantPermission[]);
    }
  }, [templateId]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  if (mode !== CanvasMode.DESIGNER) {
    return null;
  }

  const formatConstraints = (perm: ConsultantPermission): string => {
    if (perm.edit_mode === 'LOCKED') return 'No changes allowed';
    if (perm.edit_mode === 'FREE') return 'Unrestricted within DB safety bounds';
    if (Array.isArray(perm.allowed_values) && perm.allowed_values.length > 0) {
      return `Values: ${perm.allowed_values.join(', ')}`;
    }
    const min = perm.min_value ?? '-';
    const max = perm.max_value ?? '-';
    return `Range: ${min} - ${max}`;
  };

  return (
    <div
      data-testid="consultant-permissions-panel"
      style={{
        padding: '16px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: '#fafafa',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Consultant Permissions</h3>
        <button
          data-testid="add-permission-btn"
          onClick={() => setDialogOpen(true)}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: '#1976d2',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Add Permission
        </button>
      </div>

      {permissions.length === 0 ? (
        <div data-testid="no-permissions-msg" style={{ fontSize: '13px', color: '#666' }}>
          No consultant permissions configured.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {permissions.map((perm) => (
            <div
              key={perm.permission_id}
              data-testid={`permission-item-${perm.permission_id}`}
              style={{
                padding: '8px 12px',
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{perm.parameter_key}</strong>
                <span
                  data-testid={`permission-type-${perm.permission_id}`}
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    borderRadius: '3px',
                    backgroundColor:
                      perm.edit_mode === 'LOCKED'
                        ? '#ffcdd2'
                        : perm.edit_mode === 'RESTRICTED'
                          ? '#c8e6c9'
                          : '#bbdefb',
                    color: '#333',
                  }}
                >
                  {perm.edit_mode}
                </span>
              </div>
              <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                {formatConstraints(perm)}
              </div>
            </div>
          ))}
        </div>
      )}

      {dialogOpen && (
        <AddPermissionDialog
          templateId={templateId}
          onClose={() => setDialogOpen(false)}
          onAdded={() => {
            setDialogOpen(false);
            fetchPermissions();
          }}
        />
      )}
    </div>
  );
}
