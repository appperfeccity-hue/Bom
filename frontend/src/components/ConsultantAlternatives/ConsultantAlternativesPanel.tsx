import { useMemo, useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode } from '@/types/database';

export interface SnapshotAlternative {
  alternative_id: string;
  template_zone_id: string;
  alternative_sku_id: string;
  sku_code: string;
  display_order: number;
  status: string;
}

/**
 * Panel visible in Consultant mode when a zone is selected and
 * that zone has promoted alternatives in the snapshot_data.
 * Allows consultants to select from promoted alternative SKUs only.
 */
export function ConsultantAlternativesPanel() {
  const mode = useCanvasStore((s) => s.mode);
  const selectedZoneId = useCanvasStore((s) => s.selection.selectedZoneId);
  const currentSnapshot = useProjectStore((s) => s.currentSnapshot);
  const assignSku = useProjectStore((s) => s.assignSku);
  const zoneSku = useProjectStore((s) => s.zoneSku);

  const alternatives: SnapshotAlternative[] = useMemo(() => {
    if (mode !== CanvasMode.CONSULTANT || !currentSnapshot || !selectedZoneId) {
      return [];
    }
    const snapshotData = currentSnapshot.snapshot_data;
    if (!snapshotData || !Array.isArray(snapshotData.alternatives)) {
      return [];
    }
    return (snapshotData.alternatives as SnapshotAlternative[])
      .filter((alt) => alt.template_zone_id === selectedZoneId && alt.status === 'ACTIVE')
      .sort((a, b) => a.display_order - b.display_order);
  }, [mode, currentSnapshot, selectedZoneId]);

  const currentSku = selectedZoneId ? zoneSku.get(selectedZoneId) : null;

  const handleSelect = useCallback(
    (skuId: string) => {
      if (!selectedZoneId) return;
      void assignSku(selectedZoneId, skuId);
    },
    [selectedZoneId, assignSku],
  );

  // Don't render if not in consultant mode
  if (mode !== CanvasMode.CONSULTANT) {
    return null;
  }

  // Don't render if no zone selected or no alternatives
  if (!selectedZoneId || alternatives.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="consultant-alternatives-panel"
      style={{
        padding: '16px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: '#fafafa',
      }}
    >
      <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600 }}>
        Alternative SKUs
      </h3>

      {currentSku && (
        <div style={{ marginBottom: '12px', fontSize: '12px', color: '#666' }}>
          Current: <strong>{currentSku.sku_code}</strong>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {alternatives.map((alt) => {
          const isSelected = currentSku?.sku_id === alt.alternative_sku_id;
          return (
            <button
              key={alt.alternative_id}
              data-testid={`alternative-option-${alt.alternative_sku_id}`}
              onClick={() => handleSelect(alt.alternative_sku_id)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 12px',
                fontSize: '13px',
                textAlign: 'left',
                backgroundColor: isSelected ? '#e3f2fd' : '#fff',
                border: isSelected ? '2px solid #1976d2' : '1px solid #e0e0e0',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: isSelected ? 600 : 400,
              }}
            >
              {alt.sku_code}
              {isSelected && (
                <span style={{ float: 'right', fontSize: '11px', color: '#1976d2' }}>
                  Selected
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
