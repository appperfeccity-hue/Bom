import { useTemplateManagementStore } from '@/stores/templateManagementStore';

export function RetireTemplateDialog() {
  const selectedTemplate = useTemplateManagementStore((s) => s.selectedTemplateForAction);
  const retireTemplate = useTemplateManagementStore((s) => s.retireTemplate);
  const closeRetireDialog = useTemplateManagementStore((s) => s.closeRetireDialog);

  if (!selectedTemplate) return null;

  return (
    <div
      data-testid="retire-template-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: 1100,
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          maxWidth: '480px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <h3 style={{ margin: 0, color: 'var(--color-ink-primary)' }}>Retire Template</h3>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-ink-primary)' }}>
          Are you sure you want to retire <strong>{selectedTemplate.name}</strong>? Existing
          projects using this template will not be affected.
        </p>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            data-testid="retire-template-cancel-btn"
            onClick={closeRetireDialog}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              border: '1px solid var(--color-disabled)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: 'var(--color-ink-primary)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="retire-template-confirm-btn"
            onClick={() => retireTemplate(selectedTemplate.template_id)}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-warning)',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Retire
          </button>
        </div>
      </div>
    </div>
  );
}
