import type { TemplateWithAvailability } from '@/stores/designLibraryStore';

interface CategoryCarouselProps {
  templates: TemplateWithAvailability[];
  activeCategory: string | null;
  onCategorySelect: (category: string | null) => void;
}

/**
 * The 12 required business taxonomy categories.
 * These must ALWAYS appear regardless of whether templates currently exist for them.
 */
const REQUIRED_CATEGORIES = [
  'TV Unit Wall',
  'Living Room',
  'Bed Back Wall',
  'Home Entrance',
  'Mandir Corner',
  'Study Wall',
  'Photo Wall',
  'Bathroom Wall',
  'Dining Wall',
  'Vanity Corner',
  'Kids Room',
  'Customer Spaces',
] as const;

/** Maps category names to warm gradient backgrounds */
const CATEGORY_GRADIENTS: Record<string, string> = {
  'TV Unit Wall': 'linear-gradient(135deg, #d4a574 0%, #8b6914 100%)',
  'Living Room': 'linear-gradient(135deg, #e8d5b7 0%, #9a7b4f 100%)',
  'Bed Back Wall': 'linear-gradient(135deg, #c9b8a8 0%, #7a5c3e 100%)',
  'Home Entrance': 'linear-gradient(135deg, #d4c4a8 0%, #6b5b3e 100%)',
  'Mandir Corner': 'linear-gradient(135deg, #f0e0c0 0%, #b8944c 100%)',
  'Study Wall': 'linear-gradient(135deg, #b8a88c 0%, #5c4a2e 100%)',
  'Photo Wall': 'linear-gradient(135deg, #d8cfc4 0%, #8a7a64 100%)',
  'Bathroom Wall': 'linear-gradient(135deg, #e0e8e4 0%, #6a8a7a 100%)',
  'Dining Wall': 'linear-gradient(135deg, #d4c4a8 0%, #6b5b3e 100%)',
  'Vanity Corner': 'linear-gradient(135deg, #f0e4d8 0%, #a08060 100%)',
  'Kids Room': 'linear-gradient(135deg, #e8e0d4 0%, #b0a090 100%)',
  'Customer Spaces': 'linear-gradient(135deg, #d0c8bc 0%, #7a6e5e 100%)',
};

const DEFAULT_GRADIENT = 'linear-gradient(135deg, #e8d5b7 0%, #c4a882 50%, #9a7b4f 100%)';

/**
 * CategoryCarousel - horizontal scrollable row of the 12 required space categories.
 * Categories are always visible regardless of whether templates exist for them.
 * Template count per category is derived dynamically for informational display.
 */
export function CategoryCarousel({ templates, activeCategory, onCategorySelect }: CategoryCarouselProps) {
  // Count templates per category for optional badge display
  const categoryCounts = new Map<string, number>();
  for (const t of templates) {
    if (t.wall_application) {
      categoryCounts.set(t.wall_application, (categoryCounts.get(t.wall_application) || 0) + 1);
    }
  }

  return (
    <div className="dl-category-carousel" data-testid="category-carousel">
      <h3 className="dl-category-carousel__title">Explore designs for</h3>
      <div className="dl-category-carousel__scroll">
        {REQUIRED_CATEGORIES.map((category) => {
          const count = categoryCounts.get(category) || 0;
          return (
            <div
              key={category}
              className={`dl-category-card${activeCategory === category ? ' dl-category-card--active' : ''}`}
              style={{ background: CATEGORY_GRADIENTS[category] || DEFAULT_GRADIENT }}
              onClick={() => onCategorySelect(activeCategory === category ? null : category)}
              role="button"
              tabIndex={0}
              aria-pressed={activeCategory === category}
              aria-label={`Filter by ${category}${count > 0 ? ` (${count} designs)` : ''}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onCategorySelect(activeCategory === category ? null : category);
                }
              }}
            >
              <span className="dl-category-card__label">{category}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
