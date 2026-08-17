import { useEffect } from 'react';
import { useDesignLibraryStore, groupByDesignFamily } from '@/stores/designLibraryStore';
import type { TemplateWithAvailability } from '@/stores/designLibraryStore';
import type { WallGeometryType } from '@/types/database';
import { useProjectCreationStore } from '@/stores/projectCreationStore';
import { EnhancedTemplateCard } from './EnhancedTemplateCard';
import { TemplatePreviewPanel } from './TemplatePreviewPanel';

/**
 * DesignLibrary - enhanced template gallery with search, filters,
 * design family grouping, availability badges, and preview panel.
 */
export function DesignLibrary() {
  const filteredTemplates = useDesignLibraryStore((s) => s.filteredTemplates);
  const designFamilies = useDesignLibraryStore((s) => s.designFamilies);
  const filters = useDesignLibraryStore((s) => s.filters);
  const isLoading = useDesignLibraryStore((s) => s.isLoading);
  const error = useDesignLibraryStore((s) => s.error);
  const selectedTemplateDetail = useDesignLibraryStore((s) => s.selectedTemplateDetail);
  const fetchTemplatesWithAvailability = useDesignLibraryStore((s) => s.fetchTemplatesWithAvailability);
  const setSearchFilter = useDesignLibraryStore((s) => s.setSearchFilter);
  const setDesignFamilyFilter = useDesignLibraryStore((s) => s.setDesignFamilyFilter);
  const setWallGeometryFilter = useDesignLibraryStore((s) => s.setWallGeometryFilter);
  const setAvailabilityFilter = useDesignLibraryStore((s) => s.setAvailabilityFilter);
  const selectTemplateForPreview = useDesignLibraryStore((s) => s.selectTemplateForPreview);

  const selectTemplate = useProjectCreationStore((s) => s.selectTemplate);

  useEffect(() => {
    fetchTemplatesWithAvailability();
  }, [fetchTemplatesWithAvailability]);

  const handleSelect = (template: TemplateWithAvailability) => {
    selectTemplate(template);
  };

  const handlePreview = (template: TemplateWithAvailability) => {
    selectTemplateForPreview(template);
  };

  if (isLoading) {
    return (
      <div data-testid="design-library" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-ink-secondary)' }}>
        Loading templates...
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="design-library" style={{ padding: '24px' }}>
        <div
          style={{
            padding: '12px',
            backgroundColor: 'rgba(176,65,62,0.08)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            color: 'var(--color-error)',
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  if (filteredTemplates.length === 0 && !filters.search && !filters.designFamilyId && !filters.wallGeometry && filters.availability === 'ALL') {
    return (
      <div data-testid="design-library" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-ink-secondary)' }}>
        No templates available
      </div>
    );
  }

  const grouped = groupByDesignFamily(filteredTemplates);

  const geometryOptions: Array<{ label: string; value: WallGeometryType | null }> = [
    { label: 'All Geometries', value: null },
    { label: 'STRAIGHT', value: 'STRAIGHT' },
    { label: 'L_CORNER', value: 'L_CORNER' },
  ];

  const availabilityOptions: Array<{ label: string; value: 'ALL' | 'AVAILABLE' | 'BLOCKED' }> = [
    { label: 'All', value: 'ALL' },
    { label: 'Available', value: 'AVAILABLE' },
    { label: 'Blocked', value: 'BLOCKED' },
  ];

  return (
    <div data-testid="design-library" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search */}
      <div style={{ padding: '12px 16px 0 16px' }}>
        <input
          data-testid="design-library-search"
          type="text"
          placeholder="Search templates..."
          value={filters.search}
          onChange={(e) => setSearchFilter(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 'var(--text-base)',
            border: '1px solid var(--color-disabled)',
            borderRadius: 'var(--radius-sm)',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Filter row */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          padding: '8px 16px',
          borderBottom: '1px solid var(--color-hairline)',
          flexWrap: 'wrap',
        }}
      >
        <select
          data-testid="design-library-family-filter"
          value={filters.designFamilyId ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            setDesignFamilyFilter(val || null);
          }}
          style={{
            padding: '6px 10px',
            fontSize: 'var(--text-base)',
            border: '1px solid var(--color-disabled)',
            borderRadius: 'var(--radius-sm)',
            height: '32px',
            boxSizing: 'border-box',
          }}
        >
          <option value="">All Families</option>
          {designFamilies.map((family) => (
            <option key={family.design_family_id} value={family.design_family_id}>
              {family.name}
            </option>
          ))}
        </select>

        <select
          data-testid="design-library-geometry-filter"
          value={filters.wallGeometry ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            setWallGeometryFilter(val ? (val as WallGeometryType) : null);
          }}
          style={{
            padding: '6px 10px',
            fontSize: 'var(--text-base)',
            border: '1px solid var(--color-disabled)',
            borderRadius: 'var(--radius-sm)',
            height: '32px',
            boxSizing: 'border-box',
          }}
        >
          {geometryOptions.map((opt) => (
            <option key={opt.label} value={opt.value ?? ''}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          data-testid="design-library-availability-filter"
          value={filters.availability}
          onChange={(e) => {
            setAvailabilityFilter(e.target.value as 'ALL' | 'AVAILABLE' | 'BLOCKED');
          }}
          style={{
            padding: '6px 10px',
            fontSize: 'var(--text-base)',
            border: '1px solid var(--color-disabled)',
            borderRadius: 'var(--radius-sm)',
            height: '32px',
            boxSizing: 'border-box',
          }}
        >
          {availabilityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Template groups */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {filteredTemplates.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-ink-secondary)', padding: '24px' }}>
            No templates match your filters
          </div>
        ) : (
          Array.from(grouped.entries()).map(([familyName, templates]) => (
            <div key={familyName} style={{ marginBottom: '24px' }}>
              {/* Group header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--color-ink-primary)' }}>
                  {familyName}
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(154,123,79,0.1)',
                    color: 'var(--color-accent)',
                  }}
                >
                  {templates.length}
                </span>
              </div>

              {/* Grid within group */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: '16px',
                }}
              >
                {templates.map((template) => (
                  <EnhancedTemplateCard
                    key={template.template_id}
                    template={template}
                    onSelect={handleSelect}
                    onPreview={handlePreview}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Preview Panel */}
      {selectedTemplateDetail && <TemplatePreviewPanel />}
    </div>
  );
}
