import { useDesignLibraryStore } from '@/stores/designLibraryStore';
import { useProjectCreationStore } from '@/stores/projectCreationStore';
import type { TemplateWithAvailability } from '@/stores/designLibraryStore';

/**
 * TemplatePreviewPanel - slide-in side panel showing full template details.
 * Follows the same fixed/right/600px pattern as ProjectCreationWizard.
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
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '600px',
        height: '100vh',
        backgroundColor: 'var(--color-surface)',
        borderLeft: '1px solid var(--color-hairline)',
        boxShadow: 'var(--shadow-panel)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1002,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-hairline)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-ink-primary)' }}>
          Template Preview
        </h3>
        <button
          data-testid="preview-close-btn"
          onClick={clearPreview}
          style={{
            border: 'none',
            background: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: 'var(--color-ink-secondary)',
            lineHeight: 1,
            padding: '4px',
          }}
        >
          &times;
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {/* Name */}
        <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: 'var(--color-ink-primary)' }}>
          {template.name}
        </h2>

        {/* Availability badge */}
        <span
          data-testid="availability-badge"
          style={{
            display: 'inline-block',
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: isBlocked ? 'rgba(176,65,62,0.1)' : 'rgba(63,107,79,0.1)',
            color: isBlocked ? 'var(--color-error)' : 'var(--color-success)',
            marginBottom: '16px',
          }}
        >
          {template.availability}
        </span>

        {/* Description */}
        {template.description && (
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 600, color: 'var(--color-ink-secondary)' }}>
              Description
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-ink-primary)', lineHeight: 1.5 }}>
              {template.description}
            </p>
          </div>
        )}

        {/* Wall Geometry */}
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 600, color: 'var(--color-ink-secondary)' }}>
            Wall Geometry
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-ink-primary)' }}>
            {template.wall_geometry.type} - {template.wall_geometry.base_width_mm} x {template.wall_geometry.base_height_mm} mm
          </p>
        </div>

        {/* Adaptation Strategy */}
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 600, color: 'var(--color-ink-secondary)' }}>
            Adaptation Strategy
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-ink-primary)' }}>
            {template.adaptation_strategy}
          </p>
        </div>

        {/* Design Family */}
        {template.designFamilyName && (
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 600, color: 'var(--color-ink-secondary)' }}>
              Design Family
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-ink-primary)' }}>
              {template.designFamilyName}
            </p>
          </div>
        )}

        {/* Blocked reasons */}
        {isBlocked && template.blockedReasons.length > 0 && (
          <div
            data-testid="blocked-reasons"
            style={{
              padding: '12px',
              backgroundColor: 'rgba(176,65,62,0.05)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px',
            }}
          >
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 600, color: 'var(--color-error)' }}>
              Blocked Reasons
            </h4>
            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--color-error)' }}>
              {template.blockedReasons.map((reason, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer with action */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--color-hairline)',
        }}
      >
        <button
          data-testid="preview-select-btn"
          onClick={handleSelect}
          disabled={isBlocked}
          style={{
            width: '100%',
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: 600,
            backgroundColor: isBlocked ? 'var(--color-disabled)' : 'var(--color-accent)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: isBlocked ? 'not-allowed' : 'pointer',
            opacity: isBlocked ? 0.6 : 1,
          }}
        >
          Select Template
        </button>
      </div>
    </div>
  );
}
