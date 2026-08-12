import { useBomStore } from '@/stores/bomStore';
import { ReconciliationResultType } from '@/types/database';

function getResultColor(resultType: ReconciliationResultType): string {
  switch (resultType) {
    case ReconciliationResultType.UNCHANGED:
      return '#4caf50';
    case ReconciliationResultType.QUANTITY_CHANGED:
      return '#ff9800';
    case ReconciliationResultType.SKU_CHANGED:
      return '#2196f3';
    case ReconciliationResultType.REMOVED:
      return '#f44336';
    case ReconciliationResultType.ADDED_BY_TRIGGER:
      return '#9c27b0';
    case ReconciliationResultType.UNEXPECTED:
      return '#e91e63';
    default:
      return '#9e9e9e';
  }
}

export function BomReconciliationView() {
  const masterBomLines = useBomStore((s) => s.masterBomLines);
  const actualBomLines = useBomStore((s) => s.actualBomLines);
  const reconciliation = useBomStore((s) => s.reconciliation);

  // Only visible when both master and actual lines are loaded
  if (masterBomLines.length === 0 && actualBomLines.length === 0) {
    return null;
  }

  if (reconciliation.length === 0) {
    return (
      <div data-testid="bom-reconciliation-empty" style={{ padding: '16px', color: '#666' }}>
        No reconciliation data. Compute reconciliation to compare Master vs Actual BOM.
      </div>
    );
  }

  return (
    <div data-testid="bom-reconciliation-view" style={{ padding: '12px' }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600 }}>
        BOM Reconciliation
      </h4>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px',
        }}
      >
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #eee', fontWeight: 600 }}>
              SKU
            </th>
            <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #eee', fontWeight: 600 }}>
              Master Qty
            </th>
            <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #eee', fontWeight: 600 }}>
              Actual Qty
            </th>
            <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #eee', fontWeight: 600 }}>
              Result
            </th>
          </tr>
        </thead>
        <tbody>
          {reconciliation.map((line, idx) => (
            <tr key={idx} data-testid={`reconciliation-row-${idx}`}>
              <td style={{ padding: '4px 8px', borderBottom: '1px solid #f5f5f5' }}>
                {line.master_line?.sku_id ?? line.actual_line?.sku_id ?? '-'}
              </td>
              <td style={{ padding: '4px 8px', borderBottom: '1px solid #f5f5f5' }}>
                {line.master_line?.default_quantity ?? '-'}
              </td>
              <td style={{ padding: '4px 8px', borderBottom: '1px solid #f5f5f5' }}>
                {line.actual_line?.quantity ?? '-'}
              </td>
              <td style={{ padding: '4px 8px', borderBottom: '1px solid #f5f5f5' }}>
                <span
                  data-testid={`reconciliation-badge-${idx}`}
                  style={{
                    display: 'inline-block',
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: 600,
                    borderRadius: '3px',
                    backgroundColor: getResultColor(line.result_type),
                    color: '#ffffff',
                  }}
                >
                  {line.result_type}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
