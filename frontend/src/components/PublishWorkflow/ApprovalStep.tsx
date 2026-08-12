import { usePublishStore } from '@/stores/publishStore';

export function ApprovalStep() {
  const generatedBom = usePublishStore((s) => s.generatedBom);
  const generatedBomLines = usePublishStore((s) => s.generatedBomLines);
  const approveMasterBom = usePublishStore((s) => s.approveMasterBom);
  const isLoading = usePublishStore((s) => s.isLoading);

  const handleApprove = () => {
    if (generatedBom) {
      void approveMasterBom(generatedBom.master_bom_id);
    }
  };

  return (
    <div data-testid="approval-step" style={{ padding: '16px' }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>
        Approve Master BOM
      </h4>

      {generatedBom && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
          }}
        >
          <div style={{ fontSize: '13px', marginBottom: '4px' }}>
            <strong>Generated At:</strong> {new Date(generatedBom.generated_at).toLocaleString()}
          </div>
          <div style={{ fontSize: '13px', marginBottom: '4px' }}>
            <strong>Engine Version:</strong> {generatedBom.engine_version}
          </div>
          <div style={{ fontSize: '13px' }}>
            <strong>Status:</strong> {generatedBom.status}
          </div>
        </div>
      )}

      {generatedBomLines.length > 0 && (
        <div style={{ marginBottom: '16px', overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>
                  SKU
                </th>
                <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>
                  Product Type
                </th>
                <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #e0e0e0' }}>
                  Qty
                </th>
                <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>
                  UOM
                </th>
              </tr>
            </thead>
            <tbody>
              {generatedBomLines.map((line) => (
                <tr key={line.master_bom_line_id}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #f0f0f0' }}>
                    {line.sku_id}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #f0f0f0' }}>
                    {line.product_type}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                    {line.default_quantity}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #f0f0f0' }}>
                    {line.unit_of_measure}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {generatedBomLines.length === 0 && (
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
          No BOM lines generated. The BOM structure will be populated by the engine.
        </div>
      )}

      <button
        onClick={handleApprove}
        disabled={isLoading || !generatedBom}
        data-testid="approve-bom-btn"
        style={{
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: 600,
          backgroundColor: '#388e3c',
          color: '#ffffff',
          border: 'none',
          borderRadius: '4px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        {isLoading ? 'Approving...' : 'Approve Master BOM'}
      </button>
    </div>
  );
}
