import { usePublishStore, PublishStep } from '@/stores/publishStore';
import { StepIndicator } from './StepIndicator';
import { ValidationResultsPanel } from './ValidationResultsPanel';
import { ValidationGateIndicator } from './ValidationGateIndicator';
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
          <div style={{ padding: '16px', color: 'var(--color-ink-secondary)' }}>
            Running validation checks...
          </div>
        );

      case PublishStep.VALIDATION_RESULTS:
        return <ValidationResultsPanel />;

      case PublishStep.GENERATING_BOM:
        return (
          <div style={{ padding: '16px', color: 'var(--color-ink-secondary)' }}>
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
            color: 'var(--color-ink-secondary)',
            lineHeight: 1,
            padding: '4px',
          }}
          data-testid="publish-workflow-close-btn"
        >
          &times;
        </button>
      </div>

      {/* Step Indicator */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <StepIndicator currentStep={currentStep} />
        </div>
        <ValidationGateIndicator />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderContent()}
      </div>
    </div>
  );
}
