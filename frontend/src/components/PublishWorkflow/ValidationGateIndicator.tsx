import { usePublishStore } from '@/stores/publishStore';

/**
 * Visual badge indicator for the publish validation gate.
 * Shows a red badge when any validation gate has failed,
 * and a green badge when all gates pass.
 * Only visible when there are validation results to display.
 */
export function ValidationGateIndicator() {
  const validationResults = usePublishStore((s) => s.validationResults);

  if (validationResults.length === 0) return null;

  const allPassed = validationResults.every((r) => r.passed);
  const failedCount = validationResults.filter((r) => !r.passed).length;

  return (
    <span
      data-testid="publish-gate-indicator"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '20px',
        height: '20px',
        borderRadius: '10px',
        padding: '0 6px',
        fontSize: '11px',
        fontWeight: 600,
        color: '#ffffff',
        backgroundColor: allPassed ? 'var(--color-success)' : 'var(--color-error)',
        marginLeft: '8px',
      }}
    >
      {allPassed ? '\u2713' : failedCount}
    </span>
  );
}
