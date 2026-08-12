import { useState } from 'react';
import { fromTable } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { TriggerType, ConditionOperator, QuantityRule } from '@/engines/types';

const TRIGGER_TYPES: TriggerType[] = ['ALWAYS', 'CONDITION', 'DEPENDENCY'];
const OPERATORS: ConditionOperator[] = ['EQ', 'NEQ', 'GT', 'LT', 'GTE', 'LTE'];
const QUANTITY_RULES: QuantityRule[] = ['FIXED', 'PER_ZONE', 'PER_PANEL', 'DERIVED_FROM_PARENT'];

interface AddHiddenComponentDialogProps {
  templateId: string;
  onClose: () => void;
  onAdded: () => void;
}

/**
 * Dialog to define a hidden component with trigger type, condition fields,
 * quantity rule, and fixed value.
 */
export function AddHiddenComponentDialog({
  templateId,
  onClose,
  onAdded,
}: AddHiddenComponentDialogProps) {
  const user = useAuthStore((s) => s.user);
  const [skuId, setSkuId] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('ALWAYS');
  const [conditionField, setConditionField] = useState('');
  const [conditionOperator, setConditionOperator] = useState<ConditionOperator>('EQ');
  const [conditionValue, setConditionValue] = useState('');
  const [quantityRule, setQuantityRule] = useState<QuantityRule>('FIXED');
  const [fixedValue, setFixedValue] = useState('');
  const [writeError, setWriteError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
    if (!skuId.trim()) return;

    setWriteError(null);
    setIsSaving(true);

    let condition: Record<string, unknown> | null = null;
    if (triggerType === 'CONDITION') {
      condition = {
        field: conditionField,
        operator: conditionOperator,
        value: conditionValue,
      };
    }

    const fixedNum = fixedValue ? Number(fixedValue) : null;

    const { error } = await fromTable('template_hidden_component').insert({
      template_id: templateId,
      sku_id: skuId.trim(),
      trigger_type: triggerType,
      condition,
      quantity_rule: quantityRule,
      fixed_value: fixedNum,
      created_by: user?.id ?? null,
    });

    setIsSaving(false);

    if (error) {
      setWriteError(typeof error === 'object' && 'message' in error ? (error as { message: string }).message : 'Failed to save hidden component');
      return;
    }

    onAdded();
  };

  const showConditionFields = triggerType === 'CONDITION';
  const showFixedValue = quantityRule === 'FIXED' || quantityRule === 'PER_ZONE' || quantityRule === 'PER_PANEL';
  const isValid = skuId.trim().length > 0;

  return (
    <div
      data-testid="add-hidden-component-dialog"
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
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Add Hidden Component</h3>

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
            Trigger Type
          </label>
          <select
            data-testid="trigger-type-select"
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value as TriggerType)}
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
          >
            {TRIGGER_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {showConditionFields && (
          <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
                Field
              </label>
              <input
                data-testid="condition-field-input"
                type="text"
                value={conditionField}
                onChange={(e) => setConditionField(e.target.value)}
                placeholder="e.g. zone_count"
                style={{ width: '100%', padding: '6px 8px', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
                Operator
              </label>
              <select
                data-testid="condition-operator-select"
                value={conditionOperator}
                onChange={(e) => setConditionOperator(e.target.value as ConditionOperator)}
                style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
              >
                {OPERATORS.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
                Value
              </label>
              <input
                data-testid="condition-value-input"
                type="text"
                value={conditionValue}
                onChange={(e) => setConditionValue(e.target.value)}
                placeholder="Comparison value"
                style={{ width: '100%', padding: '6px 8px', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        )}

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
            Quantity Rule
          </label>
          <select
            data-testid="quantity-rule-select"
            value={quantityRule}
            onChange={(e) => setQuantityRule(e.target.value as QuantityRule)}
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
          >
            {QUANTITY_RULES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {showFixedValue && (
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
              Fixed Value
            </label>
            <input
              data-testid="fixed-value-input"
              type="number"
              value={fixedValue}
              onChange={(e) => setFixedValue(e.target.value)}
              placeholder="Quantity value"
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
