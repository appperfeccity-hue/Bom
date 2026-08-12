import { useState, useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasMode, CompatibilityRelationship, Directionality } from '@/types/database';
import type { SkuCompatibility } from '@/types/database';
import { fromTable } from '@/lib/supabase';
import { AddRelationshipDialog } from './AddRelationshipDialog';

interface ProductRelationshipsPanelProps {
  templateId: string;
}

const RELATIONSHIP_COLORS: Record<CompatibilityRelationship, { bg: string; text: string }> = {
  [CompatibilityRelationship.REQUIRES]: { bg: '#ffcdd2', text: '#c62828' },
  [CompatibilityRelationship.COMPATIBLE_WITH]: { bg: '#c8e6c9', text: '#2e7d32' },
  [CompatibilityRelationship.ALTERNATIVE_TO]: { bg: '#bbdefb', text: '#1565c0' },
};

/**
 * Panel showing SKU compatibility relationships relevant to the template.
 * Only visible in DESIGNER mode.
 */
export function ProductRelationshipsPanel({ templateId }: ProductRelationshipsPanelProps) {
  const mode = useCanvasStore((s) => s.mode);
  const [relationships, setRelationships] = useState<SkuCompatibility[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    // Gather all SKU IDs used in this template from relevant tables
    const skuIds = new Set<string>();

    const { data: lightingData } = await fromTable('template_lighting')
      .select('sku_id')
      .eq('template_id', templateId);
    if (lightingData) {
      (lightingData as Array<{ sku_id: string }>).forEach((r) => skuIds.add(r.sku_id));
    }

    const { data: trimData } = await fromTable('template_trim')
      .select('sku_id')
      .eq('template_id', templateId);
    if (trimData) {
      (trimData as Array<{ sku_id: string | null }>).forEach((r) => {
        if (r.sku_id) skuIds.add(r.sku_id);
      });
    }

    const { data: zoneSkuData } = await fromTable('template_zone_sku')
      .select('sku_id')
      .eq('template_id', templateId);
    if (zoneSkuData) {
      (zoneSkuData as Array<{ sku_id: string }>).forEach((r) => skuIds.add(r.sku_id));
    }

    if (skuIds.size === 0) {
      setRelationships([]);
      return;
    }

    const skuIdArray = Array.from(skuIds);

    // Fetch compatibility records where source or target is in the template's SKUs
    const { data: compatData } = await fromTable('sku_compatibility')
      .select('*')
      .or(`source_sku_id.in.(${skuIdArray.join(',')}),target_sku_id.in.(${skuIdArray.join(',')})`);

    if (compatData) {
      setRelationships(compatData as SkuCompatibility[]);
    }
  }, [templateId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRemove = async (compatibilityId: string) => {
    await fromTable('sku_compatibility')
      .delete()
      .eq('compatibility_id', compatibilityId);
    setRelationships((prev) =>
      prev.filter((r) => r.compatibility_id !== compatibilityId)
    );
  };

  if (mode !== CanvasMode.DESIGNER) {
    return null;
  }

  return (
    <div
      data-testid="product-relationships-panel"
      style={{
        padding: '16px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: '#fafafa',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Product Relationships</h3>
        <button
          data-testid="add-relationship-btn"
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
          Add Relationship
        </button>
      </div>

      {relationships.length === 0 ? (
        <div data-testid="no-relationships-msg" style={{ fontSize: '13px', color: '#666' }}>
          No product relationships configured.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {relationships.map((rel) => {
            const colors = RELATIONSHIP_COLORS[rel.relationship_type];
            const arrow = rel.directionality === Directionality.BIDIRECTIONAL ? '\u2194' : '\u2192';
            return (
              <div
                key={rel.compatibility_id}
                data-testid={`relationship-item-${rel.compatibility_id}`}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>{rel.source_sku_id} {arrow} {rel.target_sku_id}</span>
                  <span
                    data-testid={`relationship-type-${rel.compatibility_id}`}
                    style={{
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: colors.bg,
                      color: colors.text,
                    }}
                  >
                    {rel.relationship_type}
                  </span>
                  {rel.is_mandatory && (
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: '#fff3e0',
                        color: '#e65100',
                      }}
                    >
                      MANDATORY
                    </span>
                  )}
                </div>
                <button
                  data-testid={`remove-relationship-${rel.compatibility_id}`}
                  onClick={() => handleRemove(rel.compatibility_id)}
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
            );
          })}
        </div>
      )}

      {dialogOpen && (
        <AddRelationshipDialog
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
