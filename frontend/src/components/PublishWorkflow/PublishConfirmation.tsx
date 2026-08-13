import { usePublishStore, PublishStep } from '@/stores/publishStore';
import { useProjectStore } from '@/stores/projectStore';

export function PublishConfirmation() {
  const currentStep = usePublishStore((s) => s.currentStep);
  const error = usePublishStore((s) => s.error);
  const isLoading = usePublishStore((s) => s.isLoading);
  const publishTemplate = usePublishStore((s) => s.publishTemplate);
  const reset = usePublishStore((s) => s.reset);
  const currentTemplate = useProjectStore((s) => s.currentTemplate);

  const isPublished = currentStep === PublishStep.PUBLISHED;
  const isError = currentStep === PublishStep.ERROR;

  const handlePublish = () => {
    if (currentTemplate) {
      void publishTemplate(currentTemplate.template_id);
    }
  };

  const handleRetry = () => {
    if (currentTemplate) {
      void publishTemplate(currentTemplate.template_id);
    }
  };

  return (
    <div data-testid="publish-confirmation" style={{ padding: '16px' }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>
        Publish Template
      </h4>

      {isPublished && (
        <div
          style={{
            padding: '16px',
            backgroundColor: '#e8f5e9',
            borderRadius: '4px',
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#2e7d32', marginBottom: '4px' }}>
            {'\u2713'} Template Published Successfully
          </div>
          <div style={{ fontSize: '13px', color: '#388e3c' }}>
            {currentTemplate?.name} is now active and available for projects.
          </div>
        </div>
      )}

      {isError && (
        <div
          style={{
            padding: '16px',
            backgroundColor: '#fbe9e7',
            borderRadius: '4px',
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#c62828', marginBottom: '4px' }}>
            Publish Failed
          </div>
          <div style={{ fontSize: '12px', color: '#d32f2f', marginBottom: '12px' }}>
            {error}
          </div>
          <button
            onClick={handleRetry}
            data-testid="publish-retry-btn"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#f44336',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Retry Publish
          </button>
        </div>
      )}

      {!isPublished && !isError && (
        <>
          <div
            style={{
              padding: '12px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '13px',
            }}
          >
            <div style={{ marginBottom: '4px' }}>
              <strong>Template:</strong> {currentTemplate?.name}
            </div>
            <div style={{ color: '#666' }}>
              Publishing will set this template to ACTIVE status. It will be available for use in new projects.
            </div>
          </div>

          <button
            onClick={handlePublish}
            disabled={isLoading}
            data-testid="publish-template-confirm-btn"
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: '#7b1fa2',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? 'Publishing...' : 'Publish Template'}
          </button>
        </>
      )}

      {isPublished && (
        <button
          onClick={reset}
          data-testid="publish-close-btn"
          style={{
            padding: '8px 16px',
            fontSize: '13px',
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
      )}
    </div>
  );
}
