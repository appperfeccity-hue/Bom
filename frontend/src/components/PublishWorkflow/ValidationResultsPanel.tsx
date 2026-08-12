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
      void generateMasterBom(currentTemplate.id);
    }
  };

  const handleRerunValidation = () => {
    if (currentTemplate) {
      void rerunValidation(currentTemplate.id);
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
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            <span
              style={{
                fontSize: '16px',
                lineHeight: 1,
                color: result.passed ? '#4caf50' : '#f44336',
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
                  color: result.passed ? '#666' : '#f44336',
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
          backgroundColor: '#e3f2fd',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#1565c0',
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
              backgroundColor: '#1976d2',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
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
            color: '#1976d2',
            border: '1px solid #1976d2',
            borderRadius: '4px',
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
            backgroundColor: '#fff3e0',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#e65100',
          }}
        >
          Please resolve the failed validation gates before proceeding.
        </div>
      )}
    </div>
  );
}
