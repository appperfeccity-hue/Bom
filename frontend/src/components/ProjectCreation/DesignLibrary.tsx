import { useEffect } from 'react';
import { useProjectCreationStore } from '@/stores/projectCreationStore';
import { TemplateCard } from './TemplateCard';

/**
 * DesignLibrary - template gallery component that displays ACTIVE templates
 * in a grid layout. Calls fetchAvailableTemplates() on mount.
 */
export function DesignLibrary() {
  const availableTemplates = useProjectCreationStore((s) => s.availableTemplates);
  const isLoading = useProjectCreationStore((s) => s.isLoading);
  const error = useProjectCreationStore((s) => s.error);
  const fetchAvailableTemplates = useProjectCreationStore((s) => s.fetchAvailableTemplates);
  const selectTemplate = useProjectCreationStore((s) => s.selectTemplate);

  useEffect(() => {
    fetchAvailableTemplates();
  }, [fetchAvailableTemplates]);

  if (isLoading) {
    return (
      <div data-testid="design-library" style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
        Loading templates...
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="design-library" style={{ padding: '24px' }}>
        <div
          style={{
            padding: '12px',
            backgroundColor: '#fbe9e7',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#c62828',
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  if (availableTemplates.length === 0) {
    return (
      <div data-testid="design-library" style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
        No templates available
      </div>
    );
  }

  return (
    <div
      data-testid="design-library"
      style={{
        padding: '16px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: '16px',
      }}
    >
      {availableTemplates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          onSelect={selectTemplate}
        />
      ))}
    </div>
  );
}
