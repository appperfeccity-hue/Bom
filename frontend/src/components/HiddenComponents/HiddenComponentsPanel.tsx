import { useState, useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasMode } from '@/types/database';
import { fromTable } from '@/lib/supabase';
import { AddHiddenComponentDialog } from './AddHiddenComponentDialog';
import type { TriggerType, QuantityRule, ConditionOperator } from '@/engines/types';

export interface HiddenComponent {
  id: string;
  template_id: string;
  sku_id: string;
  trigger_type: TriggerType;
  condition: {
    field?: string;
    operator?: ConditionOperator;
    value?: string | number;
  } | null;
  quantity_rule: QuantityRule;
  fixed_value: number | null;
  created_by: string;
}

interface HiddenComponentsPanelProps {
  templateId: string;
}

/**
 * Panel listing hidden components for the template.
 * Shows component name/SKU, trigger type, quantity rule, and condition details.
 * Only visible in DESIGNER mode.
 */
export function HiddenComponentsPanel({ templateId }: HiddenComponentsPanelProps) {
  const mode = useCanvasStore((s) => s.mode);
  const [components, setComponents] = useState<HiddenComponent[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchComponents = useCallback(async () => {
    const { data } = await fromTable('template_hidden_component')
      .select('*')
      .eq('template_id', templateId);

    if (data) {
      setComponents(data as HiddenComponent[]);
    }
  }, [templateId]);

  useEffect(() => {
    fetchComponents();
  }, [fetchComponents]);

  if (mode !== CanvasMode.DESIGNER) {
    return null;
  }

  const formatCondition = (component: HiddenComponent): string => {
    if (component.trigger_type === 'ALWAYS') return 'Always included';
    if (component.trigger_type === 'DEPENDENCY') return 'Depends on parent';
    if (component.trigger_type === 'CONDITION' && component.condition) {
      const { field, operator, value } = component.condition;
      return `${field ?? '?'} ${operator ?? '?'} ${value ?? '?'}`;
    }
    return '-';
  };

  return (
    <div
      data-testid="hidden-components-panel"
      style={{
        padding: '16px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: '#fafafa',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Hidden Components</h3>
        <button
          data-testid="add-hidden-component-btn"
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
          Add Hidden Component
        </button>
      </div>

      {components.length === 0 ? (
        <div data-testid="no-hidden-components-msg" style={{ fontSize: '13px', color: '#666' }}>
          No hidden components configured.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {components.map((comp) => (
            <div
              key={comp.id}
              data-testid={`hidden-component-item-${comp.id}`}
              style={{
                padding: '8px 12px',
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{comp.sku_id}</strong>
                <span
                  data-testid={`trigger-type-${comp.id}`}
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    borderRadius: '3px',
                    backgroundColor:
                      comp.trigger_type === 'ALWAYS'
                        ? '#c8e6c9'
                        : comp.trigger_type === 'CONDITION'
                          ? '#fff9c4'
                          : '#e1bee7',
                    color: '#333',
                  }}
                >
                  {comp.trigger_type}
                </span>
              </div>
              <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                <span>Rule: {comp.quantity_rule}</span>
                {comp.fixed_value != null && <span> (value: {comp.fixed_value})</span>}
                <span style={{ marginLeft: '8px' }}>| {formatCondition(comp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialogOpen && (
        <AddHiddenComponentDialog
          templateId={templateId}
          onClose={() => setDialogOpen(false)}
          onAdded={() => {
            setDialogOpen(false);
            fetchComponents();
          }}
        />
      )}
    </div>
  );
}
