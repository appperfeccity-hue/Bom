import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsultantAlternativesPanel } from '../ConsultantAlternativesPanel';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { CanvasMode } from '@/types/database';
import type { ProjectSnapshot, SkuMaster } from '@/types/database';

vi.mock('@/lib/supabase', () => ({
  fromTable: () => ({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }), order: () => Promise.resolve({ data: [], error: null }) }), order: () => Promise.resolve({ data: [], error: null }) }),
    insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) }),
    upsert: () => Promise.resolve({ data: null, error: null }),
  }),
}));

const mockSnapshotWithAlternatives: ProjectSnapshot = {
  id: 'snap-1',
  project_id: 'proj-1',
  template_id: 'tmpl-1',
  snapshot_data: {
    permissions: [],
    alternatives: [
      {
        alternative_id: 'alt-1',
        template_zone_id: 'zone-1',
        alternative_sku_id: 'sku-abc',
        sku_code: 'WP-001',
        display_order: 1,
        status: 'ACTIVE',
      },
      {
        alternative_id: 'alt-2',
        template_zone_id: 'zone-1',
        alternative_sku_id: 'sku-def',
        sku_code: 'WP-002',
        display_order: 2,
        status: 'ACTIVE',
      },
      {
        alternative_id: 'alt-3',
        template_zone_id: 'zone-2',
        alternative_sku_id: 'sku-ghi',
        sku_code: 'WP-003',
        display_order: 1,
        status: 'ACTIVE',
      },
      {
        alternative_id: 'alt-4',
        template_zone_id: 'zone-1',
        alternative_sku_id: 'sku-inactive',
        sku_code: 'WP-INACTIVE',
        display_order: 3,
        status: 'INACTIVE',
      },
    ],
  },
  created_by: 'user-1',
  created_at: '2024-01-01',
  version: 1,
};

describe('ConsultantAlternativesPanel', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      selection: { selectedZoneId: null, selectedZoneIds: [], resizeHandle: null, marqueeRect: null },
    });
    useProjectStore.setState({
      currentSnapshot: null,
      zoneSku: new Map(),
    });
  });

  it('renders nothing when not in Consultant mode', () => {
    useCanvasStore.setState({ mode: CanvasMode.DESIGNER });
    useProjectStore.setState({ currentSnapshot: mockSnapshotWithAlternatives });
    useCanvasStore.setState({
      selection: { selectedZoneId: 'zone-1', selectedZoneIds: ['zone-1'], resizeHandle: null, marqueeRect: null },
    });

    const { container } = render(<ConsultantAlternativesPanel />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when no alternatives for selected zone', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    useProjectStore.setState({ currentSnapshot: mockSnapshotWithAlternatives });
    useCanvasStore.setState({
      selection: { selectedZoneId: 'zone-no-alternatives', selectedZoneIds: ['zone-no-alternatives'], resizeHandle: null, marqueeRect: null },
    });

    const { container } = render(<ConsultantAlternativesPanel />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when no zone selected', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    useProjectStore.setState({ currentSnapshot: mockSnapshotWithAlternatives });
    useCanvasStore.setState({
      selection: { selectedZoneId: null, selectedZoneIds: [], resizeHandle: null, marqueeRect: null },
    });

    const { container } = render(<ConsultantAlternativesPanel />);
    expect(container.innerHTML).toBe('');
  });

  it('shows alternatives when zone has promoted alternatives', () => {
    useCanvasStore.setState({
      mode: CanvasMode.CONSULTANT,
      selection: { selectedZoneId: 'zone-1', selectedZoneIds: ['zone-1'], resizeHandle: null, marqueeRect: null },
    });
    useProjectStore.setState({ currentSnapshot: mockSnapshotWithAlternatives });

    render(<ConsultantAlternativesPanel />);

    expect(screen.getByTestId('consultant-alternatives-panel')).toBeInTheDocument();
    expect(screen.getByTestId('alternative-option-sku-abc')).toBeInTheDocument();
    expect(screen.getByTestId('alternative-option-sku-def')).toBeInTheDocument();

    // Should show the sku codes
    expect(screen.getByText('WP-001')).toBeInTheDocument();
    expect(screen.getByText('WP-002')).toBeInTheDocument();
  });

  it('does not show inactive alternatives', () => {
    useCanvasStore.setState({
      mode: CanvasMode.CONSULTANT,
      selection: { selectedZoneId: 'zone-1', selectedZoneIds: ['zone-1'], resizeHandle: null, marqueeRect: null },
    });
    useProjectStore.setState({ currentSnapshot: mockSnapshotWithAlternatives });

    render(<ConsultantAlternativesPanel />);

    expect(screen.queryByText('WP-INACTIVE')).not.toBeInTheDocument();
  });

  it('selecting an alternative calls assignSku', async () => {
    useCanvasStore.setState({
      mode: CanvasMode.CONSULTANT,
      selection: { selectedZoneId: 'zone-1', selectedZoneIds: ['zone-1'], resizeHandle: null, marqueeRect: null },
    });
    useProjectStore.setState({ currentSnapshot: mockSnapshotWithAlternatives });

    // Spy on assignSku
    const assignSkuSpy = vi.fn().mockResolvedValue(undefined);
    useProjectStore.setState({ assignSku: assignSkuSpy });

    render(<ConsultantAlternativesPanel />);

    const option = screen.getByTestId('alternative-option-sku-abc');
    fireEvent.click(option);

    expect(assignSkuSpy).toHaveBeenCalledWith('zone-1', 'sku-abc');
  });

  it('cannot select arbitrary SKU not in alternatives list', () => {
    useCanvasStore.setState({
      mode: CanvasMode.CONSULTANT,
      selection: { selectedZoneId: 'zone-1', selectedZoneIds: ['zone-1'], resizeHandle: null, marqueeRect: null },
    });
    useProjectStore.setState({ currentSnapshot: mockSnapshotWithAlternatives });

    render(<ConsultantAlternativesPanel />);

    // Only the alternatives for zone-1 should be shown (sku-abc, sku-def)
    // Not sku-ghi (zone-2) or any arbitrary SKU
    expect(screen.queryByTestId('alternative-option-sku-ghi')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alternative-option-sku-xyz')).not.toBeInTheDocument();
  });

  it('highlights currently selected SKU', () => {
    useCanvasStore.setState({
      mode: CanvasMode.CONSULTANT,
      selection: { selectedZoneId: 'zone-1', selectedZoneIds: ['zone-1'], resizeHandle: null, marqueeRect: null },
    });

    const mockSku: SkuMaster = {
      sku_id: 'sku-abc',
      sku_code: 'WP-001',
      product_type: 'WALL_PANEL' as never,
      family_id: 'fam-1',
      category_id: 'cat-1',
      width_mm: 600,
      height_mm: 2700,
      thickness_mm: null,
      depth_mm: null,
      unit_length_mm: null,
      material: 'wood',
      colour: 'white',
      finish: 'matte',
      pattern_identity: null,
      gh_mm: 0,
      gv_mm: 0,
      quantity_mode: null,
      commercial_attributes: {},
      status: 'ACTIVE' as never,
      created_by: 'user-1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    const skuMap = new Map();
    skuMap.set('zone-1', mockSku);

    useProjectStore.setState({
      currentSnapshot: mockSnapshotWithAlternatives,
      zoneSku: skuMap,
    });

    render(<ConsultantAlternativesPanel />);

    // The selected button should show "Selected" text
    expect(screen.getByText('Selected')).toBeInTheDocument();
  });
});
