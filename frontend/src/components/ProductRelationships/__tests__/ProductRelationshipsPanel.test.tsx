import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasMode, CompatibilityRelationship, Directionality, SkuStatus } from '@/types/database';

const mockSelect = vi.fn().mockReturnThis();
const mockOr = vi.fn();
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
const mockIlike = vi.fn().mockReturnThis();
const mockRange = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  fromTable: vi.fn((table: string) => {
    if (table === 'sku_compatibility') {
      return {
        select: mockSelect,
        insert: mockInsert,
        delete: () => ({
          eq: mockDeleteEq,
        }),
      };
    }
    if (table === 'template_lighting') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ sku_id: 'sku-light-1' }, { sku_id: 'sku-light-2' }],
            error: null,
          }),
        }),
      };
    }
    if (table === 'template_trim') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ sku_id: 'sku-trim-1' }],
            error: null,
          }),
        }),
      };
    }
    if (table === 'template_zone_sku') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ sku_id: 'sku-zone-1' }],
            error: null,
          }),
        }),
      };
    }
    if (table === 'sku_master') {
      return {
        select: vi.fn().mockReturnValue({
          ilike: mockIlike,
        }),
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
import { ProductRelationshipsPanel } from '../ProductRelationshipsPanel';
import { AddRelationshipDialog } from '../AddRelationshipDialog';

const sampleRelationships = [
  {
    compatibility_id: 'comp-1',
    source_sku_id: 'sku-light-1',
    target_sku_id: 'sku-trim-1',
    relationship_type: CompatibilityRelationship.REQUIRES,
    directionality: Directionality.UNIDIRECTIONAL,
    is_mandatory: true,
    status: SkuStatus.ACTIVE,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    compatibility_id: 'comp-2',
    source_sku_id: 'sku-light-2',
    target_sku_id: 'sku-zone-1',
    relationship_type: CompatibilityRelationship.COMPATIBLE_WITH,
    directionality: Directionality.BIDIRECTIONAL,
    is_mandatory: false,
    status: SkuStatus.ACTIVE,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    compatibility_id: 'comp-3',
    source_sku_id: 'sku-zone-1',
    target_sku_id: 'sku-light-1',
    relationship_type: CompatibilityRelationship.ALTERNATIVE_TO,
    directionality: Directionality.UNIDIRECTIONAL,
    is_mandatory: false,
    status: SkuStatus.ACTIVE,
    created_at: '2024-01-01T00:00:00Z',
  },
];

describe('ProductRelationshipsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCanvasStore.setState({ mode: CanvasMode.DESIGNER });

    mockSelect.mockReturnValue({
      or: mockOr,
    });
    mockOr.mockResolvedValue({
      data: sampleRelationships,
      error: null,
    });
  });

  it('renders panel in DESIGNER mode', async () => {
    render(<ProductRelationshipsPanel templateId="tpl-1" />);
    expect(screen.getByTestId('product-relationships-panel')).toBeInTheDocument();
  });

  it('does not render in CONSULTANT mode', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    render(<ProductRelationshipsPanel templateId="tpl-1" />);
    expect(screen.queryByTestId('product-relationships-panel')).not.toBeInTheDocument();
  });

  it('displays relationships after fetching', async () => {
    render(<ProductRelationshipsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('relationship-item-comp-1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('relationship-item-comp-2')).toBeInTheDocument();
    expect(screen.getByTestId('relationship-item-comp-3')).toBeInTheDocument();
  });

  it('shows correct relationship type badges', async () => {
    render(<ProductRelationshipsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('relationship-type-comp-1')).toHaveTextContent('REQUIRES');
    });

    expect(screen.getByTestId('relationship-type-comp-2')).toHaveTextContent('COMPATIBLE_WITH');
    expect(screen.getByTestId('relationship-type-comp-3')).toHaveTextContent('ALTERNATIVE_TO');
  });

  it('shows directionality indicators', async () => {
    render(<ProductRelationshipsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('relationship-item-comp-1')).toBeInTheDocument();
    });

    // UNIDIRECTIONAL uses right arrow
    const item1 = screen.getByTestId('relationship-item-comp-1');
    expect(item1.textContent).toContain('\u2192');

    // BIDIRECTIONAL uses double arrow
    const item2 = screen.getByTestId('relationship-item-comp-2');
    expect(item2.textContent).toContain('\u2194');
  });

  it('shows mandatory flag for mandatory relationships', async () => {
    render(<ProductRelationshipsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('relationship-item-comp-1')).toBeInTheDocument();
    });

    // comp-1 is mandatory
    expect(screen.getByText('MANDATORY')).toBeInTheDocument();
  });

  it('shows empty state when no relationships exist', async () => {
    mockOr.mockResolvedValue({ data: [], error: null });

    render(<ProductRelationshipsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('no-relationships-msg')).toBeInTheDocument();
    });
  });

  it('opens dialog on add button click', async () => {
    render(<ProductRelationshipsPanel templateId="tpl-1" />);

    fireEvent.click(screen.getByTestId('add-relationship-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('add-relationship-dialog')).toBeInTheDocument();
    });
  });

  it('removes a relationship on remove button click', async () => {
    render(<ProductRelationshipsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('relationship-item-comp-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('remove-relationship-comp-1'));

    await waitFor(() => {
      expect(screen.queryByTestId('relationship-item-comp-1')).not.toBeInTheDocument();
    });

    expect(mockDeleteEq).toHaveBeenCalledWith('compatibility_id', 'comp-1');
  });

  it('shows add button', () => {
    render(<ProductRelationshipsPanel templateId="tpl-1" />);
    expect(screen.getByTestId('add-relationship-btn')).toBeInTheDocument();
  });
});

describe('AddRelationshipDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockIlike.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        range: mockRange,
      }),
    });
    mockRange.mockResolvedValue({
      data: [
        {
          sku_id: 'sku-a',
          sku_code: 'SKU-A-001',
          product_type: 'LED_STRIP',
          material: 'Aluminium',
          status: 'ACTIVE',
        },
        {
          sku_id: 'sku-b',
          sku_code: 'SKU-B-002',
          product_type: 'PROFILE',
          material: 'Steel',
          status: 'ACTIVE',
        },
      ],
      error: null,
    });
  });

  it('renders the dialog with all form fields', () => {
    render(<AddRelationshipDialog onClose={vi.fn()} onAdded={vi.fn()} />);

    expect(screen.getByTestId('add-relationship-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('source-sku-search')).toBeInTheDocument();
    expect(screen.getByTestId('target-sku-search')).toBeInTheDocument();
    expect(screen.getByTestId('relationship-type-select')).toBeInTheDocument();
    expect(screen.getByTestId('directionality-select')).toBeInTheDocument();
    expect(screen.getByTestId('mandatory-checkbox')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-btn')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
  });

  it('shows validation error when source and target are the same', async () => {
    render(<AddRelationshipDialog onClose={vi.fn()} onAdded={vi.fn()} />);

    // Search and select same SKU for source and target
    fireEvent.change(screen.getByTestId('source-sku-search'), { target: { value: 'SKU' } });

    await waitFor(() => {
      expect(screen.getByTestId('source-sku-option-sku-a')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('source-sku-option-sku-a'));

    fireEvent.change(screen.getByTestId('target-sku-search'), { target: { value: 'SKU' } });

    await waitFor(() => {
      expect(screen.getByTestId('target-sku-option-sku-a')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('target-sku-option-sku-a'));

    fireEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('validation-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('validation-error')).toHaveTextContent('Source and target SKU must be different.');
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    render(<AddRelationshipDialog onClose={onClose} onAdded={vi.fn()} />);

    fireEvent.click(screen.getByTestId('cancel-btn'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows write error on insert failure', async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: 'Insert failed' } });

    render(<AddRelationshipDialog onClose={vi.fn()} onAdded={vi.fn()} />);

    // Select different source and target
    fireEvent.change(screen.getByTestId('source-sku-search'), { target: { value: 'SKU' } });
    await waitFor(() => {
      expect(screen.getByTestId('source-sku-option-sku-a')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('source-sku-option-sku-a'));

    fireEvent.change(screen.getByTestId('target-sku-search'), { target: { value: 'SKU' } });
    await waitFor(() => {
      expect(screen.getByTestId('target-sku-option-sku-b')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('target-sku-option-sku-b'));

    fireEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('write-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('write-error')).toHaveTextContent('Insert failed');
  });
});
