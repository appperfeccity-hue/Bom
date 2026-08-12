import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasMode } from '@/types/database';

const mockSelect = vi.fn().mockReturnThis();
const mockDelete = vi.fn().mockReturnThis();
const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  fromTable: vi.fn((table: string) => {
    if (table === 'template_zone') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              { id: 'zone-1', template_id: 'tpl-1', name: 'Zone A', x_mm: 0, y_mm: 0, width_mm: 600, height_mm: 2400, width_strategy: 'FIXED', height_strategy: 'FIXED', position_strategy: 'ABSOLUTE', z_index: 0, created_at: '2024-01-01', updated_at: '2024-01-01' },
              { id: 'zone-2', template_id: 'tpl-1', name: 'Zone B', x_mm: 600, y_mm: 0, width_mm: 600, height_mm: 2400, width_strategy: 'FIXED', height_strategy: 'FIXED', position_strategy: 'ABSOLUTE', z_index: 1, created_at: '2024-01-01', updated_at: '2024-01-01' },
            ],
            error: null,
          }),
        }),
      };
    }
    if (table === 'template_zone_alternative') {
      return {
        select: mockSelect,
        delete: mockDelete,
        insert: mockInsert,
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockReturnThis(),
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
import { PromotedAlternativesPanel } from '../PromotedAlternativesPanel';

describe('PromotedAlternativesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCanvasStore.setState({ mode: CanvasMode.DESIGNER });

    // Setup the chained mock for template_zone_alternative select
    mockSelect.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            zone_id: 'zone-1',
            sku_id: 'sku-001',
            sku_master: { sku_code: 'WP-OAK-001', product_type: 'WALL_PANEL' },
            template_zone: { name: 'Zone A' },
          },
          {
            zone_id: 'zone-2',
            sku_id: 'sku-002',
            sku_master: { sku_code: 'WP-BIRCH-002', product_type: 'WALL_PANEL' },
            template_zone: { name: 'Zone B' },
          },
        ],
        error: null,
      }),
    });

    mockDelete.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  it('renders panel in DESIGNER mode', async () => {
    render(<PromotedAlternativesPanel templateId="tpl-1" />);
    expect(screen.getByTestId('promoted-alternatives-panel')).toBeInTheDocument();
  });

  it('does not render in CONSULTANT mode', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    render(<PromotedAlternativesPanel templateId="tpl-1" />);
    expect(screen.queryByTestId('promoted-alternatives-panel')).not.toBeInTheDocument();
  });

  it('displays alternatives list after fetching', async () => {
    render(<PromotedAlternativesPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('alternative-item-zone-1-sku-001')).toBeInTheDocument();
    });

    expect(screen.getByTestId('alternative-item-zone-2-sku-002')).toBeInTheDocument();
    expect(screen.getByText(/WP-OAK-001/)).toBeInTheDocument();
    expect(screen.getByText(/WP-BIRCH-002/)).toBeInTheDocument();
  });

  it('shows add button', () => {
    render(<PromotedAlternativesPanel templateId="tpl-1" />);
    expect(screen.getByTestId('add-alternative-btn')).toBeInTheDocument();
  });

  it('opens dialog on add button click', async () => {
    render(<PromotedAlternativesPanel templateId="tpl-1" />);
    fireEvent.click(screen.getByTestId('add-alternative-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('add-alternative-dialog')).toBeInTheDocument();
    });
  });

  it('removes alternative on remove button click', async () => {
    render(<PromotedAlternativesPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('remove-alternative-zone-1-sku-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('remove-alternative-zone-1-sku-001'));

    await waitFor(() => {
      expect(screen.queryByTestId('alternative-item-zone-1-sku-001')).not.toBeInTheDocument();
    });
  });

  it('shows empty state message when no alternatives exist', async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    render(<PromotedAlternativesPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('no-alternatives-msg')).toBeInTheDocument();
    });
  });
});
