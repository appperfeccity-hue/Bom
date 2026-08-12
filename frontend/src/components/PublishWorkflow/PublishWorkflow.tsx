import { usePublishStore, PublishStep } from '@/stores/publishStore';
import { StepIndicator } from './StepIndicator';
import { ValidationResultsPanel } from './ValidationResultsPanel';
import { ApprovalStep } from './ApprovalStep';
import { PublishConfirmation } from './PublishConfirmation';

/**
 * PublishWorkflow - a fixed overlay panel (similar to BomPanel) that
 * displays the 4-step template publishing wizard.
 * Shows when publishStore.currentStep !== IDLE.
 */
export function PublishWorkflow() {
  const currentStep = usePublishStore((s) => s.currentStep);
  const isLoading = usePublishStore((s) => s.isLoading);
  const error = usePublishStore((s) => s.error);
  const reset = usePublishStore((s) => s.reset);

  if (currentStep === PublishStep.IDLE) return null;

  const renderContent = () => {
    switch (currentStep) {
      case PublishStep.VALIDATING:
        return (
          <div style={{ padding: '16px', color: '#666' }}>
            Running validation checks...
          </div>
        );

      case PublishStep.VALIDATION_RESULTS:
        return <ValidationResultsPanel />;

      case PublishStep.GENERATING_BOM:
        return (
          <div style={{ padding: '16px', color: '#666' }}>
            Generating Master BOM...
          </div>
        );

      case PublishStep.BOM_GENERATED:
      case PublishStep.APPROVING_BOM:
        return <ApprovalStep />;

      case PublishStep.BOM_APPROVED:
      case PublishStep.PUBLISHING:
      case PublishStep.PUBLISHED:
        return <PublishConfirmation />;

      case PublishStep.ERROR:
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
        );

      default:
        return null;
    }
  };

  return (
    <div
      data-testid="publish-workflow-panel"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '520px',
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
          Publish Template
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
          data-testid="publish-workflow-close-btn"
        >
          &times;
        </button>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderContent()}
      </div>
    </div>
  );
}
