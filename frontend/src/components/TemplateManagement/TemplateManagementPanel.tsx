import { useEffect } from 'react';
import { useTemplateManagementStore } from '@/stores/templateManagementStore';
import { TemplateFilters } from './TemplateFilters';
import { TemplateListItem } from './TemplateListItem';
import { CreateTemplateDialog } from './CreateTemplateDialog';
import { RetireTemplateDialog } from './RetireTemplateDialog';

export function TemplateManagementPanel() {
  const filteredTemplates = useTemplateManagementStore((s) => s.filteredTemplates);
  const isLoading = useTemplateManagementStore((s) => s.isLoading);
  const error = useTemplateManagementStore((s) => s.error);
  const fetchMyTemplates = useTemplateManagementStore((s) => s.fetchMyTemplates);
  const openCreateDialog = useTemplateManagementStore((s) => s.openCreateDialog);
  const closePanel = useTemplateManagementStore((s) => s.closePanel);
  const showCreateDialog = useTemplateManagementStore((s) => s.showCreateDialog);
  const showRetireDialog = useTemplateManagementStore((s) => s.showRetireDialog);

  useEffect(() => {
    fetchMyTemplates();
  }, [fetchMyTemplates]);

  return (
    <div
      data-testid="template-management-panel"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          width: '90%',
          maxWidth: '900px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid #e0e0e0',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px' }}>My Templates</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              data-testid="create-new-template-btn"
              onClick={openCreateDialog}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                backgroundColor: '#1976d2',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Create New Template
            </button>
            <button
              data-testid="template-panel-close-btn"
              onClick={closePanel}
              style={{
                padding: '4px 10px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: '#f5f5f5',
                cursor: 'pointer',
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Filters */}
        <TemplateFilters />

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {isLoading && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
              Loading templates...
            </div>
          )}

          {error && !isLoading && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#d32f2f' }}>{error}</div>
          )}

          {!isLoading && !error && filteredTemplates.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
              No templates found
            </div>
          )}

          {!isLoading && !error && filteredTemplates.length > 0 && (
            <div>
              {filteredTemplates.map((template) => (
                <TemplateListItem key={template.template_id} template={template} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {showCreateDialog && <CreateTemplateDialog />}
      {showRetireDialog && <RetireTemplateDialog />}
    </div>
  );
}
