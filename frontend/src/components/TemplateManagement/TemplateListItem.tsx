import type { Template } from '@/types/database';
import { TemplateStatus } from '@/types/database';
import { TemplateStatusBadge } from './TemplateStatusBadge';
import { useTemplateManagementStore } from '@/stores/templateManagementStore';

interface TemplateListItemProps {
  template: Template;
  hasInactiveSkus?: boolean;
}

export function TemplateListItem({ template, hasInactiveSkus }: TemplateListItemProps) {
  const editTemplate = useTemplateManagementStore((s) => s.editTemplate);
  const duplicateAsNewDraft = useTemplateManagementStore((s) => s.duplicateAsNewDraft);
  const openRetireDialog = useTemplateManagementStore((s) => s.openRetireDialog);

  const formattedDate = new Date(template.updated_at).toLocaleDateString();

  return (
    <div
      data-testid="template-list-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-hairline)',
        gap: '16px',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>{template.name}</span>
          <TemplateStatusBadge status={template.status} />
          {hasInactiveSkus && (
            <span
              data-testid="sku-inactive-badge"
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: 'rgba(176,65,62,0.08)',
                color: 'var(--color-error)',
                border: '1px solid var(--color-error)',
              }}
            >
              BLOCKED
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--color-ink-secondary)' }}>
          <span>{template.wall_geometry.type}</span>
          <span>{template.wall_geometry.base_width_mm} x {template.wall_geometry.base_height_mm} mm</span>
          <span>Updated: {formattedDate}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {template.status === TemplateStatus.DRAFT && (
          <>
            <button
              data-testid="template-edit-btn"
              onClick={() => editTemplate(template.template_id)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-disabled)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: 'var(--color-ink-primary)',
              }}
            >
              Edit
            </button>
            <button
              data-testid="template-archive-btn"
              onClick={() => openRetireDialog(template)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                backgroundColor: 'rgba(166,106,45,0.1)',
                border: '1px solid var(--color-warning)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: 'var(--color-warning)',
              }}
            >
              Archive
            </button>
          </>
        )}

        {template.status === TemplateStatus.ACTIVE && (
          <>
            <button
              data-testid="template-duplicate-btn"
              onClick={() => duplicateAsNewDraft(template.template_id)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                backgroundColor: 'var(--color-accent)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: '#ffffff',
              }}
            >
              Create Draft Copy
            </button>
            <button
              data-testid="template-retire-btn"
              onClick={() => openRetireDialog(template)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                backgroundColor: 'rgba(166,106,45,0.1)',
                border: '1px solid var(--color-warning)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: 'var(--color-warning)',
              }}
            >
              Retire
            </button>
            <button
              data-testid="template-view-btn"
              onClick={() => editTemplate(template.template_id)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-disabled)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: 'var(--color-ink-primary)',
              }}
            >
              View
            </button>
          </>
        )}

        {template.status === TemplateStatus.RETIRED && (
          <>
            <button
              data-testid="template-duplicate-btn"
              onClick={() => duplicateAsNewDraft(template.template_id)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                backgroundColor: 'var(--color-accent)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: '#ffffff',
              }}
            >
              Create Draft Copy
            </button>
            <button
              data-testid="template-view-btn"
              onClick={() => editTemplate(template.template_id)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-disabled)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: 'var(--color-ink-primary)',
              }}
            >
              View
            </button>
          </>
        )}
      </div>
    </div>
  );
}
