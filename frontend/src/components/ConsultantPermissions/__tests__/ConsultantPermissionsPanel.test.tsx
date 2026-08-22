import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasMode } from '@/types/database';

const mockSelect = vi.fn().mockReturnThis();
const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  fromTable: vi.fn((table: string) => {
    if (table === 'template_consultant_permission') {
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
import { ConsultantPermissionsPanel } from '../ConsultantPermissionsPanel';

describe('ConsultantPermissionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCanvasStore.setState({ mode: CanvasMode.DESIGNER });

    mockSelect.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            permission_id: 'perm-1',
            template_id: 'tpl-1',
            parameter_key: 'ZONE_WIDTH',
            parameter_type: 'DIMENSION',
            edit_mode: 'RESTRICTED',
            min_value: 200,
            max_value: 3000,
            allowed_values: null,
          },
          {
            permission_id: 'perm-2',
            template_id: 'tpl-1',
            parameter_key: 'ZONE_PRIMARY_SKU',
            parameter_type: 'SKU_SELECTION',
            edit_mode: 'LOCKED',
            min_value: null,
            max_value: null,
            allowed_values: null,
          },
          {
            permission_id: 'perm-3',
            template_id: 'tpl-1',
            parameter_key: 'LIGHT_MOUNTING_TYPE',
            parameter_type: 'OPTION',
            edit_mode: 'RESTRICTED',
            min_value: null,
            max_value: null,
            allowed_values: ['DIRECT', 'PROFILE', 'COVE'],
          },
        ],
        error: null,
      }),
    });
  });

  it('renders panel in DESIGNER mode', async () => {
    render(<ConsultantPermissionsPanel templateId="tpl-1" />);
    expect(screen.getByTestId('consultant-permissions-panel')).toBeInTheDocument();
  });

  it('does not render in CONSULTANT mode', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    render(<ConsultantPermissionsPanel templateId="tpl-1" />);
    expect(screen.queryByTestId('consultant-permissions-panel')).not.toBeInTheDocument();
  });

  it('displays permissions list after fetching', async () => {
    render(<ConsultantPermissionsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('permission-item-perm-1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('permission-item-perm-2')).toBeInTheDocument();
    expect(screen.getByTestId('permission-item-perm-3')).toBeInTheDocument();
  });

  it('displays canonical UPPERCASE parameter keys', async () => {
    render(<ConsultantPermissionsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByText('ZONE_WIDTH')).toBeInTheDocument();
    });

    expect(screen.getByText('ZONE_PRIMARY_SKU')).toBeInTheDocument();
    expect(screen.getByText('LIGHT_MOUNTING_TYPE')).toBeInTheDocument();
  });

  it('displays edit modes correctly', async () => {
    render(<ConsultantPermissionsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('permission-type-perm-1')).toHaveTextContent('RESTRICTED');
    });

    expect(screen.getByTestId('permission-type-perm-2')).toHaveTextContent('LOCKED');
    expect(screen.getByTestId('permission-type-perm-3')).toHaveTextContent('RESTRICTED');
  });

  it('displays min/max bounds for RESTRICTED dimensions', async () => {
    render(<ConsultantPermissionsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Range: 200 - 3000/)).toBeInTheDocument();
    });
  });

  it('displays constraint info for LOCKED type', async () => {
    render(<ConsultantPermissionsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByText(/No changes allowed/)).toBeInTheDocument();
    });
  });

  it('displays allowed values for RESTRICTED option fields', async () => {
    render(<ConsultantPermissionsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Values: DIRECT, PROFILE, COVE/)).toBeInTheDocument();
    });
  });

  it('shows add button', () => {
    render(<ConsultantPermissionsPanel templateId="tpl-1" />);
    expect(screen.getByTestId('add-permission-btn')).toBeInTheDocument();
  });

  it('opens dialog on add button click', async () => {
    render(<ConsultantPermissionsPanel templateId="tpl-1" />);
    fireEvent.click(screen.getByTestId('add-permission-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('add-permission-dialog')).toBeInTheDocument();
    });
  });

  it('shows empty state message when no permissions exist', async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    render(<ConsultantPermissionsPanel templateId="tpl-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('no-permissions-msg')).toBeInTheDocument();
    });
  });
});
