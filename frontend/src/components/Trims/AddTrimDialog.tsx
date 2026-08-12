import { useState } from 'react';
import { fromTable } from '@/lib/supabase';
import type { TrimType, TrimQuantityRule } from './TrimsPanel';

const TRIM_TYPES: TrimType[] = ['GEOMETRY', 'PHYSICAL'];
const QUANTITY_RULES: TrimQuantityRule[] = [
  'TRIM_BY_ZONE_PERIMETER',
  'TRIM_BY_PANEL_EDGE',
  'TRIM_BY_LENGTH',
  'TRIM_FIXED',
];

interface AddTrimDialogProps {
  templateId: string;
  onClose: () => void;
  onAdded: () => void;
}

/**
 * Dialog to add a new trim entry to a template.
 * Validates that PHYSICAL type requires an SKU ID.
 * Shows fixed_quantity input only when quantity_rule is TRIM_FIXED.
 */
export function AddTrimDialog({ templateId, onClose, onAdded }: AddTrimDialogProps) {
  const [skuId, setSkuId] = useState('');
  const [trimType, setTrimType] = useState<TrimType>('GEOMETRY');
  const [quantityRule, setQuantityRule] = useState<TrimQuantityRule>('TRIM_BY_ZONE_PERIMETER');
  const [fixedQuantity, setFixedQuantity] = useState('');
  const [writeError, setWriteError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isValid = trimType === 'GEOMETRY' || skuId.trim().length > 0;

  const handleConfirm = async () => {
    if (!isValid) return;

    setWriteError(null);
    setIsSaving(true);

    const fixedNum = quantityRule === 'TRIM_FIXED' && fixedQuantity ? Math.max(0, Number(fixedQuantity)) : null;

    const { error } = await fromTable('template_trim').insert({
      template_id: templateId,
      sku_id: skuId.trim() || null,
      trim_type: trimType,
      quantity_rule: quantityRule,
      fixed_quantity: fixedNum,
    });

    setIsSaving(false);

    if (error) {
      setWriteError(
        typeof error === 'object' && 'message' in error
          ? (error as { message: string }).message
          : 'Failed to save trim'
      );
      return;
    }

    onAdded();
  };

  return (
    <div
      data-testid="add-trim-dialog"
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
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Add Trim</h3>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
            Trim Type
          </label>
          <select
            data-testid="trim-type-select"
            value={trimType}
            onChange={(e) => setTrimType(e.target.value as TrimType)}
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
          >
            {TRIM_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
            SKU ID {trimType === 'PHYSICAL' && <span style={{ color: '#c62828' }}>*</span>}
          </label>
          <input
            data-testid="sku-id-input"
            type="text"
            value={skuId}
            onChange={(e) => setSkuId(e.target.value)}
            placeholder={trimType === 'GEOMETRY' ? 'Optional for geometry trims' : 'Required for physical trims'}
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
            Quantity Rule
          </label>
          <select
            data-testid="quantity-rule-select"
            value={quantityRule}
            onChange={(e) => setQuantityRule(e.target.value as TrimQuantityRule)}
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
          >
            {QUANTITY_RULES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {quantityRule === 'TRIM_FIXED' && (
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
              Fixed Quantity
            </label>
            <input
              data-testid="fixed-quantity-input"
              type="number"
              value={fixedQuantity}
              onChange={(e) => setFixedQuantity(e.target.value)}
              placeholder="Enter fixed quantity"
              min={0}
              style={{ width: '100%', padding: '6px 8px', fontSize: '13px', boxSizing: 'border-box' }}
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
