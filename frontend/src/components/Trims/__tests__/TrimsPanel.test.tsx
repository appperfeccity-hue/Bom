import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasMode } from '@/types/database';

const mockSelect = vi.fn().mockReturnThis();
const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  fromTable: vi.fn((table: string) => {
    if (table === 'template_trim') {
      return {
        select: mockSelect,
        insert: mockInsert,
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
    };
  }),
  isSupabaseConfigured: false,
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = { user: { id: 'user-1' }, role: 'DESIGNER', isAuthenticated: true, isLoading: false };
    return selector(state);
  }),
}));

// Import after mocks
import { TrimsPanel } from '../TrimsPanel';

describe('TrimsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCanvasStore.setState({ mode: CanvasMode.DESIGNER });

    mockSelect.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            trim_id: 'trim-1',
            template_id: 'tpl-1',
            sku_id: 'SKU-TRIM-001',
            trim_type: 'PHYSICAL',
            quantity_rule: 'TRIM_BY_ZONE_PERIMETER',
            fixed_quantity: null,
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            trim_id: 'trim-2',
            template_id: 'tpl-1',
            sku_id: null,
            trim_type: 'GEOMETRY',
            quantity_rule: 'TRIM_FIXED',
            fixed_quantity: 5,
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            trim_id: 'trim-3',
            template_id: 'tpl-1',
            sku_id: 'SKU-TRIM-003',
            trim_type: 'PHYSICAL',
            quantity_rule: 'TRIM_BY_PANEL_EDGE',
            fixed_quantity: null,
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            trim_id: 'trim-4',
            template_id: 'tpl-1',
            sku_id: 'SKU-TRIM-004',
            trim_type: 'PHYSICAL',
            quantity_rule: 'TRIM_BY_LENGTH',
            fixed_quantity: null,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        error: null,
      }),
    });
  });

  it('renders panel in DESIGNER mode', async () => {
    render(<TrimsPanel templateId="tpl-1" />);
    expect(screen.getByTestId('trims-panel')).toBeInTheDocument();
  });

  it('does not render in CONSULTANT mode', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    render(<TrimsPanel templateId="tpl-1" />);
    expect(screen.queryByTestId('trims-panel')).not.toBeInTheDocument();
  });

  it('displays trim items after fetching', async () => {
    render(<TrimsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('trim-item-trim-1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('trim-item-trim-2')).toBeInTheDocument();
    expect(screen.getByTestId('trim-item-trim-3')).toBeInTheDocument();
    expect(screen.getByTestId('trim-item-trim-4')).toBeInTheDocument();
  });

  it('shows correct trim type badges', async () => {
    render(<TrimsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('trim-type-trim-1')).toHaveTextContent('PHYSICAL');
    });

    expect(screen.getByTestId('trim-type-trim-2')).toHaveTextContent('GEOMETRY');
    expect(screen.getByTestId('trim-type-trim-3')).toHaveTextContent('PHYSICAL');
  });

  it('shows fixed_quantity only for TRIM_FIXED rule', async () => {
    render(<TrimsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('trim-item-trim-2')).toBeInTheDocument();
    });

    // trim-2 has TRIM_FIXED with fixed_quantity=5
    expect(screen.getByTestId('trim-item-trim-2')).toHaveTextContent('qty: 5');

    // trim-1 has TRIM_BY_ZONE_PERIMETER, should not show qty
    expect(screen.getByTestId('trim-item-trim-1')).not.toHaveTextContent('qty:');
  });

  it('shows "Geometry only" when sku_id is null', async () => {
    render(<TrimsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('trim-item-trim-2')).toBeInTheDocument();
    });

    expect(screen.getByTestId('trim-item-trim-2')).toHaveTextContent('Geometry only');
  });

  it('shows empty state message when no trims exist', async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    render(<TrimsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('no-trims-msg')).toBeInTheDocument();
    });
  });

  it('shows add button', () => {
    render(<TrimsPanel templateId="tpl-1" />);
    expect(screen.getByTestId('add-trim-btn')).toBeInTheDocument();
  });

  it('opens dialog on add button click', async () => {
    render(<TrimsPanel templateId="tpl-1" />);
    fireEvent.click(screen.getByTestId('add-trim-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('add-trim-dialog')).toBeInTheDocument();
    });
  });

  it('dialog shows fixed quantity input only for TRIM_FIXED rule', async () => {
    render(<TrimsPanel templateId="tpl-1" />);
    fireEvent.click(screen.getByTestId('add-trim-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('add-trim-dialog')).toBeInTheDocument();
    });

    // Initially quantity rule is TRIM_BY_ZONE_PERIMETER, no fixed quantity field
    expect(screen.queryByTestId('fixed-quantity-input')).not.toBeInTheDocument();

    // Change to TRIM_FIXED
    fireEvent.change(screen.getByTestId('quantity-rule-select'), { target: { value: 'TRIM_FIXED' } });

    expect(screen.getByTestId('fixed-quantity-input')).toBeInTheDocument();
  });

  it('dialog validates that PHYSICAL type requires sku_id', async () => {
    render(<TrimsPanel templateId="tpl-1" />);
    fireEvent.click(screen.getByTestId('add-trim-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('add-trim-dialog')).toBeInTheDocument();
    });

    // Change trim type to PHYSICAL
    fireEvent.change(screen.getByTestId('trim-type-select'), { target: { value: 'PHYSICAL' } });

    // Confirm button should be disabled because sku_id is empty
    const confirmBtn = screen.getByTestId('confirm-btn');
    expect(confirmBtn).toBeDisabled();

    // Enter SKU ID
    fireEvent.change(screen.getByTestId('sku-id-input'), { target: { value: 'SKU-001' } });

    // Now confirm should be enabled
    expect(confirmBtn).not.toBeDisabled();
  });

  it('dialog allows GEOMETRY type without sku_id', async () => {
    render(<TrimsPanel templateId="tpl-1" />);
    fireEvent.click(screen.getByTestId('add-trim-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('add-trim-dialog')).toBeInTheDocument();
    });

    // GEOMETRY is default, confirm should be enabled without sku_id
    const confirmBtn = screen.getByTestId('confirm-btn');
    expect(confirmBtn).not.toBeDisabled();
  });

  it('displays quantity rule for each trim entry', async () => {
    render(<TrimsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('trim-item-trim-1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('trim-item-trim-1')).toHaveTextContent('Rule: TRIM_BY_ZONE_PERIMETER');
    expect(screen.getByTestId('trim-item-trim-2')).toHaveTextContent('Rule: TRIM_FIXED');
    expect(screen.getByTestId('trim-item-trim-3')).toHaveTextContent('Rule: TRIM_BY_PANEL_EDGE');
    expect(screen.getByTestId('trim-item-trim-4')).toHaveTextContent('Rule: TRIM_BY_LENGTH');
  });

  it('dialog clamps negative fixed_quantity to zero on submit', async () => {
    render(<TrimsPanel templateId="tpl-1" />);
    fireEvent.click(screen.getByTestId('add-trim-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('add-trim-dialog')).toBeInTheDocument();
    });

    // Set TRIM_FIXED and a negative quantity
    fireEvent.change(screen.getByTestId('quantity-rule-select'), { target: { value: 'TRIM_FIXED' } });
    fireEvent.change(screen.getByTestId('fixed-quantity-input'), { target: { value: '-5' } });

    fireEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });

    // Verify the insert was called with fixed_quantity clamped to 0
    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.fixed_quantity).toBe(0);
  });
});
