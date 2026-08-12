import { useState, useEffect } from 'react';
import { fromTable } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { SkuMaster, TemplateZone } from '@/types/database';

interface AddAlternativeDialogProps {
  templateId: string;
  zones: TemplateZone[];
  onClose: () => void;
  onAdded: () => void;
}

/**
 * Dialog to browse and select alternative SKUs for a zone.
 * Has zone selector, SKU search/select, and confirm/cancel buttons.
 * On confirm, inserts into template_zone_alternative table.
 */
export function AddAlternativeDialog({
  templateId,
  zones,
  onClose,
  onAdded,
}: AddAlternativeDialogProps) {
  const user = useAuthStore((s) => s.user);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [skus, setSkus] = useState<SkuMaster[]>([]);
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Suppress unused variable warning - templateId is used conceptually for scoping
  void templateId;

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSkus([]);
      return;
    }
    let cancelled = false;
    const fetchSkus = async () => {
      setIsLoading(true);
      const { data } = await fromTable('sku_master')
        .select('*')
        .ilike('sku_code', `%${searchQuery}%`)
        .eq('status', 'ACTIVE')
        .range(0, 19);
      if (!cancelled && data) {
        setSkus(data as SkuMaster[]);
      }
      if (!cancelled) setIsLoading(false);
    };
    fetchSkus();
    return () => { cancelled = true; };
  }, [searchQuery]);

  const handleConfirm = async () => {
    if (!selectedZoneId || !selectedSkuId) return;
    await fromTable('template_zone_alternative').insert({
      zone_id: selectedZoneId,
      sku_id: selectedSkuId,
      promoted_by: user?.id ?? null,
    });
    onAdded();
  };

  return (
    <div
      data-testid="add-alternative-dialog"
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
          width: '480px',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Add Promoted Alternative</h3>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
            Zone
          </label>
          <select
            data-testid="zone-selector"
            value={selectedZoneId}
            onChange={(e) => setSelectedZoneId(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
          >
            <option value="">Select a zone...</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>
            Search SKU
          </label>
          <input
            data-testid="sku-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by SKU code..."
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px', boxSizing: 'border-box' }}
          />
        </div>

        {isLoading && <div style={{ fontSize: '12px', color: '#666' }}>Loading...</div>}

        <div style={{ maxHeight: '200px', overflow: 'auto', marginBottom: '16px' }}>
          {skus.map((sku) => (
            <div
              key={sku.sku_id}
              data-testid={`sku-option-${sku.sku_id}`}
              onClick={() => setSelectedSkuId(sku.sku_id)}
              style={{
                padding: '8px',
                cursor: 'pointer',
                backgroundColor: selectedSkuId === sku.sku_id ? '#e3f2fd' : 'transparent',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            >
              <strong>{sku.sku_code}</strong> - {sku.product_type} ({sku.material})
            </div>
          ))}
        </div>

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
            disabled={!selectedZoneId || !selectedSkuId}
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#1976d2',
              color: '#fff',
              cursor: !selectedZoneId || !selectedSkuId ? 'not-allowed' : 'pointer',
              opacity: !selectedZoneId || !selectedSkuId ? 0.5 : 1,
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
