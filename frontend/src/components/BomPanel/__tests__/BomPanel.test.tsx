import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useBomStore } from '@/stores/bomStore';
import { useCanvasStore } from '@/stores/canvasStore';
import {
  CanvasMode,
  MasterBomStatus,
  ActualBomStatus,
  ProductType,
  ReconciliationResultType,
} from '@/types/database';
import type {
  MasterBom,
  MasterBomLine,
  ActualBom,
  ActualBomLine,
  FinalBom,
  FinalBomLine,
  ReconciliationLine,
} from '@/types/database';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {},
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
  isSupabaseConfigured: false,
}));

// Import after mocks
import { BomPanel } from '../BomPanel';
import { BomStatusBadge } from '../BomStatusBadge';
import { BomReconciliationView } from '../BomReconciliationView';

const mockMasterBom: MasterBom = {
  master_bom_id: 'bom-1',
  template_id: 'tpl-1',
  status: MasterBomStatus.APPROVED,
  generated_at: '2024-01-01T00:00:00Z',
  engine_version: '1.0',
  rule_set_id: 'rs-1',
  approved_by: 'user-1',
  approved_at: '2024-01-02T00:00:00Z',
  created_at: '2024-01-01T00:00:00Z',
};

const mockMasterBomLines: MasterBomLine[] = [
  {
    master_bom_line_id: 'ml-1',
    master_bom_id: 'bom-1',
    template_component_id: 'tc-1',
    sku_id: 'sku-wp-1',
    product_type: ProductType.WALL_PANEL,
    source_zone_id: 'zone-1',
    source_relationship_id: null,
    quantity_rule: 'FIXED',
    default_quantity: 4,
    unit_of_measure: 'PCS',
    mandatory: true,
    hidden: false,
    calculation_parameters: {},
    parent_bom_line_id: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    master_bom_line_id: 'ml-2',
    master_bom_id: 'bom-1',
    template_component_id: 'tc-2',
    sku_id: 'sku-lt-1',
    product_type: ProductType.LIGHT,
    source_zone_id: null,
    source_relationship_id: null,
    quantity_rule: 'CALCULATED',
    default_quantity: 2,
    unit_of_measure: 'PCS',
    mandatory: false,
    hidden: false,
    calculation_parameters: {},
    parent_bom_line_id: null,
    created_at: '2024-01-01T00:00:00Z',
  },
];

const mockActualBom: ActualBom = {
  actual_bom_id: 'abom-1',
  project_id: 'proj-1',
  snapshot_id: 'snap-1',
  configuration_id: 'cfg-1',
  status: ActualBomStatus.VALIDATED,
  engine_version: '1.0',
  rule_set_id: 'rs-1',
  input_hash: 'hash-1',
  calculation_timestamp: '2024-01-05T00:00:00Z',
};

const mockActualBomLines: ActualBomLine[] = [
  {
    actual_bom_line_id: 'al-1',
    actual_bom_id: 'abom-1',
    master_bom_line_id: 'ml-1',
    component_id: 'comp-1',
    sku_id: 'sku-wp-1',
    product_type: ProductType.WALL_PANEL,
    quantity: 6,
    required_quantity: 6,
    waste_factor: 0.1,
    waste_quantity: 1,
    unit_of_measure: 'PCS',
    resolved_dimensions: {},
    calculation_rule: 'AREA_BASED',
    calculation_inputs: {},
  },
  {
    actual_bom_line_id: 'al-2',
    actual_bom_id: 'abom-1',
    master_bom_line_id: 'ml-2',
    component_id: 'comp-2',
    sku_id: 'sku-lt-1',
    product_type: ProductType.LIGHT,
    quantity: 3,
    required_quantity: 3,
    waste_factor: 0,
    waste_quantity: 0,
    unit_of_measure: 'PCS',
    resolved_dimensions: {},
    calculation_rule: 'FIXED',
    calculation_inputs: {},
  },
];

const mockFinalBom: FinalBom = {
  final_bom_id: 'fbom-1',
  project_id: 'proj-1',
  actual_bom_id: 'abom-1',
  final_bom_hash: 'finalhash-1',
  engine_version: '1.0',
  rule_set_id: 'rs-1',
  input_hash: 'hash-1',
  finalized_at: '2024-01-10T00:00:00Z',
  finalized_by: 'user-1',
};

const mockFinalBomLines: FinalBomLine[] = [
  {
    final_bom_line_id: 'fl-1',
    final_bom_id: 'fbom-1',
    actual_bom_line_id: 'al-1',
    sku_id: 'sku-wp-1',
    sku_code: 'WP-OAK-001',
    product_type: ProductType.WALL_PANEL,
    sku_material: 'Oak',
    sku_colour: 'Natural',
    sku_finish: 'Matte',
    sku_dimensions_json: null,
    source_zone_id: 'zone-1',
    source_component_id: 'comp-1',
    quantity: 6,
    required_quantity: 6,
    waste_quantity: 1,
    unit_of_measure: 'PCS',
    resolved_dimensions: {},
    source_trace: {},
  },
  {
    final_bom_line_id: 'fl-2',
    final_bom_id: 'fbom-1',
    actual_bom_line_id: 'al-2',
    sku_id: 'sku-lt-1',
    sku_code: 'LT-SPOT-001',
    product_type: ProductType.LIGHT,
    sku_material: 'Aluminum',
    sku_colour: 'Silver',
    sku_finish: 'Brushed',
    sku_dimensions_json: null,
    source_zone_id: null,
    source_component_id: 'comp-2',
    quantity: 3,
    required_quantity: 3,
    waste_quantity: 0,
    unit_of_measure: 'PCS',
    resolved_dimensions: {},
    source_trace: {},
  },
];

describe('BomPanel', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      selection: { selectedZoneId: null, resizeHandle: null },
    });
    useBomStore.setState({
      masterBom: mockMasterBom,
      masterBomLines: mockMasterBomLines,
      actualBom: null,
      actualBomLines: [],
      finalBom: null,
      finalBomLines: [],
      reconciliation: [],
      isLoading: false,
      error: null,
      isBomPanelOpen: true,
    });
  });

  it('renders when isBomPanelOpen is true', () => {
    render(<BomPanel />);
    expect(screen.getByTestId('bom-panel')).toBeInTheDocument();
  });

  it('does not render when isBomPanelOpen is false', () => {
    useBomStore.setState({ isBomPanelOpen: false });
    render(<BomPanel />);
    expect(screen.queryByTestId('bom-panel')).not.toBeInTheDocument();
  });

  it('shows MasterBomTable in DESIGNER mode', () => {
    render(<BomPanel />);
    expect(screen.getByTestId('master-bom-table')).toBeInTheDocument();
    expect(screen.queryByTestId('actual-bom-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('final-bom-table')).not.toBeInTheDocument();
  });

  it('shows ActualBomTable and FinalBomTable in CONSULTANT mode', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    useBomStore.setState({
      masterBom: null,
      masterBomLines: [],
      actualBom: mockActualBom,
      actualBomLines: mockActualBomLines,
      finalBom: mockFinalBom,
      finalBomLines: mockFinalBomLines,
    });

    render(<BomPanel />);
    expect(screen.getByTestId('actual-bom-table')).toBeInTheDocument();
    expect(screen.getByTestId('final-bom-table')).toBeInTheDocument();
    expect(screen.queryByTestId('master-bom-table')).not.toBeInTheDocument();
  });

  it('close button closes the panel', () => {
    render(<BomPanel />);
    fireEvent.click(screen.getByTestId('bom-panel-close-btn'));
    expect(useBomStore.getState().isBomPanelOpen).toBe(false);
  });

  it('shows loading indicator when isLoading is true', () => {
    useBomStore.setState({ isLoading: true });
    render(<BomPanel />);
    expect(screen.getByTestId('bom-panel-loading')).toBeInTheDocument();
  });

  it('shows error message when error is set', () => {
    useBomStore.setState({ error: 'Something went wrong' });
    render(<BomPanel />);
    expect(screen.getByTestId('bom-panel-error')).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
  });

  describe('section grouping', () => {
    it('groups master BOM lines by product_type', () => {
      render(<BomPanel />);
      expect(screen.getByTestId('bom-section-wall_panel')).toBeInTheDocument();
      expect(screen.getByTestId('bom-section-light')).toBeInTheDocument();
    });

    it('shows totals rows per section', () => {
      render(<BomPanel />);
      expect(screen.getByTestId('bom-section-totals-wall_panel')).toHaveTextContent('Total items: 1');
      expect(screen.getByTestId('bom-section-totals-light')).toHaveTextContent('Total items: 1');
    });
  });

  describe('FinalBomTable immutability indicator', () => {
    it('shows immutable badge on final BOM', () => {
      useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
      useBomStore.setState({
        masterBom: null,
        masterBomLines: [],
        actualBom: mockActualBom,
        actualBomLines: mockActualBomLines,
        finalBom: mockFinalBom,
        finalBomLines: mockFinalBomLines,
      });

      render(<BomPanel />);
      expect(screen.getByTestId('final-bom-lock-badge')).toHaveTextContent('Immutable');
    });
  });
});

describe('BomStatusBadge', () => {
  it('renders APPROVED with green color', () => {
    render(<BomStatusBadge status={MasterBomStatus.APPROVED} />);
    const badge = screen.getByTestId('bom-status-badge-approved');
    expect(badge).toHaveTextContent('APPROVED');
    expect(badge).toHaveStyle({ backgroundColor: '#4caf50' });
  });

  it('renders GENERATED with blue color', () => {
    render(<BomStatusBadge status={MasterBomStatus.GENERATED} />);
    const badge = screen.getByTestId('bom-status-badge-generated');
    expect(badge).toHaveTextContent('GENERATED');
    expect(badge).toHaveStyle({ backgroundColor: '#2196f3' });
  });

  it('renders VALIDATED with orange color', () => {
    render(<BomStatusBadge status={MasterBomStatus.VALIDATED} />);
    const badge = screen.getByTestId('bom-status-badge-validated');
    expect(badge).toHaveTextContent('VALIDATED');
    expect(badge).toHaveStyle({ backgroundColor: '#ff9800' });
  });

  it('renders INVALIDATED with red color', () => {
    render(<BomStatusBadge status={MasterBomStatus.INVALIDATED} />);
    const badge = screen.getByTestId('bom-status-badge-invalidated');
    expect(badge).toHaveTextContent('INVALIDATED');
    expect(badge).toHaveStyle({ backgroundColor: '#f44336' });
  });

  it('renders SUPERSEDED with red color', () => {
    render(<BomStatusBadge status={ActualBomStatus.SUPERSEDED} />);
    const badge = screen.getByTestId('bom-status-badge-superseded');
    expect(badge).toHaveTextContent('SUPERSEDED');
    expect(badge).toHaveStyle({ backgroundColor: '#f44336' });
  });
});

describe('BomReconciliationView', () => {
  beforeEach(() => {
    useBomStore.setState({
      masterBomLines: mockMasterBomLines,
      actualBomLines: mockActualBomLines,
      reconciliation: [],
    });
  });

  it('does not render when both masterBomLines and actualBomLines are empty', () => {
    useBomStore.setState({
      masterBomLines: [],
      actualBomLines: [],
      reconciliation: [],
    });
    render(<BomReconciliationView />);
    expect(screen.queryByTestId('bom-reconciliation-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bom-reconciliation-empty')).not.toBeInTheDocument();
  });

  it('shows empty message when lines exist but reconciliation is empty', () => {
    render(<BomReconciliationView />);
    expect(screen.getByTestId('bom-reconciliation-empty')).toBeInTheDocument();
  });

  it('shows reconciliation results with badges', () => {
    const reconciliation: ReconciliationLine[] = [
      {
        master_line: mockMasterBomLines[0],
        actual_line: mockActualBomLines[0],
        result_type: ReconciliationResultType.QUANTITY_CHANGED,
      },
      {
        master_line: mockMasterBomLines[1],
        actual_line: mockActualBomLines[1],
        result_type: ReconciliationResultType.UNCHANGED,
      },
    ];
    useBomStore.setState({ reconciliation });

    render(<BomReconciliationView />);
    expect(screen.getByTestId('bom-reconciliation-view')).toBeInTheDocument();
    expect(screen.getByTestId('reconciliation-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('reconciliation-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('reconciliation-badge-0')).toHaveTextContent('QUANTITY_CHANGED');
    expect(screen.getByTestId('reconciliation-badge-1')).toHaveTextContent('UNCHANGED');
  });

  it('shows correct colors for reconciliation result types', () => {
    const reconciliation: ReconciliationLine[] = [
      {
        master_line: null,
        actual_line: mockActualBomLines[0],
        result_type: ReconciliationResultType.ADDED_BY_TRIGGER,
      },
    ];
    useBomStore.setState({ reconciliation });

    render(<BomReconciliationView />);
    const badge = screen.getByTestId('reconciliation-badge-0');
    expect(badge).toHaveStyle({ backgroundColor: '#9c27b0' });
  });
});
