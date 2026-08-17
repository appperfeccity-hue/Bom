import type { TemplateWithAvailability } from '@/stores/designLibraryStore';

interface CategoryCarouselProps {
  templates: TemplateWithAvailability[];
  activeCategory: string | null;
  onCategorySelect: (category: string | null) => void;
}

/** Maps wall_application values to warm gradient backgrounds */
const CATEGORY_GRADIENTS: Record<string, string> = {
  'TV Wall': 'linear-gradient(135deg, #d4a574 0%, #8b6914 100%)',
  'Bedroom Wall': 'linear-gradient(135deg, #c9b8a8 0%, #7a5c3e 100%)',
  'Living Room': 'linear-gradient(135deg, #e8d5b7 0%, #9a7b4f 100%)',
  'Dining Room': 'linear-gradient(135deg, #d4c4a8 0%, #6b5b3e 100%)',
  'Study Room': 'linear-gradient(135deg, #b8a88c 0%, #5c4a2e 100%)',
};

const DEFAULT_GRADIENT = 'linear-gradient(135deg, #e8d5b7 0%, #c4a882 50%, #9a7b4f 100%)';

/**
 * CategoryCarousel - horizontal scrollable row of room-type category cards
 * derived from unique wall_application values in templates.
 */
export function CategoryCarousel({ templates, activeCategory, onCategorySelect }: CategoryCarouselProps) {
  // Derive unique wall_application values
  const categories = Array.from(
    new Set(
      templates
        .map((t) => t.wall_application)
        .filter((app): app is string => app !== null && app.trim() !== '')
    )
  );

  if (categories.length === 0) return null;

  return (
    <div className="dl-category-carousel" data-testid="category-carousel">
      <h3 className="dl-category-carousel__title">Explore designs for</h3>
      <div className="dl-category-carousel__scroll">
        {categories.map((category) => (
          <div
            key={category}
            className={`dl-category-card${activeCategory === category ? ' dl-category-card--active' : ''}`}
            style={{ background: CATEGORY_GRADIENTS[category] || DEFAULT_GRADIENT }}
            onClick={() => onCategorySelect(activeCategory === category ? null : category)}
            role="button"
            tabIndex={0}
            aria-pressed={activeCategory === category}
            aria-label={`Filter by ${category}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCategorySelect(activeCategory === category ? null : category);
              }
            }}
          >
            <span className="dl-category-card__label">{category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
