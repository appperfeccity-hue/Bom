import { useBomStore } from '@/stores/bomStore';
import { ReconciliationResultType } from '@/types/database';

function getResultStyle(resultType: ReconciliationResultType): { backgroundColor: string; color: string } {
  switch (resultType) {
    case ReconciliationResultType.UNCHANGED:
      return { backgroundColor: 'rgba(110,110,110,0.1)', color: 'var(--color-ink-secondary)' };
    case ReconciliationResultType.QUANTITY_CHANGED:
      return { backgroundColor: 'rgba(166,106,45,0.1)', color: 'var(--color-warning)' };
    case ReconciliationResultType.SKU_CHANGED:
      return { backgroundColor: 'rgba(154,123,79,0.1)', color: 'var(--color-accent)' };
    case ReconciliationResultType.REMOVED:
      return { backgroundColor: 'rgba(176,65,62,0.1)', color: 'var(--color-error)' };
    case ReconciliationResultType.ADDED_BY_TRIGGER:
      return { backgroundColor: 'rgba(154,123,79,0.1)', color: 'var(--color-accent)' };
    case ReconciliationResultType.UNEXPECTED:
      return { backgroundColor: 'rgba(176,65,62,0.1)', color: 'var(--color-error)' };
    default:
      return { backgroundColor: 'rgba(110,110,110,0.1)', color: 'var(--color-ink-secondary)' };
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
      <div data-testid="bom-reconciliation-empty" style={{ padding: '16px', color: 'var(--color-ink-secondary)' }}>
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
            <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--color-hairline)', fontWeight: 600 }}>
              SKU
            </th>
            <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--color-hairline)', fontWeight: 600 }}>
              Master Qty
            </th>
            <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--color-hairline)', fontWeight: 600 }}>
              Actual Qty
            </th>
            <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--color-hairline)', fontWeight: 600 }}>
              Result
            </th>
          </tr>
        </thead>
        <tbody>
          {reconciliation.map((line, idx) => (
            <tr key={idx} data-testid={`reconciliation-row-${idx}`}>
              <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--color-hairline)' }}>
                {line.master_line?.sku_id ?? line.actual_line?.sku_id ?? '-'}
              </td>
              <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--color-hairline)', fontFamily: 'var(--font-mono)' }}>
                {line.master_line?.default_quantity ?? '-'}
              </td>
              <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--color-hairline)', fontFamily: 'var(--font-mono)' }}>
                {line.actual_line?.quantity ?? '-'}
              </td>
              <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--color-hairline)' }}>
                <span
                  data-testid={`reconciliation-badge-${idx}`}
                  style={{
                    display: 'inline-block',
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: 600,
                    borderRadius: '3px',
                    backgroundColor: getResultStyle(line.result_type).backgroundColor,
                    color: getResultStyle(line.result_type).color,
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
