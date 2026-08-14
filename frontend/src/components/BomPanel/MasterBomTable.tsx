import { useBomStore } from '@/stores/bomStore';
import { BomSectionTable } from './BomSectionTable';
import { BomStatusBadge } from './BomStatusBadge';

const columns = [
  { key: 'sku_id', header: 'SKU Code' },
  { key: 'quantity_rule', header: 'Quantity Rule' },
  { key: 'default_quantity', header: 'Default Qty' },
  { key: 'unit_of_measure', header: 'Unit' },
  { key: 'source_zone_id', header: 'Zone Source' },
  { key: 'mandatory', header: 'Mandatory' },
];

export function MasterBomTable() {
  const masterBom = useBomStore((s) => s.masterBom);
  const masterBomLines = useBomStore((s) => s.masterBomLines);

  if (!masterBom) {
    return (
      <div data-testid="master-bom-table-empty" style={{ padding: '16px', color: 'var(--color-ink-secondary)' }}>
        No approved Master BOM found.
      </div>
    );
  }

  return (
    <div data-testid="master-bom-table" style={{ padding: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink-primary)' }}>Master BOM</span>
        <BomStatusBadge status={masterBom.status} />
      </div>
      <BomSectionTable
        lines={masterBomLines as unknown as Record<string, unknown>[]}
        columns={columns}
      />
    </div>
  );
}
