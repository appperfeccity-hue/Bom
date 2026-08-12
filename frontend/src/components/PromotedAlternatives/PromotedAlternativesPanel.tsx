import { useState, useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasMode } from '@/types/database';
import type { TemplateZone } from '@/types/database';
import { fromTable } from '@/lib/supabase';
import { AddAlternativeDialog } from './AddAlternativeDialog';

interface ZoneAlternative {
  zone_id: string;
  zone_name: string;
  sku_id: string;
  sku_code: string;
  product_type: string;
}

interface PromotedAlternativesPanelProps {
  templateId: string;
}

/**
 * Panel showing promoted alternative SKUs per zone.
 * Only visible in DESIGNER mode.
 */
export function PromotedAlternativesPanel({ templateId }: PromotedAlternativesPanelProps) {
  const mode = useCanvasStore((s) => s.mode);
  const [alternatives, setAlternatives] = useState<ZoneAlternative[]>([]);
  const [zones, setZones] = useState<TemplateZone[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    // Fetch zones for this template
    const { data: zonesData } = await fromTable('template_zone')
      .select('*')
      .eq('template_id', templateId);

    if (zonesData) {
      setZones(zonesData as TemplateZone[]);
    }

    // Fetch alternatives with zone and sku info
    const { data: altData } = await fromTable('template_zone_alternative')
      .select('zone_id, sku_id, sku_master(sku_code, product_type), template_zone(name)')
      .eq('template_zone.template_id', templateId);

    if (altData) {
      const mapped: ZoneAlternative[] = (altData as Array<Record<string, unknown>>).map((row) => {
        const skuInfo = row.sku_master as Record<string, string> | null;
        const zoneInfo = row.template_zone as Record<string, string> | null;
        return {
          zone_id: row.zone_id as string,
          zone_name: zoneInfo?.name ?? 'Unknown Zone',
          sku_id: row.sku_id as string,
          sku_code: skuInfo?.sku_code ?? 'Unknown',
          product_type: skuInfo?.product_type ?? 'Unknown',
        };
      });
      setAlternatives(mapped);
    }
  }, [templateId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRemove = async (zoneId: string, skuId: string) => {
    await fromTable('template_zone_alternative')
      .delete()
      .eq('zone_id', zoneId)
      .eq('sku_id', skuId);
    setAlternatives((prev) =>
      prev.filter((a) => !(a.zone_id === zoneId && a.sku_id === skuId))
    );
  };

  if (mode !== CanvasMode.DESIGNER) {
    return null;
  }

  return (
    <div
      data-testid="promoted-alternatives-panel"
      style={{
        padding: '16px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: '#fafafa',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Promoted Alternatives</h3>
        <button
          data-testid="add-alternative-btn"
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
          Add Alternative
        </button>
      </div>

      {alternatives.length === 0 ? (
        <div data-testid="no-alternatives-msg" style={{ fontSize: '13px', color: '#666' }}>
          No promoted alternatives configured.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alternatives.map((alt) => (
            <div
              key={`${alt.zone_id}-${alt.sku_id}`}
              data-testid={`alternative-item-${alt.zone_id}-${alt.sku_id}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            >
              <div>
                <strong>{alt.zone_name}</strong>: {alt.sku_code} ({alt.product_type})
              </div>
              <button
                data-testid={`remove-alternative-${alt.zone_id}-${alt.sku_id}`}
                onClick={() => handleRemove(alt.zone_id, alt.sku_id)}
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  backgroundColor: '#ef5350',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {dialogOpen && (
        <AddAlternativeDialog
          templateId={templateId}
          zones={zones}
          onClose={() => setDialogOpen(false)}
          onAdded={() => {
            setDialogOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
