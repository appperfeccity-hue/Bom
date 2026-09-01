import { useState } from 'react';
import type { TemplateWithAvailability } from '@/stores/designLibraryStore';

interface EnhancedTemplateCardProps {
  template: TemplateWithAvailability;
  onSelect: (template: TemplateWithAvailability) => void;
  onPreview: (template: TemplateWithAvailability) => void;
}

/**
 * EnhancedTemplateCard - image-first large card with tall aspect ratio,
 * heart/favorite toggle, availability indicator, and premium aesthetics.
 * Preserves all data-testid attributes for test compatibility.
 */
export function EnhancedTemplateCard({ template, onSelect, onPreview }: EnhancedTemplateCardProps) {
  // NOTE: isFavorited is intentionally ephemeral component-local state (cosmetic only).
  // It resets on unmount and is not persisted to any backend or store. This is by design
  // for the current UI redesign -- no backend favorites persistence is required at this stage.
  // When a favorites feature with persistence is implemented, this should be lifted to a
  // dedicated favorites store or backed by a Supabase table.
  const [isFavorited, setIsFavorited] = useState(false);
  const isBlocked = template.availability === 'BLOCKED';

  const truncatedDescription =
    template.description && template.description.length > 100
      ? template.description.slice(0, 100) + '...'
      : template.description;

  // Extract price from metadata if available
  const price = template.metadata && typeof template.metadata === 'object' && 'price' in template.metadata
    ? (template.metadata as Record<string, unknown>).price
    : null;

  return (
    <div
      data-testid="template-card"
      className="dl-template-card"
      style={{ opacity: isBlocked ? 0.8 : 1 }}
    >
      {/* Image area with gradient placeholder */}
      <div className="dl-template-card__image">
        {/* Heart/favorite button */}
        <button
          className={`dl-template-card__favorite${isFavorited ? ' dl-template-card__favorite--active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setIsFavorited(!isFavorited);
          }}
          aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorited ? '\u2764' : '\u2661'}
        </button>

        {/* Availability dot indicator */}
        <span
          data-testid="availability-badge"
          className={`dl-template-card__availability-dot ${
            isBlocked
              ? 'dl-template-card__availability-dot--blocked'
              : 'dl-template-card__availability-dot--available'
          }`}
          title={template.availability}
          aria-label={template.availability}
        >
          <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
            {template.availability}
          </span>
        </span>
      </div>

      {/* Card body */}
      <div className="dl-template-card__body">
        <h4 className="dl-template-card__name">{template.name}</h4>

        {template.designFamilyName && (
          <p className="dl-template-card__family">{template.designFamilyName}</p>
        )}

        {truncatedDescription && (
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', lineHeight: 1.4 }}>
            {truncatedDescription}
          </p>
        )}

        {/* Geometry and dimensions */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(154,123,79,0.1)',
              color: 'var(--color-accent)',
            }}
          >
            {template.wall_geometry.type}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)' }}>
            {template.wall_geometry.base_width_mm} x {template.wall_geometry.base_height_mm} mm
          </span>
        </div>

        {/* Price indicator */}
        <p className="dl-template-card__price">
          {price != null ? `\u20B9${price}` : 'Price on request'}
        </p>
      </div>

      {/* Blocked reasons */}
      {isBlocked && template.blockedReasons.length > 0 && (
        <div
          data-testid="blocked-reasons"
          style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(176,65,62,0.05)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            color: 'var(--color-error)',
            margin: '0 12px',
          }}
        >
          <ul style={{ margin: 0, paddingLeft: '16px' }}>
            {template.blockedReasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="dl-template-card__actions">
        <button
          data-testid="template-select-btn"
          className="dl-template-card__btn-select"
          onClick={() => onSelect(template)}
          disabled={isBlocked}
        >
          Select
        </button>
        <button
          data-testid="template-preview-btn"
          className="dl-template-card__btn-preview"
          onClick={() => onPreview(template)}
        >
          Preview
        </button>
      </div>
    </div>
  );
}
