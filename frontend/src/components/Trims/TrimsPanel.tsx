import { useState, useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasMode } from '@/types/database';
import { fromTable } from '@/lib/supabase';
import { AddTrimDialog } from './AddTrimDialog';

export type TrimType = 'GEOMETRY' | 'PHYSICAL';
export type TrimQuantityRule = 'TRIM_BY_ZONE_PERIMETER' | 'TRIM_BY_PANEL_EDGE' | 'TRIM_BY_LENGTH' | 'TRIM_FIXED';

export interface TemplateTrim {
  trim_id: string;
  template_id: string;
  sku_id: string | null;
  trim_type: TrimType;
  quantity_rule: TrimQuantityRule;
  fixed_quantity: number | null;
  created_at: string;
}

interface TrimsPanelProps {
  templateId: string;
}

/**
 * Panel listing template trim entries.
 * Shows SKU, trim type badge, quantity rule, and fixed quantity (for TRIM_FIXED only).
 * Only visible in DESIGNER mode.
 */
export function TrimsPanel({ templateId }: TrimsPanelProps) {
  const mode = useCanvasStore((s) => s.mode);
  const [trims, setTrims] = useState<TemplateTrim[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchTrims = useCallback(async () => {
    const { data } = await fromTable('template_trim')
      .select('*')
      .eq('template_id', templateId);

    if (data) {
      setTrims(data as TemplateTrim[]);
    }
  }, [templateId]);

  useEffect(() => {
    fetchTrims();
  }, [fetchTrims]);

  if (mode !== CanvasMode.DESIGNER) {
    return null;
  }

  return (
    <div
      data-testid="trims-panel"
      style={{
        padding: '16px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: '#fafafa',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Trims</h3>
        <button
          data-testid="add-trim-btn"
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
          Add Trim
        </button>
      </div>

      {trims.length === 0 ? (
        <div data-testid="no-trims-msg" style={{ fontSize: '13px', color: '#666' }}>
          No trims configured.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {trims.map((trim) => (
            <div
              key={trim.trim_id}
              data-testid={`trim-item-${trim.trim_id}`}
              style={{
                padding: '8px 12px',
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{trim.sku_id ?? 'Geometry only'}</strong>
                <span
                  data-testid={`trim-type-${trim.trim_id}`}
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    borderRadius: '3px',
                    backgroundColor: trim.trim_type === 'GEOMETRY' ? '#e0e0e0' : '#bbdefb',
                    color: '#333',
                  }}
                >
                  {trim.trim_type}
                </span>
              </div>
              <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                <span>Rule: {trim.quantity_rule}</span>
                {trim.quantity_rule === 'TRIM_FIXED' && trim.fixed_quantity != null && (
                  <span> (qty: {trim.fixed_quantity})</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {dialogOpen && (
        <AddTrimDialog
          templateId={templateId}
          onClose={() => setDialogOpen(false)}
          onAdded={() => {
            setDialogOpen(false);
            fetchTrims();
          }}
        />
      )}
    </div>
  );
}
