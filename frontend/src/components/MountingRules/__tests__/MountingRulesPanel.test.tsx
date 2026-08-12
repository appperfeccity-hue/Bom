import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasMode } from '@/types/database';

const mockSelect = vi.fn().mockReturnThis();
const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  fromTable: vi.fn((table: string) => {
    if (table === 'template_lighting') {
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
import { MountingRulesPanel } from '../MountingRulesPanel';

describe('MountingRulesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCanvasStore.setState({ mode: CanvasMode.DESIGNER });

    mockSelect.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            lighting_id: 'lt-1',
            template_id: 'tpl-1',
            sku_id: 'SKU-LED-001',
            edge_selection: 'TOP',
            mounting_type: 'DIRECT',
            quantity_rule: null,
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            lighting_id: 'lt-2',
            template_id: 'tpl-1',
            sku_id: 'SKU-LED-002',
            edge_selection: 'BOTTOM',
            mounting_type: 'PROFILE',
            quantity_rule: 'PER_ZONE',
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            lighting_id: 'lt-3',
            template_id: 'tpl-1',
            sku_id: 'SKU-LED-003',
            edge_selection: 'LEFT',
            mounting_type: 'COVE',
            quantity_rule: null,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        error: null,
      }),
    });
  });

  it('renders panel in DESIGNER mode', async () => {
    render(<MountingRulesPanel templateId="tpl-1" />);
    expect(screen.getByTestId('mounting-rules-panel')).toBeInTheDocument();
  });

  it('does not render in CONSULTANT mode', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    render(<MountingRulesPanel templateId="tpl-1" />);
    expect(screen.queryByTestId('mounting-rules-panel')).not.toBeInTheDocument();
  });

  it('displays mounting rule items after fetching', async () => {
    render(<MountingRulesPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('mounting-rule-item-lt-1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('mounting-rule-item-lt-2')).toBeInTheDocument();
    expect(screen.getByTestId('mounting-rule-item-lt-3')).toBeInTheDocument();
  });

  it('displays correct mounting type badges', async () => {
    render(<MountingRulesPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('mounting-type-lt-1')).toHaveTextContent('DIRECT');
    });

    expect(screen.getByTestId('mounting-type-lt-2')).toHaveTextContent('PROFILE');
    expect(screen.getByTestId('mounting-type-lt-3')).toHaveTextContent('COVE');
  });

  it('shows correct gap info for DIRECT (0mm)', async () => {
    render(<MountingRulesPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('mounting-rule-item-lt-1')).toBeInTheDocument();
    });

    const item = screen.getByTestId('mounting-rule-item-lt-1');
    expect(item).toHaveTextContent('Gap: 0mm');
    expect(item).toHaveTextContent('Structure: Not required');
  });

  it('shows correct gap info for PROFILE (0mm, no structure)', async () => {
    render(<MountingRulesPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('mounting-rule-item-lt-2')).toBeInTheDocument();
    });

    const item = screen.getByTestId('mounting-rule-item-lt-2');
    expect(item).toHaveTextContent('Gap: 0mm');
    expect(item).toHaveTextContent('Structure: Not required');
  });

  it('shows correct gap info for COVE (10mm, structure required)', async () => {
    render(<MountingRulesPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('mounting-rule-item-lt-3')).toBeInTheDocument();
    });

    const item = screen.getByTestId('mounting-rule-item-lt-3');
    expect(item).toHaveTextContent('Gap: 10mm');
    expect(item).toHaveTextContent('Structure: Required');
  });

  it('shows empty state message when no rules exist', async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    render(<MountingRulesPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('no-mounting-rules-msg')).toBeInTheDocument();
    });
  });

  it('shows add button', () => {
    render(<MountingRulesPanel templateId="tpl-1" />);
    expect(screen.getByTestId('add-mounting-rule-btn')).toBeInTheDocument();
  });

  it('opens dialog on add button click', async () => {
    render(<MountingRulesPanel templateId="tpl-1" />);
    fireEvent.click(screen.getByTestId('add-mounting-rule-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('add-mounting-rule-dialog')).toBeInTheDocument();
    });
  });

  it('dialog shows gap and structure info panel', async () => {
    render(<MountingRulesPanel templateId="tpl-1" />);
    fireEvent.click(screen.getByTestId('add-mounting-rule-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('gap-info')).toBeInTheDocument();
    });

    expect(screen.getByTestId('structure-info')).toBeInTheDocument();
  });

  it('dialog shows correct default info for DIRECT', async () => {
    render(<MountingRulesPanel templateId="tpl-1" />);
    fireEvent.click(screen.getByTestId('add-mounting-rule-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('gap-info')).toHaveTextContent('0mm');
    });

    expect(screen.getByTestId('structure-info')).toHaveTextContent('Not required');
  });

  it('dialog updates info when mounting type changes to COVE', async () => {
    render(<MountingRulesPanel templateId="tpl-1" />);
    fireEvent.click(screen.getByTestId('add-mounting-rule-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('mounting-type-select')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('mounting-type-select'), { target: { value: 'COVE' } });

    expect(screen.getByTestId('gap-info')).toHaveTextContent('10mm');
    expect(screen.getByTestId('structure-info')).toHaveTextContent('Required');
  });

  it('displays edge selection for each rule', async () => {
    render(<MountingRulesPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('mounting-rule-item-lt-1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('mounting-rule-item-lt-1')).toHaveTextContent('Edge: TOP');
    expect(screen.getByTestId('mounting-rule-item-lt-2')).toHaveTextContent('Edge: BOTTOM');
    expect(screen.getByTestId('mounting-rule-item-lt-3')).toHaveTextContent('Edge: LEFT');
  });
});
