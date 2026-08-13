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
        borderBottom: '1px solid #e0e0e0',
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
                backgroundColor: '#fff3e0',
                color: '#e65100',
                border: '1px solid #ffcc80',
              }}
            >
              BLOCKED
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#666' }}>
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
                backgroundColor: '#e3f2fd',
                border: '1px solid #90caf9',
                borderRadius: '4px',
                cursor: 'pointer',
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
                backgroundColor: '#fff3e0',
                border: '1px solid #ffcc80',
                borderRadius: '4px',
                cursor: 'pointer',
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
                backgroundColor: '#e8f5e9',
                border: '1px solid #a5d6a7',
                borderRadius: '4px',
                cursor: 'pointer',
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
                backgroundColor: '#fff3e0',
                border: '1px solid #ffcc80',
                borderRadius: '4px',
                cursor: 'pointer',
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
                backgroundColor: '#f5f5f5',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                cursor: 'pointer',
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
                backgroundColor: '#e8f5e9',
                border: '1px solid #a5d6a7',
                borderRadius: '4px',
                cursor: 'pointer',
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
                backgroundColor: '#f5f5f5',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                cursor: 'pointer',
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
