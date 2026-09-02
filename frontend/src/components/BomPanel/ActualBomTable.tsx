import { useBomStore } from '@/stores/bomStore';
import { BomSectionTable } from './BomSectionTable';
import { BomStatusBadge } from './BomStatusBadge';

const columns = [
  { key: 'level', header: 'Level' },
  { key: 'parent_sku_id', header: 'Parent SKU' },
  { key: 'sku_id', header: 'SKU Code' },
  { key: 'quantity', header: 'Quantity' },
  { key: 'required_quantity', header: 'Required Qty' },
  { key: 'waste_factor', header: 'Waste Factor' },
  { key: 'waste_quantity', header: 'Waste Qty' },
  { key: 'unit_of_measure', header: 'Unit' },
  { key: 'calculation_rule', header: 'Calculation Rule' },
];

export function ActualBomTable() {
  const actualBom = useBomStore((s) => s.actualBom);
  const actualBomLines = useBomStore((s) => s.actualBomLines);

  if (!actualBom) {
    return (
      <div data-testid="actual-bom-table-empty" style={{ padding: '16px', color: 'var(--color-ink-secondary)' }}>
        No Actual BOM found.
      </div>
    );
  }

  return (
    <div data-testid="actual-bom-table" style={{ padding: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink-primary)' }}>Actual BOM</span>
        <BomStatusBadge status={actualBom.status} />
      </div>
      <BomSectionTable
        lines={actualBomLines.map((line) => {
          const inputs = line.calculation_inputs ?? {};
          const level = typeof inputs.level === 'number' ? inputs.level : 0;
          const parentSkuId = typeof inputs.parent_sku_id === 'string' ? inputs.parent_sku_id : '';
          return { ...line, level, parent_sku_id: parentSkuId } as unknown as Record<string, unknown>;
        })}
        columns={columns}
      />
    </div>
  );
}
