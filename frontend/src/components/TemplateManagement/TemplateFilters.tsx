import { TemplateStatus } from '@/types/database';
import type { WallGeometryType } from '@/types/database';
import { useTemplateManagementStore } from '@/stores/templateManagementStore';

export function TemplateFilters() {
  const filters = useTemplateManagementStore((s) => s.filters);
  const setSearchFilter = useTemplateManagementStore((s) => s.setSearchFilter);
  const setStatusFilter = useTemplateManagementStore((s) => s.setStatusFilter);
  const setWallGeometryFilter = useTemplateManagementStore((s) => s.setWallGeometryFilter);

  const statusOptions: Array<{ label: string; value: TemplateStatus | null }> = [
    { label: 'All', value: null },
    { label: 'DRAFT', value: TemplateStatus.DRAFT },
    { label: 'ACTIVE', value: TemplateStatus.ACTIVE },
    { label: 'RETIRED', value: TemplateStatus.RETIRED },
  ];

  const geometryOptions: Array<{ label: string; value: WallGeometryType | null }> = [
    { label: 'All', value: null },
    { label: 'STRAIGHT', value: 'STRAIGHT' },
    { label: 'L_CORNER', value: 'L_CORNER' },
  ];

  return (
    <div
      data-testid="template-filters"
      style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid #e0e0e0',
        flexWrap: 'wrap',
      }}
    >
      <input
        data-testid="template-search-input"
        type="text"
        placeholder="Search templates..."
        value={filters.search}
        onChange={(e) => setSearchFilter(e.target.value)}
        style={{
          padding: '6px 10px',
          fontSize: '13px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          minWidth: '200px',
        }}
      />

      <select
        data-testid="template-status-filter"
        value={filters.status ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          setStatusFilter(val ? (val as TemplateStatus) : null);
        }}
        style={{
          padding: '6px 10px',
          fontSize: '13px',
          border: '1px solid #ccc',
          borderRadius: '4px',
        }}
      >
        {statusOptions.map((opt) => (
          <option key={opt.label} value={opt.value ?? ''}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        data-testid="template-geometry-filter"
        value={filters.wallGeometry ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          setWallGeometryFilter(val ? (val as WallGeometryType) : null);
        }}
        style={{
          padding: '6px 10px',
          fontSize: '13px',
          border: '1px solid #ccc',
          borderRadius: '4px',
        }}
      >
        {geometryOptions.map((opt) => (
          <option key={opt.label} value={opt.value ?? ''}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
