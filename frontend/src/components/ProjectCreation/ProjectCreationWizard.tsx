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
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-ink-secondary)' }}>
            Creating project...
          </div>
        );

      case CreationStep.CREATED:
        return (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-success)', marginBottom: '8px' }}>
              Project created successfully!
            </div>
            <button
              onClick={reset}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500,
                backgroundColor: 'var(--color-accent)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
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
                backgroundColor: 'rgba(176,65,62,0.08)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '12px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-error)', marginBottom: '4px' }}>
                Error
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-error)' }}>
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
                    backgroundColor: 'var(--color-accent)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
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
                  color: 'var(--color-ink-secondary)',
                  border: '1px solid var(--color-disabled)',
                  borderRadius: 'var(--radius-sm)',
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
        backgroundColor: 'var(--color-surface)',
        borderLeft: '1px solid var(--color-hairline)',
        boxShadow: 'var(--shadow-panel)',
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
          borderBottom: '1px solid var(--color-hairline)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-ink-primary)' }}>
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
            color: 'var(--color-ink-secondary)',
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
