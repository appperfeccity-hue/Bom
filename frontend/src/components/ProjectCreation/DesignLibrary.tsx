import { useEffect, useMemo, useState } from 'react';
import { useDesignLibraryStore } from '@/stores/designLibraryStore';
import type { TemplateWithAvailability } from '@/stores/designLibraryStore';
import { useProjectCreationStore } from '@/stores/projectCreationStore';
import type { WallGeometryType } from '@/types/database';
import { EnhancedTemplateCard } from './EnhancedTemplateCard';
import { TemplatePreviewPanel } from './TemplatePreviewPanel';
import { CategoryCarousel } from './CategoryCarousel';
import { LookSwatches } from './LookSwatches';
import { FilterChipBar } from './FilterChipBar';
import '@/styles/design-library.css';

/**
 * DesignLibrary - premium interior-design gallery with
 * category cards, look swatches, smart filter chips, and image-first grid.
 */
export function DesignLibrary() {
  const templates = useDesignLibraryStore((s) => s.templates);
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

  // TECH DEBT: activeCategory is intentionally kept as local component state rather than
  // being added to the Zustand designLibraryStore. This avoids modifying the store per task
  // constraints. The trade-off is that this filter is invisible to any future URL-sync,
  // deep-linking, or state-persistence mechanisms. When store modifications are permitted,
  // consider migrating activeCategory into a dedicated UI-state slice in the store.
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // State for the "More Filters" popover (geometry + availability)
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  useEffect(() => {
    fetchTemplatesWithAvailability();
  }, [fetchTemplatesWithAvailability]);

  const handleSelect = (template: TemplateWithAvailability) => {
    selectTemplate(template);
  };

  const handlePreview = (template: TemplateWithAvailability) => {
    selectTemplateForPreview(template);
  };

  // Apply local category filter on top of store's filteredTemplates
  const displayedTemplates = useMemo(() => {
    if (!activeCategory) return filteredTemplates;
    return filteredTemplates.filter((t) => t.wall_application === activeCategory);
  }, [filteredTemplates, activeCategory]);

  // Get active design family name for display in chips
  const activeDesignFamilyName = useMemo(() => {
    if (!filters.designFamilyId) return null;
    const family = designFamilies.find((f) => f.design_family_id === filters.designFamilyId);
    return family ? family.name : null;
  }, [filters.designFamilyId, designFamilies]);

  const handleCategorySelect = (category: string | null) => {
    setActiveCategory(category);
  };

  const handleDesignFamilySelect = (id: string | null) => {
    setDesignFamilyFilter(id);
  };

  const handleClearAll = () => {
    setActiveCategory(null);
    setSearchFilter('');
    setDesignFamilyFilter(null);
    setWallGeometryFilter(null);
    setAvailabilityFilter('ALL');
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

  return (
    <div data-testid="design-library" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search */}
      <div className="dl-search-wrapper">
        <input
          data-testid="design-library-search"
          type="text"
          placeholder="Search templates..."
          value={filters.search}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="dl-search-input"
        />
      </div>

      {/* Category Carousel */}
      <CategoryCarousel
        templates={templates}
        activeCategory={activeCategory}
        onCategorySelect={handleCategorySelect}
      />

      {/* Look Swatches */}
      <LookSwatches
        designFamilies={designFamilies}
        activeDesignFamilyId={filters.designFamilyId}
        onDesignFamilySelect={handleDesignFamilySelect}
      />

      {/* Filter Chip Bar */}
      <FilterChipBar
        activeCategory={activeCategory}
        activeDesignFamilyName={activeDesignFamilyName}
        activeGeometry={filters.wallGeometry}
        activeAvailability={filters.availability}
        searchTerm={filters.search}
        onClearCategory={() => setActiveCategory(null)}
        onClearDesignFamily={() => setDesignFamilyFilter(null)}
        onClearGeometry={() => setWallGeometryFilter(null)}
        onClearAvailability={() => setAvailabilityFilter('ALL')}
        onClearSearch={() => setSearchFilter('')}
        onClearAll={handleClearAll}
      />

      {/* More Filters - geometry and availability setters */}
      <div className="dl-more-filters" data-testid="more-filters">
        <button
          className="dl-more-filters__toggle"
          onClick={() => setShowMoreFilters(!showMoreFilters)}
          aria-expanded={showMoreFilters}
          data-testid="more-filters-toggle"
        >
          More Filters {showMoreFilters ? '\u25B2' : '\u25BC'}
        </button>
        {showMoreFilters && (
          <div className="dl-more-filters__panel" data-testid="more-filters-panel">
            <div className="dl-more-filters__group">
              <label className="dl-more-filters__label" htmlFor="geometry-filter">
                Wall Geometry
              </label>
              <select
                id="geometry-filter"
                className="dl-more-filters__select"
                data-testid="geometry-filter-select"
                value={filters.wallGeometry ?? ''}
                onChange={(e) =>
                  setWallGeometryFilter(e.target.value === '' ? null : e.target.value as WallGeometryType)
                }
              >
                <option value="">All Geometries</option>
                <option value="STRAIGHT">Straight</option>
                <option value="L_SHAPE">L-Shape</option>
                <option value="L_CORNER">L-Corner (legacy)</option>
              </select>
            </div>
            <div className="dl-more-filters__group">
              <label className="dl-more-filters__label" htmlFor="availability-filter">
                Availability
              </label>
              <select
                id="availability-filter"
                className="dl-more-filters__select"
                data-testid="availability-filter-select"
                value={filters.availability}
                onChange={(e) =>
                  setAvailabilityFilter(e.target.value as 'ALL' | 'AVAILABLE' | 'BLOCKED')
                }
              >
                <option value="ALL">All</option>
                <option value="AVAILABLE">Available</option>
                <option value="BLOCKED">Blocked</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Template Grid */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {displayedTemplates.length === 0 ? (
          <div className="dl-empty-state">
            No templates match your filters
          </div>
        ) : (
          <div className="dl-template-grid">
            {displayedTemplates.map((template) => (
              <EnhancedTemplateCard
                key={template.template_id}
                template={template}
                onSelect={handleSelect}
                onPreview={handlePreview}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preview Panel */}
      {selectedTemplateDetail && <TemplatePreviewPanel />}
    </div>
  );
}
