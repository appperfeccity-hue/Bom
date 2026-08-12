import { useState } from 'react';
import { fromTable } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const PARAMETER_NAMES = [
  'zone_width',
  'zone_height',
  'sku_selection',
  'quantity',
  'gap_horizontal',
  'gap_vertical',
] as const;

type ParameterName = typeof PARAMETER_NAMES[number];
type PermissionType = 'LOCKED' | 'RANGE' | 'SELECTION';

interface AddPermissionDialogProps {
  templateId: string;
  onClose: () => void;
  onAdded: () => void;
}

/**
 * Dialog to add a consultant permission with controlled vocabulary.
 * parameter_name dropdown, permission_type selector, and constraint fields
 * that change based on the selected type.
 */
export function AddPermissionDialog({
  templateId,
  onClose,
  onAdded,
}: AddPermissionDialogProps) {
  const user = useAuthStore((s) => s.user);
  const [parameterName, setParameterName] = useState<ParameterName | ''>('');
  const [permissionType, setPermissionType] = useState<PermissionType>('LOCKED');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [allowedValues, setAllowedValues] = useState('');

  const handleConfirm = async () => {
    if (!parameterName) return;

    let constraints: Record<string, unknown> = {};
    if (permissionType === 'RANGE') {
      constraints = {
        min_value: minValue ? Number(minValue) : null,
        max_value: maxValue ? Number(maxValue) : null,
      };
    } else if (permissionType === 'SELECTION') {
      constraints = {
        allowed_values: allowedValues
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v.length > 0),
      };
    }

    await fromTable('template_consultant_permission').insert({
      template_id: templateId,
      parameter_name: parameterName,
      permission_type: permissionType,
      constraints,
      created_by: user?.id ?? null,
    });

    onAdded();
  };

  const isValid = parameterName !== '';

  return (
    <div
      data-testid="add-permission-dialog"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '24px',
          width: '420px',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Add Consultant Permission</h3>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
            Parameter
          </label>
          <select
            data-testid="parameter-name-select"
            value={parameterName}
            onChange={(e) => setParameterName(e.target.value as ParameterName)}
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
          >
            <option value="">Select parameter...</option>
            {PARAMETER_NAMES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
            Permission Type
          </label>
          <select
            data-testid="permission-type-select"
            value={permissionType}
            onChange={(e) => setPermissionType(e.target.value as PermissionType)}
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
          >
            <option value="LOCKED">LOCKED</option>
            <option value="RANGE">RANGE</option>
            <option value="SELECTION">SELECTION</option>
          </select>
        </div>

        {permissionType === 'RANGE' && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
                  Min Value
                </label>
                <input
                  data-testid="min-value-input"
                  type="number"
                  value={minValue}
                  onChange={(e) => setMinValue(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
                  Max Value
                </label>
                <input
                  data-testid="max-value-input"
                  type="number"
                  value={maxValue}
                  onChange={(e) => setMaxValue(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>
        )}

        {permissionType === 'SELECTION' && (
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
              Allowed Values (comma-separated)
            </label>
            <textarea
              data-testid="allowed-values-input"
              value={allowedValues}
              onChange={(e) => setAllowedValues(e.target.value)}
              placeholder="value1, value2, value3"
              rows={3}
              style={{ width: '100%', padding: '6px 8px', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            data-testid="cancel-btn"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            data-testid="confirm-btn"
            onClick={handleConfirm}
            disabled={!isValid}
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#1976d2',
              color: '#fff',
              cursor: !isValid ? 'not-allowed' : 'pointer',
              opacity: !isValid ? 0.5 : 1,
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
