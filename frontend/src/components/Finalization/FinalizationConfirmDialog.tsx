import { useFinalizationStore, FinalizationStep } from '@/stores/finalizationStore';
import { useProjectStore } from '@/stores/projectStore';

/**
 * Modal overlay with irreversibility warning.
 * Shown when finalizationStep is CONFIRMING or FINALIZING.
 */
export function FinalizationConfirmDialog() {
  const finalizationStep = useFinalizationStore((s) => s.finalizationStep);
  const confirmFinalization = useFinalizationStore((s) => s.confirmFinalization);
  const cancelFinalization = useFinalizationStore((s) => s.cancelFinalization);
  const isLoading = useFinalizationStore((s) => s.isLoading);
  const error = useFinalizationStore((s) => s.error);
  const currentProject = useProjectStore((s) => s.currentProject);

  if (finalizationStep !== FinalizationStep.CONFIRMING && finalizationStep !== FinalizationStep.FINALIZING && finalizationStep !== FinalizationStep.ERROR) {
    return null;
  }

  const handleConfirm = () => {
    if (!currentProject?.id) return;
    const finalizationKey = crypto.randomUUID();
    void confirmFinalization(currentProject.id, finalizationKey);
  };

  return (
    <div
      data-testid="finalization-confirm-dialog"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
        }}
      >
        <h2
          style={{
            margin: '0 0 16px 0',
            fontSize: '18px',
            fontWeight: 600,
            color: '#d32f2f',
          }}
        >
          Finalize Project
        </h2>

        <p
          data-testid="finalization-warning"
          style={{
            margin: '0 0 16px 0',
            fontSize: '14px',
            color: '#424242',
            lineHeight: '1.5',
          }}
        >
          This action is irreversible. Once finalized, the project BOM cannot be modified.
        </p>

        {error && (
          <p
            data-testid="finalization-error"
            style={{
              margin: '0 0 16px 0',
              fontSize: '13px',
              color: '#d32f2f',
              backgroundColor: '#ffebee',
              padding: '8px 12px',
              borderRadius: '4px',
            }}
          >
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={cancelFinalization}
            disabled={isLoading}
            data-testid="finalization-cancel-btn"
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              backgroundColor: '#f5f5f5',
              color: '#424242',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            data-testid="finalization-confirm-btn"
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 600,
              backgroundColor: isLoading ? '#a5d6a7' : '#2e7d32',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Finalizing...' : 'Confirm Finalization'}
          </button>
        </div>
      </div>
    </div>
  );
}
