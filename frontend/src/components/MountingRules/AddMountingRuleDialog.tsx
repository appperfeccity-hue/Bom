import { useState } from 'react';
import { fromTable } from '@/lib/supabase';
import type { MountingType } from '@/engines/types';
import { getMountingInfo } from './MountingRulesPanel';

const MOUNTING_TYPES: MountingType[] = ['DIRECT', 'PROFILE', 'COVE'];

interface AddMountingRuleDialogProps {
  templateId: string;
  onClose: () => void;
  onAdded: () => void;
}

/**
 * Dialog to add a new mounting rule (template_lighting entry).
 * Fields: SKU ID, Edge Selection, Mounting Type.
 * Shows computed gap and structure info based on selected mounting type.
 */
export function AddMountingRuleDialog({
  templateId,
  onClose,
  onAdded,
}: AddMountingRuleDialogProps) {
  const [skuId, setSkuId] = useState('');
  const [edgeSelection, setEdgeSelection] = useState('');
  const [mountingType, setMountingType] = useState<MountingType>('DIRECT');
  const [writeError, setWriteError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const info = getMountingInfo(mountingType);

  const handleConfirm = async () => {
    if (!skuId.trim() || !edgeSelection.trim()) return;

    setWriteError(null);
    setIsSaving(true);

    const { error } = await fromTable('template_lighting').insert({
      template_id: templateId,
      sku_id: skuId.trim(),
      edge_selection: edgeSelection.trim(),
      mounting_type: mountingType,
    });

    setIsSaving(false);

    if (error) {
      setWriteError(
        typeof error === 'object' && 'message' in error
          ? (error as { message: string }).message
          : 'Failed to save mounting rule'
      );
      return;
    }

    onAdded();
  };

  const isValid = skuId.trim().length > 0 && edgeSelection.trim().length > 0;

  return (
    <div
      data-testid="add-mounting-rule-dialog"
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
          width: '460px',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Add Mounting Rule</h3>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
            SKU ID
          </label>
          <input
            data-testid="sku-id-input"
            type="text"
            value={skuId}
            onChange={(e) => setSkuId(e.target.value)}
            placeholder="Enter SKU ID..."
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
            Edge Selection
          </label>
          <input
            data-testid="edge-selection-input"
            type="text"
            value={edgeSelection}
            onChange={(e) => setEdgeSelection(e.target.value)}
            placeholder="e.g. TOP, BOTTOM, LEFT..."
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
            Mounting Type
          </label>
          <select
            data-testid="mounting-type-select"
            value={mountingType}
            onChange={(e) => setMountingType(e.target.value as MountingType)}
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
          >
            {MOUNTING_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div
          style={{
            marginBottom: '12px',
            padding: '12px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        >
          <div data-testid="gap-info" style={{ marginBottom: '4px' }}>
            <strong>Gap:</strong> {info.gap_mm}mm
          </div>
          <div data-testid="structure-info">
            <strong>Structure:</strong> {info.structure_required ? 'Required' : 'Not required'}
          </div>
        </div>

        {writeError && (
          <div
            data-testid="write-error"
            style={{
              marginBottom: '12px',
              padding: '8px',
              backgroundColor: '#ffebee',
              color: '#c62828',
              borderRadius: '4px',
              fontSize: '12px',
            }}
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
