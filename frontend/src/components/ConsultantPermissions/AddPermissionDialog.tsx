import { useState } from 'react';
import { fromTable } from '@/lib/supabase';
import {
  PARAMETER_TYPE_BY_KEY,
  PERMISSION_EDIT_MODES,
  PERMISSION_PARAMETER_KEYS,
} from '@/lib/measurementModel';
import type {
  PermissionEditMode,
  PermissionParameterKey,
} from '@/lib/measurementModel';

interface AddPermissionDialogProps {
  templateId: string;
  onClose: () => void;
  onAdded: () => void;
}

/**
 * Dialog to add a consultant permission using the authoritative baseline
 * vocabulary: UPPERCASE parameter_key, derived parameter_type, and
 * edit_mode (LOCKED | RESTRICTED | FREE). Bounds (min/max/allowed values)
 * only apply to RESTRICTED.
 */
export function AddPermissionDialog({
  templateId,
  onClose,
  onAdded,
}: AddPermissionDialogProps) {
  const [parameterKey, setParameterKey] = useState<PermissionParameterKey | ''>('');
  const [editMode, setEditMode] = useState<PermissionEditMode>('LOCKED');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [allowedValues, setAllowedValues] = useState('');
  const [writeError, setWriteError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
    if (!parameterKey) return;

    setWriteError(null);
    setIsSaving(true);

    const parameterType = PARAMETER_TYPE_BY_KEY[parameterKey];
    const isRestricted = editMode === 'RESTRICTED';
    const parsedAllowedValues = allowedValues
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    const { error } = await fromTable('template_consultant_permission').insert({
      template_id: templateId,
      parameter_key: parameterKey,
      parameter_type: parameterType,
      edit_mode: editMode,
      min_value: isRestricted && minValue ? Number(minValue) : null,
      max_value: isRestricted && maxValue ? Number(maxValue) : null,
      allowed_values:
        isRestricted && parsedAllowedValues.length > 0 ? parsedAllowedValues : null,
    });

    setIsSaving(false);

    if (error) {
      setWriteError(typeof error === 'object' && 'message' in error ? (error as { message: string }).message : 'Failed to save permission');
      return;
    }

    onAdded();
  };

  const isValid = parameterKey !== '';

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
            value={parameterKey}
            onChange={(e) => setParameterKey(e.target.value as PermissionParameterKey)}
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
          >
            <option value="">Select parameter...</option>
            {PERMISSION_PARAMETER_KEYS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
            Edit Mode
          </label>
          <select
            data-testid="permission-type-select"
            value={editMode}
            onChange={(e) => setEditMode(e.target.value as PermissionEditMode)}
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
          >
            {PERMISSION_EDIT_MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {parameterKey && (
          <div data-testid="parameter-type-display" style={{ marginBottom: '12px', fontSize: '12px', color: '#666' }}>
            Parameter type: {PARAMETER_TYPE_BY_KEY[parameterKey]}
          </div>
        )}

        {editMode === 'RESTRICTED' && (
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

        {editMode === 'RESTRICTED' && (
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

        {writeError && (
          <div
            data-testid="write-error"
            style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', fontSize: '12px' }}
          >
            {writeError}
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
            disabled={!isValid || isSaving}
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#1976d2',
              color: '#fff',
              cursor: !isValid || isSaving ? 'not-allowed' : 'pointer',
              opacity: !isValid || isSaving ? 0.5 : 1,
            }}
          >
            {isSaving ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
