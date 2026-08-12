import { useState, useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasMode } from '@/types/database';
import { fromTable } from '@/lib/supabase';
import { AddMountingRuleDialog } from './AddMountingRuleDialog';
import type { MountingType } from '@/engines/types';

export interface MountingRule {
  lighting_id: string;
  template_id: string;
  sku_id: string;
  edge_selection: string;
  mounting_type: MountingType;
  quantity_rule: string | null;
  created_at: string;
}

interface MountingRulesPanelProps {
  templateId: string;
}

/**
 * Returns gap (mm) and structure_required based on mounting type.
 * DIRECT: gap=0mm, no structure
 * PROFILE: gap=0mm, no structure
 * COVE: gap=10mm, structure required
 */
export function getMountingInfo(mountingType: MountingType): { gap_mm: number; structure_required: boolean } {
  switch (mountingType) {
    case 'COVE':
      return { gap_mm: 10, structure_required: true };
    case 'DIRECT':
    case 'PROFILE':
    default:
      return { gap_mm: 0, structure_required: false };
  }
}

/**
 * Panel listing mounting/construction rules (template_lighting entries).
 * Shows mounting type, gap, and structure info per spec section 55.
 * Only visible in DESIGNER mode.
 */
export function MountingRulesPanel({ templateId }: MountingRulesPanelProps) {
  const mode = useCanvasStore((s) => s.mode);
  const [rules, setRules] = useState<MountingRule[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchRules = useCallback(async () => {
    const { data } = await fromTable('template_lighting')
      .select('*')
      .eq('template_id', templateId);

    if (data) {
      setRules(data as MountingRule[]);
    }
  }, [templateId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  if (mode !== CanvasMode.DESIGNER) {
    return null;
  }

  return (
    <div
      data-testid="mounting-rules-panel"
      style={{
        padding: '16px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: '#fafafa',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Mounting / Construction Rules</h3>
        <button
          data-testid="add-mounting-rule-btn"
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
          Add Mounting Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div data-testid="no-mounting-rules-msg" style={{ fontSize: '13px', color: '#666' }}>
          No mounting rules configured.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rules.map((rule) => {
            const info = getMountingInfo(rule.mounting_type);
            return (
              <div
                key={rule.lighting_id}
                data-testid={`mounting-rule-item-${rule.lighting_id}`}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{rule.sku_id}</strong>
                  <span
                    data-testid={`mounting-type-${rule.lighting_id}`}
                    style={{
                      padding: '2px 8px',
                      fontSize: '11px',
                      borderRadius: '3px',
                      backgroundColor:
                        rule.mounting_type === 'DIRECT'
                          ? '#c8e6c9'
                          : rule.mounting_type === 'PROFILE'
                            ? '#bbdefb'
                            : '#fff9c4',
                      color: '#333',
                    }}
                  >
                    {rule.mounting_type}
                  </span>
                </div>
                <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                  <span>Edge: {rule.edge_selection}</span>
                  <span style={{ marginLeft: '8px' }}>| Gap: {info.gap_mm}mm</span>
                  <span style={{ marginLeft: '8px' }}>
                    | Structure: {info.structure_required ? 'Required' : 'Not required'}
                  </span>
                  {rule.quantity_rule && (
                    <span style={{ marginLeft: '8px' }}>| Rule: {rule.quantity_rule}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dialogOpen && (
        <AddMountingRuleDialog
          templateId={templateId}
          onClose={() => setDialogOpen(false)}
          onAdded={() => {
            setDialogOpen(false);
            fetchRules();
          }}
        />
      )}
    </div>
  );
}
