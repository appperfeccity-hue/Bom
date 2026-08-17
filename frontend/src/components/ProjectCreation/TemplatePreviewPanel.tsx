import { useDesignLibraryStore } from '@/stores/designLibraryStore';
import { useProjectCreationStore } from '@/stores/projectCreationStore';
import type { TemplateWithAvailability } from '@/stores/designLibraryStore';

/**
 * TemplatePreviewPanel - slide-in side panel showing full template details.
 * Redesigned with premium aesthetic, larger preview image, warmer typography.
 */
export function TemplatePreviewPanel() {
  const selectedTemplateDetail = useDesignLibraryStore((s) => s.selectedTemplateDetail);
  const clearPreview = useDesignLibraryStore((s) => s.clearPreview);
  const selectTemplate = useProjectCreationStore((s) => s.selectTemplate);

  if (!selectedTemplateDetail) return null;

  const template: TemplateWithAvailability = selectedTemplateDetail;
  const isBlocked = template.availability === 'BLOCKED';

  const handleSelect = () => {
    selectTemplate(template);
    clearPreview();
  };

  return (
    <div
      data-testid="template-preview-panel"
      className="dl-preview-panel"
    >
      {/* Header */}
      <div className="dl-preview-panel__header">
        <h3 className="dl-preview-panel__title">Template Preview</h3>
        <button
          data-testid="preview-close-btn"
          className="dl-preview-panel__close"
          onClick={clearPreview}
        >
          &times;
        </button>
      </div>

      {/* Preview image area */}
      <div className="dl-preview-panel__image">
        <span style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-ink-secondary)', opacity: 0.4 }}>
          Preview
        </span>
      </div>

      {/* Content */}
      <div className="dl-preview-panel__content">
        {/* Name */}
        <h2 className="dl-preview-panel__name">
          {template.name}
        </h2>

        {/* Availability badge */}
        <span
          data-testid="availability-badge"
          style={{
            display: 'inline-block',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: isBlocked ? 'rgba(176,65,62,0.1)' : 'rgba(63,107,79,0.1)',
            color: isBlocked ? 'var(--color-error)' : 'var(--color-success)',
            marginBottom: 'var(--space-4)',
          }}
        >
          {template.availability}
        </span>

        {/* Description */}
        {template.description && (
          <div className="dl-preview-panel__section">
            <h4 className="dl-preview-panel__section-title">Description</h4>
            <p className="dl-preview-panel__section-text">{template.description}</p>
          </div>
        )}

        {/* Wall Geometry */}
        <div className="dl-preview-panel__section">
          <h4 className="dl-preview-panel__section-title">Wall Geometry</h4>
          <p className="dl-preview-panel__section-text">
            {template.wall_geometry.type} - {template.wall_geometry.base_width_mm} x {template.wall_geometry.base_height_mm} mm
          </p>
        </div>

        {/* Adaptation Strategy */}
        <div className="dl-preview-panel__section">
          <h4 className="dl-preview-panel__section-title">Adaptation Strategy</h4>
          <p className="dl-preview-panel__section-text">{template.adaptation_strategy}</p>
        </div>

        {/* Design Family */}
        {template.designFamilyName && (
          <div className="dl-preview-panel__section">
            <h4 className="dl-preview-panel__section-title">Design Family</h4>
            <p className="dl-preview-panel__section-text">{template.designFamilyName}</p>
          </div>
        )}

        {/* Blocked reasons */}
        {isBlocked && template.blockedReasons.length > 0 && (
          <div
            data-testid="blocked-reasons"
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'rgba(176,65,62,0.05)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <h4 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-error)' }}>
              Blocked Reasons
            </h4>
            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: 'var(--text-sm)', color: 'var(--color-error)' }}>
              {template.blockedReasons.map((reason, idx) => (
                <li key={idx} style={{ marginBottom: 'var(--space-1)' }}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer with action */}
      <div className="dl-preview-panel__footer">
        <button
          data-testid="preview-select-btn"
          className="dl-preview-panel__select-btn"
          onClick={handleSelect}
          disabled={isBlocked}
        >
          Select Template
        </button>
      </div>
    </div>
  );
}
