import { useProjectCreationStore, CreationStep } from '@/stores/projectCreationStore';
import { DesignLibrary } from './DesignLibrary';
import { ProjectDetailsForm } from './ProjectDetailsForm';

/**
 * ProjectCreationWizard - modal overlay for the multi-step project creation flow.
 * Reads currentStep from the store and renders the appropriate step content.
 */
export function ProjectCreationWizard() {
  const step = useProjectCreationStore((s) => s.step);
  const error = useProjectCreationStore((s) => s.error);
  const isLoading = useProjectCreationStore((s) => s.isLoading);
  const createdProjectId = useProjectCreationStore((s) => s.createdProjectId);
  const reset = useProjectCreationStore((s) => s.reset);

  if (step === CreationStep.IDLE) return null;

  const handleRetry = () => {
    useProjectCreationStore.setState({ step: CreationStep.BROWSE_TEMPLATES, error: null });
  };

  const renderContent = () => {
    switch (step) {
      case CreationStep.BROWSE_TEMPLATES:
        return <DesignLibrary />;

      case CreationStep.PROJECT_DETAILS:
        return <ProjectDetailsForm />;

      case CreationStep.CREATING:
        return (
          <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
            Creating project...
          </div>
        );

      case CreationStep.CREATED:
        return (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#2e7d32', marginBottom: '8px' }}>
              Project created successfully!
            </div>
            <button
              onClick={reset}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500,
                backgroundColor: '#1976d2',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        );

      case CreationStep.ERROR:
        return (
          <div style={{ padding: '16px' }}>
            <div
              style={{
                padding: '12px',
                backgroundColor: '#fbe9e7',
                borderRadius: '4px',
                marginBottom: '12px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#c62828', marginBottom: '4px' }}>
                Error
              </div>
              <div style={{ fontSize: '12px', color: '#d32f2f' }}>
                {error}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {!createdProjectId && (
                <button
                  onClick={handleRetry}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    backgroundColor: '#1976d2',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              )}
              <button
                onClick={reset}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  backgroundColor: 'transparent',
                  color: '#666',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      data-testid="project-creation-wizard"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '600px',
        height: '100vh',
        backgroundColor: '#ffffff',
        borderLeft: '1px solid #e0e0e0',
        boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1001,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
          New Project
        </h3>
        <button
          onClick={reset}
          disabled={isLoading}
          style={{
            border: 'none',
            background: 'none',
            fontSize: '20px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            color: '#666',
            lineHeight: 1,
            padding: '4px',
          }}
          data-testid="project-creation-close-btn"
        >
          &times;
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderContent()}
      </div>
    </div>
  );
}
