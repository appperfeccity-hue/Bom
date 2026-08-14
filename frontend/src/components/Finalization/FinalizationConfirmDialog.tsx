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
    if (!currentProject?.project_id) return;
    const finalizationKey = crypto.randomUUID();
    void confirmFinalization(currentProject.project_id, finalizationKey);
  };

  return (
    <div
      data-testid="finalization-confirm-dialog"
      role="dialog"
      aria-labelledby="finalization-dialog-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
        }}
      >
        <h2
          id="finalization-dialog-title"
          style={{
            margin: '0 0 16px 0',
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--color-error)',
          }}
        >
          Finalize Project
        </h2>

        <p
          data-testid="finalization-warning"
          style={{
            margin: '0 0 16px 0',
            fontSize: '14px',
            color: 'var(--color-ink-primary)',
            lineHeight: '1.5',
          }}
        >
          This action is irreversible. Once finalized, the project BOM cannot be modified.
        </p>

        {error && (
          <p
            data-testid="finalization-error"
            aria-live="assertive"
            style={{
              margin: '0 0 16px 0',
              fontSize: '13px',
              color: 'var(--color-error)',
              backgroundColor: 'rgba(176,65,62,0.08)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
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
              backgroundColor: 'transparent',
              color: 'var(--color-ink-primary)',
              border: '1px solid var(--color-disabled)',
              borderRadius: 'var(--radius-sm)',
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
              backgroundColor: isLoading ? 'rgba(63,107,79,0.6)' : 'var(--color-success)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
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
