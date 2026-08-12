import { useSkuStore } from '@/stores/skuStore';
import { SkuStatus, CatalogueStatus } from '@/types/database';
import type { SkuWithCatalogue } from '@/types/database';

/**
 * Determine if a SKU is selectable for assignment.
 * Selectable = ACTIVE status AND catalogue READY.
 */
export function isSelectable(sku: SkuWithCatalogue): boolean {
  return (
    sku.sku.status === SkuStatus.ACTIVE &&
    sku.catalogueEntry?.status === CatalogueStatus.READY
  );
}

/**
 * Grid of SKU cards with thumbnail, code, dimensions and status badge.
 */
export function SkuGrid() {
  const skus = useSkuStore((s) => s.skus);
  const selectedSkuId = useSkuStore((s) => s.selectedSkuId);
  const selectSku = useSkuStore((s) => s.selectSku);
  const isLoading = useSkuStore((s) => s.isLoading);
  const page = useSkuStore((s) => s.page);
  const pageSize = useSkuStore((s) => s.pageSize);
  const totalCount = useSkuStore((s) => s.totalCount);
  const setPage = useSkuStore((s) => s.setPage);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (isLoading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#999' }} data-testid="sku-grid-loading">
        Loading SKUs...
      </div>
    );
  }

  if (skus.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#999' }} data-testid="sku-grid-empty">
        No SKUs found
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Grid */}
      <div
        data-testid="sku-grid"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '12px',
          alignContent: 'start',
        }}
      >
        {skus.map((skuItem) => {
          const selectable = isSelectable(skuItem);
          const isSelected = selectedSkuId === skuItem.sku.sku_id;

          return (
            <div
              key={skuItem.sku.sku_id}
              data-testid={`sku-card-${skuItem.sku.sku_id}`}
              onClick={() => selectSku(skuItem.sku.sku_id)}
              style={{
                border: isSelected ? '2px solid #1976d2' : '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                opacity: selectable ? 1 : 0.4,
                backgroundColor: isSelected ? '#e3f2fd' : '#fff',
                transition: 'border-color 0.15s, background-color 0.15s',
              }}
            >
              {/* Thumbnail */}
              <div
                style={{
                  width: '100%',
                  height: '80px',
                  backgroundColor: '#f0f0f0',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {skuItem.thumbnailUrl ? (
                  <img
                    src={skuItem.thumbnailUrl}
                    alt={skuItem.sku.sku_code}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: '11px', color: '#999' }}>No image</span>
                )}
              </div>

              {/* SKU code */}
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {skuItem.sku.sku_code}
              </div>

              {/* Material / Colour */}
              <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                {skuItem.sku.material} {skuItem.sku.colour}
              </div>

              {/* Dimensions */}
              <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px' }}>
                {skuItem.sku.width_mm ?? '-'} x {skuItem.sku.height_mm ?? '-'} x {skuItem.sku.thickness_mm ?? '-'} mm
              </div>

              {/* Catalogue status badge */}
              <div
                data-testid={`sku-badge-${skuItem.sku.sku_id}`}
                style={{
                  display: 'inline-block',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  backgroundColor: skuItem.catalogueEntry?.status === CatalogueStatus.READY ? '#e8f5e9' : '#fff3e0',
                  color: skuItem.catalogueEntry?.status === CatalogueStatus.READY ? '#2e7d32' : '#e65100',
                }}
              >
                {skuItem.catalogueEntry?.status ?? 'NO CATALOGUE'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div
        data-testid="sku-grid-pagination"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderTop: '1px solid #e0e0e0',
          fontSize: '12px',
        }}
      >
        <button
          onClick={() => setPage(page - 1)}
          disabled={page === 0}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: page === 0 ? 'not-allowed' : 'pointer',
            opacity: page === 0 ? 0.5 : 1,
          }}
          data-testid="sku-grid-prev-btn"
        >
          Previous
        </button>
        <span data-testid="sku-grid-page-indicator">
          Page {page + 1} of {totalPages}
        </span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={page + 1 >= totalPages}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: page + 1 >= totalPages ? 'not-allowed' : 'pointer',
            opacity: page + 1 >= totalPages ? 0.5 : 1,
          }}
          data-testid="sku-grid-next-btn"
        >
          Next
        </button>
      </div>
    </div>
  );
}
