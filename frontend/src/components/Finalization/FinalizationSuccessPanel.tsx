import { useFinalizationStore, FinalizationStep } from '@/stores/finalizationStore';

/**
 * Success panel showing the final BOM hash, finalized timestamp,
 * and a close button. Rendered when finalizationStep is SUCCESS.
 */
export function FinalizationSuccessPanel() {
  const finalizationStep = useFinalizationStore((s) => s.finalizationStep);
  const finalBomHash = useFinalizationStore((s) => s.finalBomHash);
  const finalizedAt = useFinalizationStore((s) => s.finalizedAt);
  const finalBomId = useFinalizationStore((s) => s.finalBomId);
  const reset = useFinalizationStore((s) => s.reset);

  if (finalizationStep !== FinalizationStep.SUCCESS) {
    return null;
  }

  return (
    <div
      data-testid="finalization-success-panel"
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
          textAlign: 'center',
        }}
      >
        {/* Success icon */}
        <div
          data-testid="finalization-success-icon"
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'rgba(63,107,79,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '24px',
          }}
        >
          ✓
        </div>

        <h2
          style={{
            margin: '0 0 8px 0',
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--color-success)',
          }}
        >
          Project Finalized
        </h2>

        <p
          style={{
            margin: '0 0 16px 0',
            fontSize: '14px',
            color: 'var(--color-ink-secondary)',
          }}
        >
          The project has been successfully finalized. The BOM is now immutable.
        </p>

        <div
          style={{
            backgroundColor: 'var(--color-canvas)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px',
            marginBottom: '16px',
            textAlign: 'left',
          }}
        >
          <div style={{ marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-ink-secondary)', display: 'block' }}>
              Final BOM ID
            </span>
            <span
              data-testid="finalization-bom-id"
              style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-primary)' }}
            >
              {finalBomId}
            </span>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-ink-secondary)', display: 'block' }}>
              Final BOM Hash
            </span>
            <span
              data-testid="finalization-bom-hash"
              style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-primary)' }}
            >
              {finalBomHash}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--color-ink-secondary)', display: 'block' }}>
              Finalized At
            </span>
            <span
              data-testid="finalization-timestamp"
              style={{ fontSize: '13px', color: 'var(--color-ink-primary)' }}
            >
              {finalizedAt}
            </span>
          </div>
        </div>

        <button
          onClick={reset}
          data-testid="finalization-close-btn"
          style={{
            padding: '8px 24px',
            fontSize: '14px',
            fontWeight: 600,
            backgroundColor: 'var(--color-success)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
