import { useBomStore } from '@/stores/bomStore';
import { BomSectionTable } from './BomSectionTable';

const columns = [
  { key: 'sku_code', header: 'SKU Code' },
  { key: 'sku_material', header: 'Material' },
  { key: 'sku_colour', header: 'Colour' },
  { key: 'sku_finish', header: 'Finish' },
  { key: 'quantity', header: 'Qty' },
  { key: 'required_quantity', header: 'Required' },
  { key: 'waste_quantity', header: 'Waste' },
  { key: 'unit_of_measure', header: 'Unit' },
];

export function FinalBomTable() {
  const finalBom = useBomStore((s) => s.finalBom);
  const finalBomLines = useBomStore((s) => s.finalBomLines);

  if (!finalBom) {
    return (
      <div data-testid="final-bom-table-empty" style={{ padding: '16px', color: '#666' }}>
        No Final BOM found.
      </div>
    );
  }

  return (
    <div data-testid="final-bom-table" style={{ padding: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600 }}>Final BOM</span>
        <span
          data-testid="final-bom-lock-badge"
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 600,
            borderRadius: '4px',
            backgroundColor: '#7b1fa2',
            color: '#ffffff',
          }}
        >
          Immutable
        </span>
      </div>
      <BomSectionTable
        lines={finalBomLines as unknown as Record<string, unknown>[]}
        columns={columns}
      />
    </div>
  );
}
