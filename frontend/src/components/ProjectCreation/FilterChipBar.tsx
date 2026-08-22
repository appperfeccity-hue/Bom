interface FilterChipBarProps {
  activeCategory: string | null;
  activeDesignFamilyName: string | null;
  activeGeometry: string | null;
  activeAvailability: 'ALL' | 'AVAILABLE' | 'BLOCKED';
  searchTerm: string;
  onClearCategory: () => void;
  onClearDesignFamily: () => void;
  onClearGeometry: () => void;
  onClearAvailability: () => void;
  onClearSearch: () => void;
  onClearAll: () => void;
}

/**
 * FilterChipBar - horizontal bar of active filter chips with remove buttons.
 * Only renders when at least one filter is active.
 */
export function FilterChipBar({
  activeCategory,
  activeDesignFamilyName,
  activeGeometry,
  activeAvailability,
  searchTerm,
  onClearCategory,
  onClearDesignFamily,
  onClearGeometry,
  onClearAvailability,
  onClearSearch,
  onClearAll,
}: FilterChipBarProps) {
  const hasActiveFilters =
    activeCategory !== null ||
    activeDesignFamilyName !== null ||
    activeGeometry !== null ||
    activeAvailability !== 'ALL' ||
    searchTerm.trim() !== '';

  if (!hasActiveFilters) return null;

  const chipCount = [
    activeCategory,
    activeDesignFamilyName,
    activeGeometry,
    activeAvailability !== 'ALL' ? activeAvailability : null,
    searchTerm.trim() || null,
  ].filter(Boolean).length;

  return (
    <div className="dl-filter-bar" data-testid="filter-chip-bar">
      {searchTerm.trim() && (
        <span className="dl-filter-chip" data-testid="filter-chip-search">
          &ldquo;{searchTerm.trim()}&rdquo;
          <button
            className="dl-filter-chip__remove"
            onClick={onClearSearch}
            aria-label="Clear search filter"
          >
            &times;
          </button>
        </span>
      )}

      {activeCategory && (
        <span className="dl-filter-chip" data-testid="filter-chip-category">
          {activeCategory}
          <button
            className="dl-filter-chip__remove"
            onClick={onClearCategory}
            aria-label="Clear category filter"
          >
            &times;
          </button>
        </span>
      )}

      {activeDesignFamilyName && (
        <span className="dl-filter-chip" data-testid="filter-chip-family">
          {activeDesignFamilyName}
          <button
            className="dl-filter-chip__remove"
            onClick={onClearDesignFamily}
            aria-label="Clear design family filter"
          >
            &times;
          </button>
        </span>
      )}

      {activeGeometry && (
        <span className="dl-filter-chip" data-testid="filter-chip-geometry">
          {activeGeometry}
          <button
            className="dl-filter-chip__remove"
            onClick={onClearGeometry}
            aria-label="Clear geometry filter"
          >
            &times;
          </button>
        </span>
      )}

      {activeAvailability !== 'ALL' && (
        <span className="dl-filter-chip" data-testid="filter-chip-availability">
          {activeAvailability}
          <button
            className="dl-filter-chip__remove"
            onClick={onClearAvailability}
            aria-label="Clear availability filter"
          >
            &times;
          </button>
        </span>
      )}

      {chipCount > 1 && (
        <button
          className="dl-filter-clear-all"
          onClick={onClearAll}
          data-testid="filter-clear-all"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
