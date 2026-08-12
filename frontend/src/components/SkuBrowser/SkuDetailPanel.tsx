import { useSkuStore } from '@/stores/skuStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { SkuStatus, CatalogueStatus } from '@/types/database';
import type { SkuWithCatalogue } from '@/types/database';

/**
 * Determine if a SKU is selectable for assignment.
 */
function isSelectable(sku: SkuWithCatalogue): boolean {
  return (
    sku.sku.status === SkuStatus.ACTIVE &&
    sku.catalogueEntry?.status === CatalogueStatus.READY
  );
}

/**
 * Detail panel shown when a SKU is selected in the browser.
 * Displays full SKU properties and an Assign to Zone button.
 */
export function SkuDetailPanel() {
  const skus = useSkuStore((s) => s.skus);
  const selectedSkuId = useSkuStore((s) => s.selectedSkuId);
  const closeBrowser = useSkuStore((s) => s.closeBrowser);
  const selectSku = useSkuStore((s) => s.selectSku);
  const assignSku = useProjectStore((s) => s.assignSku);
  const selectedZoneId = useCanvasStore((s) => s.selection.selectedZoneId);

  const selectedSku = skus.find((s) => s.sku.sku_id === selectedSkuId);
  if (!selectedSku) return null;

  const selectable = isSelectable(selectedSku);
  const canAssign = selectable && selectedZoneId !== null;

  const handleAssign = async () => {
    if (!canAssign || !selectedZoneId || !selectedSkuId) return;
    await assignSku(selectedZoneId, selectedSkuId);
    selectSku(null);
    closeBrowser();
  };

  const { sku } = selectedSku;

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    fontSize: '12px',
    borderBottom: '1px solid #f0f0f0',
  };

  const labelStyle: React.CSSProperties = {
    color: '#666',
    fontWeight: 500,
  };

  return (
    <div
      data-testid="sku-detail-panel"
      style={{
        borderTop: '1px solid #e0e0e0',
        padding: '12px',
        maxHeight: '300px',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>SKU Details</h4>
        <button
          onClick={() => selectSku(null)}
          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', color: '#666' }}
          data-testid="sku-detail-close-btn"
        >
          &times;
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={rowStyle}>
          <span style={labelStyle}>SKU Code</span>
          <span>{sku.sku_code}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Product Type</span>
          <span>{sku.product_type}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Material</span>
          <span>{sku.material}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Colour</span>
          <span>{sku.colour}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Finish</span>
          <span>{sku.finish}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Dimensions</span>
          <span>{sku.width_mm ?? '-'} x {sku.height_mm ?? '-'} x {sku.thickness_mm ?? '-'} mm</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Pattern Identity</span>
          <span>{sku.pattern_identity ?? '-'}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>GH / GV (mm)</span>
          <span>{sku.gh_mm} / {sku.gv_mm}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Quantity Mode</span>
          <span>{sku.quantity_mode ?? '-'}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Status</span>
          <span>{sku.status}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Catalogue Status</span>
          <span
            style={{
              color: selectedSku.catalogueEntry?.status === CatalogueStatus.READY ? '#2e7d32' : '#e65100',
              fontWeight: 600,
            }}
          >
            {selectedSku.catalogueEntry?.status ?? 'NO CATALOGUE'}
          </span>
        </div>
        {sku.commercial_attributes && Object.keys(sku.commercial_attributes).length > 0 && (
          <div style={rowStyle}>
            <span style={labelStyle}>Commercial Attributes</span>
            <span>{JSON.stringify(sku.commercial_attributes)}</span>
          </div>
        )}
      </div>

      {/* Assign Button */}
      <button
        onClick={() => void handleAssign()}
        disabled={!canAssign}
        style={{
          marginTop: '12px',
          width: '100%',
          padding: '8px 12px',
          fontSize: '13px',
          fontWeight: 600,
          border: 'none',
          borderRadius: '4px',
          backgroundColor: canAssign ? '#1976d2' : '#ccc',
          color: '#fff',
          cursor: canAssign ? 'pointer' : 'not-allowed',
        }}
        data-testid="sku-detail-assign-btn"
      >
        {!selectedZoneId ? 'No Zone Selected' : !selectable ? 'SKU Not Available' : 'Assign to Zone'}
      </button>
    </div>
  );
}
