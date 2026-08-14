import { ProductType } from '@/types/database';
import { useCanvasStore } from '@/stores/canvasStore';

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

const numericColumns = ['default_quantity', 'quantity', 'required_quantity', 'waste_factor', 'waste_quantity'];

export function BomSectionTable({ lines, columns, productTypeField = 'product_type' }: BomSectionTableProps) {
  const highlightedBomLineIds = useCanvasStore((s) => s.highlightedBomLineIds);
  const setHighlightedZoneIds = useCanvasStore((s) => s.setHighlightedZoneIds);

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

  const handleRowMouseEnter = (line: Record<string, unknown>) => {
    const sourceZoneId = line['source_zone_id'] as string | null;
    if (sourceZoneId) {
      setHighlightedZoneIds([sourceZoneId]);
    }
  };

  const handleRowMouseLeave = () => {
    setHighlightedZoneIds([]);
  };

  const handleRowClick = (line: Record<string, unknown>) => {
    const sourceZoneId = line['source_zone_id'] as string | null;
    if (sourceZoneId) {
      setHighlightedZoneIds([sourceZoneId]);
    }
  };

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
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--color-ink-secondary)',
                textTransform: 'uppercase',
                borderBottom: '1px solid var(--color-hairline)',
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
                        borderBottom: '1px solid var(--color-hairline)',
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--color-ink-secondary)',
                        fontSize: 'var(--text-sm)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sectionLines.map((line, idx) => {
                  const lineId = (line['master_bom_line_id'] ?? line['actual_bom_line_id'] ?? '') as string;
                  const isHighlighted = highlightedBomLineIds.includes(lineId);

                  return (
                    <tr
                      key={idx}
                      onMouseEnter={() => handleRowMouseEnter(line)}
                      onMouseLeave={handleRowMouseLeave}
                      onClick={() => handleRowClick(line)}
                      style={{
                        backgroundColor: isHighlighted ? 'rgba(154,123,79,0.08)' : undefined,
                        cursor: line['source_zone_id'] ? 'pointer' : undefined,
                      }}
                      data-testid={isHighlighted ? 'bom-row-highlighted' : undefined}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          style={{
                            padding: '4px 8px',
                            borderBottom: '1px solid var(--color-hairline)',
                            fontFamily: numericColumns.includes(col.key) ? 'var(--font-mono)' : undefined,
                          }}
                        >
                          {String(line[col.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr data-testid={`bom-section-totals-${pt.toLowerCase()}`}>
                  <td
                    colSpan={columns.length}
                    style={{
                      padding: '4px 8px',
                      fontWeight: 'var(--weight-semibold)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-ink-secondary)',
                      borderTop: '1px solid var(--color-hairline)',
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
