import { useBomStore } from '@/stores/bomStore';
import type { PipelineError } from '@/engines/errorCatalogue';

/**
 * Panel that displays BOM pipeline validation results.
 * Shows blocking errors (red) and warnings (yellow) with error codes.
 * Hidden when pipeline status is 'idle'.
 */
export function ValidationResultsPanel() {
  const pipelineStatus = useBomStore((s) => s.pipelineStatus);
  const pipelineErrors = useBomStore((s) => s.pipelineErrors);
  const pipelineWarnings = useBomStore((s) => s.pipelineWarnings);
  const storeError = useBomStore((s) => s.error);

  if (pipelineStatus === 'idle' || pipelineStatus === 'running') {
    return null;
  }

  const statusBadge = pipelineStatus === 'success'
    ? { text: 'SUCCESS', backgroundColor: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7' }
    : { text: 'BLOCKED', backgroundColor: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a' };

  return (
    <div
      data-testid="validation-results-panel"
      style={{
        padding: '12px 16px',
        borderRadius: '6px',
        border: '1px solid #e0e0e0',
        backgroundColor: '#fafafa',
        marginTop: '8px',
      }}
    >
      {/* Status badge */}
      <div style={{ marginBottom: '12px' }}>
        <span
          data-testid="pipeline-status-badge"
          style={{
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: statusBadge.backgroundColor,
            color: statusBadge.color,
            border: statusBadge.border,
          }}
        >
          {statusBadge.text}
        </span>
      </div>

      {/* Blocking errors */}
      {pipelineErrors.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#c62828', marginBottom: '4px' }}>
            Blocking Errors ({pipelineErrors.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: '16px' }}>
            {pipelineErrors.map((error: PipelineError, idx: number) => (
              <li
                key={`error-${idx}`}
                data-testid="pipeline-error-item"
                style={{ color: '#c62828', fontSize: '12px', marginBottom: '2px' }}
              >
                [{error.code}] {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {pipelineWarnings.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#f57f17', marginBottom: '4px' }}>
            Warnings ({pipelineWarnings.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: '16px' }}>
            {pipelineWarnings.map((warning: PipelineError, idx: number) => (
              <li
                key={`warning-${idx}`}
                data-testid="pipeline-warning-item"
                style={{ color: '#f57f17', fontSize: '12px', marginBottom: '2px' }}
              >
                [{warning.code}] {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Store-level error (when pipeline errors are empty but a fetch error occurred) */}
      {pipelineErrors.length === 0 && storeError && pipelineStatus === 'blocked' && (
        <div data-testid="pipeline-fetch-error" style={{ marginTop: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#c62828', marginBottom: '4px' }}>
            Error
          </div>
          <div style={{ color: '#c62828', fontSize: '12px' }}>
            {storeError}
          </div>
        </div>
      )}
    </div>
  );
}
