import type { TemplateWithAvailability } from '@/stores/designLibraryStore';

interface EnhancedTemplateCardProps {
  template: TemplateWithAvailability;
  onSelect: (template: TemplateWithAvailability) => void;
  onPreview: (template: TemplateWithAvailability) => void;
}

/**
 * EnhancedTemplateCard - displays a template with availability info,
 * blocked reasons, and preview/select actions.
 */
export function EnhancedTemplateCard({ template, onSelect, onPreview }: EnhancedTemplateCardProps) {
  const isBlocked = template.availability === 'BLOCKED';
  const truncatedDescription =
    template.description && template.description.length > 100
      ? template.description.slice(0, 100) + '...'
      : template.description;

  return (
    <div
      data-testid="template-card"
      style={{
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        backgroundColor: 'var(--color-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        opacity: isBlocked ? 0.8 : 1,
      }}
    >
      {/* Header with name and availability badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--color-ink-primary)' }}>
          {template.name}
        </h4>
        <span
          data-testid="availability-badge"
          style={{
            fontSize: '10px',
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: isBlocked ? 'rgba(176,65,62,0.1)' : 'rgba(63,107,79,0.1)',
            color: isBlocked ? 'var(--color-error)' : 'var(--color-success)',
          }}
        >
          {template.availability}
        </span>
      </div>

      {/* Description */}
      {truncatedDescription && (
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-ink-secondary)', lineHeight: 1.4 }}>
          {truncatedDescription}
        </p>
      )}

      {/* Geometry and dimensions */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
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
          {template.wall_geometry.type}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--color-ink-secondary)' }}>
          {template.wall_geometry.base_width_mm} x {template.wall_geometry.base_height_mm} mm
        </span>
      </div>

      {/* Design family label */}
      {template.designFamilyName && (
        <span style={{ fontSize: '11px', color: 'var(--color-ink-secondary)', fontStyle: 'italic' }}>
          {template.designFamilyName}
        </span>
      )}

      {/* Blocked reasons */}
      {isBlocked && template.blockedReasons.length > 0 && (
        <div
          data-testid="blocked-reasons"
          style={{
            padding: '8px',
            backgroundColor: 'rgba(176,65,62,0.05)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            color: 'var(--color-error)',
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
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button
          data-testid="template-select-btn"
          onClick={() => onSelect(template)}
          disabled={isBlocked}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 500,
            backgroundColor: isBlocked ? 'var(--color-disabled)' : 'var(--color-accent)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: isBlocked ? 'not-allowed' : 'pointer',
            opacity: isBlocked ? 0.6 : 1,
          }}
        >
          Select
        </button>
        <button
          data-testid="template-preview-btn"
          onClick={() => onPreview(template)}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 500,
            backgroundColor: 'transparent',
            color: 'var(--color-ink-secondary)',
            border: '1px solid var(--color-disabled)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
          }}
        >
          Preview
        </button>
      </div>
    </div>
  );
}
