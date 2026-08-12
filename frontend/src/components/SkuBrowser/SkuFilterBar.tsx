import { useEffect, useRef } from 'react';
import { useSkuStore } from '@/stores/skuStore';
import { ProductType, SkuStatus, CatalogueStatus } from '@/types/database';

/**
 * Filter bar for the SKU Browser panel.
 * Provides dropdowns and text inputs for filtering SKUs.
 */
export function SkuFilterBar() {
  const filters = useSkuStore((s) => s.filters);
  const families = useSkuStore((s) => s.families);
  const categories = useSkuStore((s) => s.categories);
  const setFilter = useSkuStore((s) => s.setFilter);
  const clearFilters = useSkuStore((s) => s.clearFilters);
  const setSearchQuery = useSkuStore((s) => s.setSearchQuery);
  const fetchFamilies = useSkuStore((s) => s.fetchFamilies);
  const fetchCategories = useSkuStore((s) => s.fetchCategories);
  const fetchSkus = useSkuStore((s) => s.fetchSkus);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load families on mount
  useEffect(() => {
    void fetchFamilies();
  }, [fetchFamilies]);

  // Load categories when family changes
  useEffect(() => {
    void fetchCategories(filters.familyId ?? undefined);
  }, [filters.familyId, fetchCategories]);

  // Fetch SKUs when filters change, with debounce for text inputs
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void fetchSkus();
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [filters, fetchSkus]);

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    marginTop: '4px',
    padding: '6px',
    fontSize: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 500,
    color: '#555',
  };

  return (
    <div
      data-testid="sku-filter-bar"
      style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderBottom: '1px solid #e0e0e0' }}
    >
      {/* Search */}
      <input
        type="text"
        placeholder="Search by SKU code or material..."
        value={filters.searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{ ...inputStyle, marginTop: 0 }}
        data-testid="sku-filter-search"
      />

      {/* Product Type */}
      <label style={labelStyle}>
        Product Type
        <select
          value={filters.productType ?? ''}
          onChange={(e) => setFilter('productType', (e.target.value || null) as ProductType | null)}
          style={inputStyle}
          data-testid="sku-filter-product-type"
        >
          <option value="">All</option>
          {Object.values(ProductType).map((t) => (
            <option key={t} value={t}>{t.replace('_', ' ')}</option>
          ))}
        </select>
      </label>

      {/* Family */}
      <label style={labelStyle}>
        Family
        <select
          value={filters.familyId ?? ''}
          onChange={(e) => setFilter('familyId', e.target.value || null)}
          style={inputStyle}
          data-testid="sku-filter-family"
        >
          <option value="">All</option>
          {families.map((f) => (
            <option key={f.family_id} value={f.family_id}>{f.name}</option>
          ))}
        </select>
      </label>

      {/* Category */}
      <label style={labelStyle}>
        Category
        <select
          value={filters.categoryId ?? ''}
          onChange={(e) => setFilter('categoryId', e.target.value || null)}
          style={inputStyle}
          data-testid="sku-filter-category"
        >
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c.category_id} value={c.category_id}>{c.name}</option>
          ))}
        </select>
      </label>

      {/* Material & Colour row */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          Material
          <input
            type="text"
            value={filters.material ?? ''}
            onChange={(e) => setFilter('material', e.target.value || null)}
            style={inputStyle}
            data-testid="sku-filter-material"
          />
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          Colour
          <input
            type="text"
            value={filters.colour ?? ''}
            onChange={(e) => setFilter('colour', e.target.value || null)}
            style={inputStyle}
            data-testid="sku-filter-colour"
          />
        </label>
      </div>

      {/* SKU Status & Catalogue Status row */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          SKU Status
          <select
            value={filters.skuStatus ?? ''}
            onChange={(e) => setFilter('skuStatus', (e.target.value || null) as SkuStatus | null)}
            style={inputStyle}
            data-testid="sku-filter-sku-status"
          >
            <option value="">All</option>
            {Object.values(SkuStatus).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          Catalogue Status
          <select
            value={filters.catalogueStatus ?? ''}
            onChange={(e) => setFilter('catalogueStatus', (e.target.value || null) as CatalogueStatus | null)}
            style={inputStyle}
            data-testid="sku-filter-catalogue-status"
          >
            <option value="">All</option>
            {Object.values(CatalogueStatus).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Clear Filters */}
      <button
        onClick={clearFilters}
        style={{
          padding: '6px 12px',
          fontSize: '12px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: '#f5f5f5',
          cursor: 'pointer',
        }}
        data-testid="sku-filter-clear-btn"
      >
        Clear Filters
      </button>
    </div>
  );
}
