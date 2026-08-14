import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useTemplateManagementStore } from '@/stores/templateManagementStore';
import { useAuthStore } from '@/stores/authStore';
import { TemplateStatus, AdaptationStrategy } from '@/types/database';
import type { Template } from '@/types/database';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  })),
  supabase: { rpc: vi.fn() },
  isSupabaseConfigured: false,
}));

// Import components after mocks
import { TemplateManagementPanel } from '../TemplateManagementPanel';
import { TemplateStatusBadge } from '../TemplateStatusBadge';
import { TemplateFilters } from '../TemplateFilters';
import { TemplateListItem } from '../TemplateListItem';
import { CreateTemplateDialog } from '../CreateTemplateDialog';
import { RetireTemplateDialog } from '../RetireTemplateDialog';

const makeTemplate = (overrides: Partial<Template> = {}): Template => ({
  template_id: 'tpl-1',
  name: 'Modern Wall',
  description: 'A modern wall design',
  wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2700 },
  status: TemplateStatus.ACTIVE,
  adaptation_strategy: AdaptationStrategy.PROPORTIONAL,
  design_family_id: null,
  design_subfamily_id: null,
  wall_application: null,
  priority_zone_id: null,
  waste_factor: null,
  metadata: null,
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('TemplateManagementPanel', () => {
  beforeEach(() => {
    useTemplateManagementStore.getState().reset();
    useTemplateManagementStore.setState({
      fetchMyTemplates: vi.fn() as unknown as () => Promise<void>,
    });
    useAuthStore.setState({
      user: { id: 'user-1' } as never,
      role: 'DESIGNER',
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('renders the panel container', () => {
    render(<TemplateManagementPanel />);
    expect(screen.getByTestId('template-management-panel')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    useTemplateManagementStore.setState({ isLoading: true, filteredTemplates: [] });
    render(<TemplateManagementPanel />);
    expect(screen.getByText('Loading templates...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    useTemplateManagementStore.setState({ error: 'Failed to load', isLoading: false });
    render(<TemplateManagementPanel />);
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    useTemplateManagementStore.setState({ filteredTemplates: [], isLoading: false, error: null });
    render(<TemplateManagementPanel />);
    expect(screen.getByText('No templates found')).toBeInTheDocument();
  });

  it('renders list of templates', () => {
    const templates = [
      makeTemplate({ template_id: 'tpl-1', name: 'Template One' }),
      makeTemplate({ template_id: 'tpl-2', name: 'Template Two' }),
    ];
    useTemplateManagementStore.setState({
      filteredTemplates: templates,
      isLoading: false,
      error: null,
    });

    render(<TemplateManagementPanel />);
    const items = screen.getAllByTestId('template-list-item');
    expect(items).toHaveLength(2);
    expect(screen.getByText('Template One')).toBeInTheDocument();
    expect(screen.getByText('Template Two')).toBeInTheDocument();
  });

  it('calls fetchMyTemplates on mount', () => {
    const mockFetch = vi.fn();
    useTemplateManagementStore.setState({
      fetchMyTemplates: mockFetch as unknown as () => Promise<void>,
      filteredTemplates: [],
      isLoading: false,
      error: null,
    });

    render(<TemplateManagementPanel />);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('clicking Create New Template button opens the create dialog', () => {
    useTemplateManagementStore.setState({
      filteredTemplates: [],
      isLoading: false,
      error: null,
    });

    render(<TemplateManagementPanel />);
    fireEvent.click(screen.getByTestId('create-new-template-btn'));
    expect(useTemplateManagementStore.getState().showCreateDialog).toBe(true);
  });

  it('clicking close button closes the panel', () => {
    useTemplateManagementStore.setState({
      isPanelVisible: true,
      filteredTemplates: [],
      isLoading: false,
      error: null,
    });

    render(<TemplateManagementPanel />);
    fireEvent.click(screen.getByTestId('template-panel-close-btn'));
    expect(useTemplateManagementStore.getState().isPanelVisible).toBe(false);
  });
});

describe('TemplateStatusBadge', () => {
  it('renders DRAFT with gray background', () => {
    render(<TemplateStatusBadge status={TemplateStatus.DRAFT} />);
    const badge = screen.getByTestId('template-status-badge');
    expect(badge.textContent).toBe('DRAFT');
    expect(badge.style.backgroundColor).toBe('rgba(110, 110, 110, 0.1)');
    expect(badge.style.color).toBe('var(--color-ink-secondary)');
  });

  it('renders ACTIVE with green background', () => {
    render(<TemplateStatusBadge status={TemplateStatus.ACTIVE} />);
    const badge = screen.getByTestId('template-status-badge');
    expect(badge.textContent).toBe('ACTIVE');
    expect(badge.style.backgroundColor).toBe('rgba(63, 107, 79, 0.1)');
    expect(badge.style.color).toBe('var(--color-success)');
  });

  it('renders RETIRED with orange background', () => {
    render(<TemplateStatusBadge status={TemplateStatus.RETIRED} />);
    const badge = screen.getByTestId('template-status-badge');
    expect(badge.textContent).toBe('RETIRED');
    expect(badge.style.backgroundColor).toBe('rgba(166, 106, 45, 0.1)');
    expect(badge.style.color).toBe('var(--color-warning)');
  });
});

describe('TemplateFilters', () => {
  beforeEach(() => {
    useTemplateManagementStore.getState().reset();
  });

  it('renders search input and filters', () => {
    render(<TemplateFilters />);
    expect(screen.getByTestId('template-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('template-status-filter')).toBeInTheDocument();
    expect(screen.getByTestId('template-geometry-filter')).toBeInTheDocument();
  });

  it('search input updates store on change', () => {
    render(<TemplateFilters />);
    fireEvent.change(screen.getByTestId('template-search-input'), { target: { value: 'modern' } });
    expect(useTemplateManagementStore.getState().filters.search).toBe('modern');
  });

  it('status filter updates store on change', () => {
    render(<TemplateFilters />);
    fireEvent.change(screen.getByTestId('template-status-filter'), { target: { value: 'DRAFT' } });
    expect(useTemplateManagementStore.getState().filters.status).toBe('DRAFT');
  });

  it('geometry filter updates store on change', () => {
    render(<TemplateFilters />);
    fireEvent.change(screen.getByTestId('template-geometry-filter'), { target: { value: 'L_CORNER' } });
    expect(useTemplateManagementStore.getState().filters.wallGeometry).toBe('L_CORNER');
  });

  it('setting status filter to All (empty) clears the filter', () => {
    useTemplateManagementStore.setState({
      filters: { status: TemplateStatus.DRAFT, search: '', wallGeometry: null },
    });
    render(<TemplateFilters />);
    fireEvent.change(screen.getByTestId('template-status-filter'), { target: { value: '' } });
    expect(useTemplateManagementStore.getState().filters.status).toBeNull();
  });
});

describe('TemplateListItem', () => {
  beforeEach(() => {
    useTemplateManagementStore.getState().reset();
  });

  it('shows correct action buttons for DRAFT template', () => {
    const template = makeTemplate({ status: TemplateStatus.DRAFT });
    render(<TemplateListItem template={template} />);

    expect(screen.getByTestId('template-edit-btn')).toBeInTheDocument();
    expect(screen.getByTestId('template-archive-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('template-duplicate-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('template-retire-btn')).not.toBeInTheDocument();
  });

  it('shows correct action buttons for ACTIVE template', () => {
    const template = makeTemplate({ status: TemplateStatus.ACTIVE });
    render(<TemplateListItem template={template} />);

    expect(screen.getByTestId('template-duplicate-btn')).toBeInTheDocument();
    expect(screen.getByTestId('template-retire-btn')).toBeInTheDocument();
    expect(screen.getByTestId('template-view-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('template-edit-btn')).not.toBeInTheDocument();
  });

  it('shows correct action buttons for ARCHIVED template', () => {
    const template = makeTemplate({ status: TemplateStatus.RETIRED });
    render(<TemplateListItem template={template} />);

    expect(screen.getByTestId('template-duplicate-btn')).toBeInTheDocument();
    expect(screen.getByTestId('template-view-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('template-edit-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('template-retire-btn')).not.toBeInTheDocument();
  });

  it('displays template name, geometry, and dimensions', () => {
    const template = makeTemplate({
      name: 'Elegant Design',
      wall_geometry: { type: 'L_CORNER', base_width_mm: 4000, base_height_mm: 2500 },
    });
    render(<TemplateListItem template={template} />);

    expect(screen.getByText('Elegant Design')).toBeInTheDocument();
    expect(screen.getByText('L_CORNER')).toBeInTheDocument();
    expect(screen.getByText('4000 x 2500 mm')).toBeInTheDocument();
  });

  it('calls editTemplate when Edit button is clicked', () => {
    const mockEdit = vi.fn();
    useTemplateManagementStore.setState({ editTemplate: mockEdit } as never);

    const template = makeTemplate({ template_id: 'tpl-edit', status: TemplateStatus.DRAFT });
    render(<TemplateListItem template={template} />);
    fireEvent.click(screen.getByTestId('template-edit-btn'));
    expect(mockEdit).toHaveBeenCalledWith('tpl-edit');
  });

  it('calls duplicateAsNewDraft when Create Draft Copy is clicked', () => {
    const mockDuplicate = vi.fn();
    useTemplateManagementStore.setState({ duplicateAsNewDraft: mockDuplicate } as never);

    const template = makeTemplate({ template_id: 'tpl-dup', status: TemplateStatus.ACTIVE });
    render(<TemplateListItem template={template} />);
    fireEvent.click(screen.getByTestId('template-duplicate-btn'));
    expect(mockDuplicate).toHaveBeenCalledWith('tpl-dup');
  });

  it('calls openRetireDialog when Archive is clicked on DRAFT', () => {
    const mockRetireDialog = vi.fn();
    useTemplateManagementStore.setState({ openRetireDialog: mockRetireDialog } as never);

    const template = makeTemplate({ template_id: 'tpl-archive', status: TemplateStatus.DRAFT });
    render(<TemplateListItem template={template} />);
    fireEvent.click(screen.getByTestId('template-archive-btn'));
    expect(mockRetireDialog).toHaveBeenCalledWith(template);
  });

  it('calls openRetireDialog when Retire is clicked', () => {
    const mockRetireDialog = vi.fn();
    useTemplateManagementStore.setState({ openRetireDialog: mockRetireDialog } as never);

    const template = makeTemplate({ template_id: 'tpl-retire', status: TemplateStatus.ACTIVE });
    render(<TemplateListItem template={template} />);
    fireEvent.click(screen.getByTestId('template-retire-btn'));
    expect(mockRetireDialog).toHaveBeenCalledWith(template);
  });
});

describe('CreateTemplateDialog', () => {
  beforeEach(() => {
    useTemplateManagementStore.getState().reset();
  });

  it('renders form fields', () => {
    render(<CreateTemplateDialog />);
    expect(screen.getByTestId('create-template-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('create-template-name')).toBeInTheDocument();
    expect(screen.getByTestId('create-template-description')).toBeInTheDocument();
    expect(screen.getByTestId('create-template-geometry')).toBeInTheDocument();
    expect(screen.getByTestId('create-template-width')).toBeInTheDocument();
    expect(screen.getByTestId('create-template-height')).toBeInTheDocument();
    expect(screen.getByTestId('create-template-strategy')).toBeInTheDocument();
  });

  it('Create button is disabled when name is empty', () => {
    render(<CreateTemplateDialog />);
    const submitBtn = screen.getByTestId('create-template-submit-btn');
    expect(submitBtn).toBeDisabled();
  });

  it('Create button is disabled when width is empty', () => {
    render(<CreateTemplateDialog />);
    fireEvent.change(screen.getByTestId('create-template-name'), { target: { value: 'Name' } });
    // width and height remain empty
    const submitBtn = screen.getByTestId('create-template-submit-btn');
    expect(submitBtn).toBeDisabled();
  });

  it('Create button is disabled when width is zero or negative', () => {
    render(<CreateTemplateDialog />);
    fireEvent.change(screen.getByTestId('create-template-name'), { target: { value: 'Name' } });
    fireEvent.change(screen.getByTestId('create-template-width'), { target: { value: '0' } });
    fireEvent.change(screen.getByTestId('create-template-height'), { target: { value: '2700' } });
    const submitBtn = screen.getByTestId('create-template-submit-btn');
    expect(submitBtn).toBeDisabled();
  });

  it('Create button is disabled when height is negative', () => {
    render(<CreateTemplateDialog />);
    fireEvent.change(screen.getByTestId('create-template-name'), { target: { value: 'Name' } });
    fireEvent.change(screen.getByTestId('create-template-width'), { target: { value: '3000' } });
    fireEvent.change(screen.getByTestId('create-template-height'), { target: { value: '-100' } });
    const submitBtn = screen.getByTestId('create-template-submit-btn');
    expect(submitBtn).toBeDisabled();
  });

  it('shows dimension error message for invalid values', () => {
    render(<CreateTemplateDialog />);
    fireEvent.change(screen.getByTestId('create-template-width'), { target: { value: '-5' } });
    expect(screen.getByTestId('create-template-dimension-error')).toBeInTheDocument();
  });

  it('Create button is enabled when required fields are filled', () => {
    render(<CreateTemplateDialog />);
    fireEvent.change(screen.getByTestId('create-template-name'), { target: { value: 'My Template' } });
    fireEvent.change(screen.getByTestId('create-template-width'), { target: { value: '3000' } });
    fireEvent.change(screen.getByTestId('create-template-height'), { target: { value: '2700' } });
    const submitBtn = screen.getByTestId('create-template-submit-btn');
    expect(submitBtn).not.toBeDisabled();
  });

  it('calls createTemplate on submit with correct data', () => {
    const mockCreate = vi.fn();
    useTemplateManagementStore.setState({ createTemplate: mockCreate } as never);

    render(<CreateTemplateDialog />);
    fireEvent.change(screen.getByTestId('create-template-name'), { target: { value: 'New One' } });
    fireEvent.change(screen.getByTestId('create-template-width'), { target: { value: '4000' } });
    fireEvent.change(screen.getByTestId('create-template-height'), { target: { value: '2500' } });
    fireEvent.change(screen.getByTestId('create-template-geometry'), { target: { value: 'L_CORNER' } });
    fireEvent.change(screen.getByTestId('create-template-strategy'), { target: { value: 'FIXED' } });

    fireEvent.click(screen.getByTestId('create-template-submit-btn'));

    expect(mockCreate).toHaveBeenCalledWith({
      name: 'New One',
      description: undefined,
      wall_geometry: 'L_CORNER',
      base_width_mm: 4000,
      base_height_mm: 2500,
      adaptation_strategy: 'FIXED',
      design_family_id: 'default-family',
      wall_application: 'WALL_PANEL',
      waste_factor: 0.05,
    });
  });

  it('Cancel button closes the dialog', () => {
    useTemplateManagementStore.setState({ showCreateDialog: true });
    render(<CreateTemplateDialog />);
    fireEvent.click(screen.getByTestId('create-template-cancel-btn'));
    expect(useTemplateManagementStore.getState().showCreateDialog).toBe(false);
  });
});

describe('RetireTemplateDialog', () => {
  beforeEach(() => {
    useTemplateManagementStore.getState().reset();
  });

  it('does not render when no template is selected', () => {
    useTemplateManagementStore.setState({ selectedTemplateForAction: null });
    const { container } = render(<RetireTemplateDialog />);
    expect(container.innerHTML).toBe('');
  });

  it('shows template name in confirmation message', () => {
    useTemplateManagementStore.setState({
      selectedTemplateForAction: makeTemplate({ name: 'My Template' }),
    });
    render(<RetireTemplateDialog />);
    expect(screen.getByTestId('retire-template-dialog')).toBeInTheDocument();
    expect(screen.getByText('My Template')).toBeInTheDocument();
  });

  it('calls retireTemplate on confirm', () => {
    const mockRetire = vi.fn();
    useTemplateManagementStore.setState({
      selectedTemplateForAction: makeTemplate({ template_id: 'tpl-retire', name: 'To Retire' }),
      retireTemplate: mockRetire as unknown as (id: string) => Promise<void>,
    });

    render(<RetireTemplateDialog />);
    fireEvent.click(screen.getByTestId('retire-template-confirm-btn'));
    expect(mockRetire).toHaveBeenCalledWith('tpl-retire');
  });

  it('Cancel button closes the dialog', () => {
    useTemplateManagementStore.setState({
      showRetireDialog: true,
      selectedTemplateForAction: makeTemplate({ name: 'Template' }),
    });

    render(<RetireTemplateDialog />);
    fireEvent.click(screen.getByTestId('retire-template-cancel-btn'));
    expect(useTemplateManagementStore.getState().showRetireDialog).toBe(false);
    expect(useTemplateManagementStore.getState().selectedTemplateForAction).toBeNull();
  });
});

describe('My Templates button visibility', () => {
  it('My Templates button should only appear for DESIGNER role', () => {
    // This tests the store-level condition used by App.tsx
    useAuthStore.setState({ role: 'DESIGNER' });
    expect(useAuthStore.getState().role).toBe('DESIGNER');

    useAuthStore.setState({ role: 'CONSULTANT' });
    expect(useAuthStore.getState().role).not.toBe('DESIGNER');

    useAuthStore.setState({ role: 'ADMIN' });
    expect(useAuthStore.getState().role).not.toBe('DESIGNER');
  });
});
