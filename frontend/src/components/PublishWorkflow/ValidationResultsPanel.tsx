import { usePublishStore } from '@/stores/publishStore';
import { useProjectStore } from '@/stores/projectStore';

export function ValidationResultsPanel() {
  const validationResults = usePublishStore((s) => s.validationResults);
  const generateMasterBom = usePublishStore((s) => s.generateMasterBom);
  const rerunValidation = usePublishStore((s) => s.rerunValidation);
  const isLoading = usePublishStore((s) => s.isLoading);
  const currentTemplate = useProjectStore((s) => s.currentTemplate);

  const allPassed = validationResults.every((r) => r.passed);

  const handleGenerateBom = () => {
    if (currentTemplate) {
      void generateMasterBom(currentTemplate.template_id);
    }
  };

  const handleRerunValidation = () => {
    if (currentTemplate) {
      void rerunValidation(currentTemplate.template_id);
    }
  };

  return (
    <div data-testid="validation-results-panel" style={{ padding: '16px' }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>
        Validation Results
      </h4>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {validationResults.map((result) => (
          <li
            key={result.gate}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '8px 0',
              borderBottom: '1px solid var(--color-hairline)',
            }}
          >
            <span
              style={{
                fontSize: '16px',
                lineHeight: 1,
                color: result.passed ? 'var(--color-success)' : 'var(--color-error)',
                flexShrink: 0,
              }}
            >
              {result.passed ? '\u2713' : '\u2717'}
            </span>
            <div>
              <div style={{ fontWeight: 500, fontSize: '13px' }}>{result.gate}</div>
              <div
                style={{
                  fontSize: '12px',
                  color: result.passed ? 'var(--color-ink-secondary)' : 'var(--color-error)',
                  marginTop: '2px',
                }}
              >
                {result.message}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Informational note about server-side checks */}
      <div
        data-testid="server-validation-note"
        style={{
          marginTop: '12px',
          padding: '10px 12px',
          backgroundColor: 'rgba(154,123,79,0.08)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '11px',
          color: 'var(--color-accent)',
          lineHeight: 1.4,
        }}
      >
        Note: The server performs additional eligibility checks (lighting, furniture,
        trim, and hidden component SKUs) that may reject activation even if all
        client-side gates pass.
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', alignItems: 'center' }}>
        {allPassed && (
          <button
            onClick={handleGenerateBom}
            disabled={isLoading}
            data-testid="generate-bom-btn"
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: 'var(--color-accent)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? 'Generating...' : 'Generate Master BOM'}
          </button>
        )}

        <button
          onClick={handleRerunValidation}
          disabled={isLoading}
          data-testid="rerun-validation-btn"
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: 'transparent',
            color: 'var(--color-accent)',
            border: '1px solid var(--color-accent)',
            borderRadius: 'var(--radius-sm)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          Re-run Validation
        </button>
      </div>

      {!allPassed && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            backgroundColor: 'rgba(166,106,45,0.1)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            color: 'var(--color-warning)',
          }}
        >
          Please resolve the failed validation gates before proceeding.
        </div>
      )}
    </div>
  );
}
