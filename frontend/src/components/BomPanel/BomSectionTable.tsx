import { ProductType } from '@/types/database';

interface Column {
  key: string;
  header: string;
}

interface BomSectionTableProps {
  lines: Record<string, unknown>[];
  columns: Column[];
  productTypeField?: string;
}

function getProductTypeLabel(pt: string): string {
  switch (pt) {
    case ProductType.WALL_PANEL:
      return 'Wall Panel';
    case ProductType.LIGHT:
      return 'Light';
    case ProductType.FURNITURE:
      return 'Furniture';
    default:
      return pt;
  }
}

export function BomSectionTable({ lines, columns, productTypeField = 'product_type' }: BomSectionTableProps) {
  // Group lines by product_type
  const sections = new Map<string, Record<string, unknown>[]>();
  const sectionOrder = [ProductType.WALL_PANEL, ProductType.LIGHT, ProductType.FURNITURE];

  for (const pt of sectionOrder) {
    sections.set(pt, []);
  }

  for (const line of lines) {
    const pt = line[productTypeField] as string;
    const existing = sections.get(pt);
    if (existing) {
      existing.push(line);
    } else {
      sections.set(pt, [line]);
    }
  }

  // Build the final render order: known types first, then any additional types
  const renderOrder: string[] = [...sectionOrder];
  for (const key of sections.keys()) {
    if (!renderOrder.includes(key)) {
      renderOrder.push(key);
    }
  }

  return (
    <div data-testid="bom-section-table">
      {renderOrder.map((pt) => {
        const sectionLines = sections.get(pt) ?? [];
        if (sectionLines.length === 0) return null;

        return (
          <div key={pt} data-testid={`bom-section-${pt.toLowerCase()}`} style={{ marginBottom: '16px' }}>
            <h4
              style={{
                margin: '0 0 8px 0',
                fontSize: '13px',
                fontWeight: 600,
                color: '#333',
                borderBottom: '1px solid #e0e0e0',
                paddingBottom: '4px',
              }}
            >
              {getProductTypeLabel(pt)}
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
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        textAlign: 'left',
                        padding: '4px 8px',
                        borderBottom: '1px solid #eee',
                        fontWeight: 600,
                        color: '#555',
                      }}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sectionLines.map((line, idx) => (
                  <tr key={idx}>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{
                          padding: '4px 8px',
                          borderBottom: '1px solid #f5f5f5',
                        }}
                      >
                        {String(line[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr data-testid={`bom-section-totals-${pt.toLowerCase()}`}>
                  <td
                    colSpan={columns.length}
                    style={{
                      padding: '4px 8px',
                      fontWeight: 600,
                      fontSize: '11px',
                      color: '#666',
                      borderTop: '1px solid #ddd',
                    }}
                  >
                    Total items: {sectionLines.length}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })}
    </div>
  );
}
