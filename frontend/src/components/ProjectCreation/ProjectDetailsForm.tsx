import { useProjectCreationStore, CreationStep } from '@/stores/projectCreationStore';

/**
 * ProjectDetailsForm - collects customerReference and siteReference,
 * then submits to create the project.
 */
export function ProjectDetailsForm() {
  const customerReference = useProjectCreationStore((s) => s.customerReference);
  const siteReference = useProjectCreationStore((s) => s.siteReference);
  const isLoading = useProjectCreationStore((s) => s.isLoading);
  const setCustomerReference = useProjectCreationStore((s) => s.setCustomerReference);
  const setSiteReference = useProjectCreationStore((s) => s.setSiteReference);
  const createProject = useProjectCreationStore((s) => s.createProject);
  const selectedTemplate = useProjectCreationStore((s) => s.selectedTemplate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProject();
  };

  const handleBack = () => {
    useProjectCreationStore.setState({ step: CreationStep.BROWSE_TEMPLATES });
  };

  const isValid = customerReference.trim().length > 0 && siteReference.trim().length > 0;

  return (
    <form
      data-testid="project-details-form"
      onSubmit={handleSubmit}
      style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      {selectedTemplate && (
        <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
          Template: <strong>{selectedTemplate.name}</strong>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '12px', fontWeight: 500, color: '#333' }}>
          Customer Reference *
        </label>
        <input
          data-testid="customer-ref-input"
          type="text"
          value={customerReference}
          onChange={(e) => setCustomerReference(e.target.value)}
          placeholder="Enter customer reference"
          required
          style={{
            padding: '8px 12px',
            fontSize: '13px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '12px', fontWeight: 500, color: '#333' }}>
          Site Reference *
        </label>
        <input
          data-testid="site-ref-input"
          type="text"
          value={siteReference}
          onChange={(e) => setSiteReference(e.target.value)}
          placeholder="Enter site reference"
          required
          style={{
            padding: '8px 12px',
            fontSize: '13px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button
          type="button"
          onClick={handleBack}
          disabled={isLoading}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: 'transparent',
            color: '#666',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          Back
        </button>
        <button
          data-testid="create-project-btn"
          type="submit"
          disabled={!isValid || isLoading}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: isValid && !isLoading ? '#1976d2' : '#bdbdbd',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: isValid && !isLoading ? 'pointer' : 'not-allowed',
          }}
        >
          {isLoading ? 'Creating...' : 'Create Project'}
        </button>
      </div>
    </form>
  );
}
