import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasMode } from '@/types/database';

const mockSelect = vi.fn().mockReturnThis();
const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  fromTable: vi.fn((table: string) => {
    if (table === 'template_hidden_component') {
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
import { HiddenComponentsPanel } from '../HiddenComponentsPanel';

describe('HiddenComponentsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCanvasStore.setState({ mode: CanvasMode.DESIGNER });

    mockSelect.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'hc-1',
            template_id: 'tpl-1',
            sku_id: 'SKU-BRACKET-001',
            trigger_type: 'ALWAYS',
            condition: null,
            quantity_rule: 'PER_ZONE',
            fixed_value: 2,
            created_by: 'user-1',
          },
          {
            id: 'hc-2',
            template_id: 'tpl-1',
            sku_id: 'SKU-CLIP-002',
            trigger_type: 'CONDITION',
            condition: { field: 'zone_count', operator: 'GT', value: 3 },
            quantity_rule: 'FIXED',
            fixed_value: 4,
            created_by: 'user-1',
          },
          {
            id: 'hc-3',
            template_id: 'tpl-1',
            sku_id: 'SKU-SEAL-003',
            trigger_type: 'DEPENDENCY',
            condition: null,
            quantity_rule: 'DERIVED_FROM_PARENT',
            fixed_value: null,
            created_by: 'user-1',
          },
        ],
        error: null,
      }),
    });
  });

  it('renders panel in DESIGNER mode', async () => {
    render(<HiddenComponentsPanel templateId="tpl-1" />);
    expect(screen.getByTestId('hidden-components-panel')).toBeInTheDocument();
  });

  it('does not render in CONSULTANT mode', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    render(<HiddenComponentsPanel templateId="tpl-1" />);
    expect(screen.queryByTestId('hidden-components-panel')).not.toBeInTheDocument();
  });

  it('displays hidden components list after fetching', async () => {
    render(<HiddenComponentsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('hidden-component-item-hc-1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('hidden-component-item-hc-2')).toBeInTheDocument();
    expect(screen.getByTestId('hidden-component-item-hc-3')).toBeInTheDocument();
  });

  it('displays trigger types correctly', async () => {
    render(<HiddenComponentsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('trigger-type-hc-1')).toHaveTextContent('ALWAYS');
    });

    expect(screen.getByTestId('trigger-type-hc-2')).toHaveTextContent('CONDITION');
    expect(screen.getByTestId('trigger-type-hc-3')).toHaveTextContent('DEPENDENCY');
  });

  it('displays condition details for CONDITION trigger', async () => {
    render(<HiddenComponentsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByText(/zone_count GT 3/)).toBeInTheDocument();
    });
  });

  it('displays "Always included" for ALWAYS trigger', async () => {
    render(<HiddenComponentsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Always included/)).toBeInTheDocument();
    });
  });

  it('displays "Depends on parent" for DEPENDENCY trigger', async () => {
    render(<HiddenComponentsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Depends on parent/)).toBeInTheDocument();
    });
  });

  it('shows add button', () => {
    render(<HiddenComponentsPanel templateId="tpl-1" />);
    expect(screen.getByTestId('add-hidden-component-btn')).toBeInTheDocument();
  });

  it('opens dialog on add button click', async () => {
    render(<HiddenComponentsPanel templateId="tpl-1" />);
    fireEvent.click(screen.getByTestId('add-hidden-component-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('add-hidden-component-dialog')).toBeInTheDocument();
    });
  });

  it('shows empty state message when no components exist', async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    render(<HiddenComponentsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('no-hidden-components-msg')).toBeInTheDocument();
    });
  });

  it('displays quantity rule and fixed value', async () => {
    render(<HiddenComponentsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Rule: PER_ZONE/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Rule: FIXED/)).toBeInTheDocument();
    expect(screen.getByText(/Rule: DERIVED_FROM_PARENT/)).toBeInTheDocument();
  });
});
