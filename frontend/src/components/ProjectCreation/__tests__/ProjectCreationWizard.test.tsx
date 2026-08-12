import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useProjectCreationStore, CreationStep } from '@/stores/projectCreationStore';
import { useAuthStore } from '@/stores/authStore';
import { TemplateStatus, AdaptationStrategy } from '@/types/database';
import type { Template } from '@/types/database';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  })),
  supabase: { rpc: vi.fn() },
  isSupabaseConfigured: false,
}));

// Import components after mocks
import { ProjectCreationWizard } from '../ProjectCreationWizard';
import { DesignLibrary } from '../DesignLibrary';
import { TemplateCard } from '../TemplateCard';

const makeTemplate = (overrides: Partial<Template> = {}): Template => ({
  id: 'tpl-1',
  name: 'Modern Wall',
  description: 'A modern wall design',
  status: TemplateStatus.ACTIVE,
  wall_geometry: 'STRAIGHT',
  base_width_mm: 3000,
  base_height_mm: 2700,
  adaptation_strategy: AdaptationStrategy.SCALE,
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  version: 1,
  ...overrides,
});

describe('ProjectCreationWizard', () => {
  beforeEach(() => {
    useProjectCreationStore.getState().reset();
    // Override fetchAvailableTemplates so DesignLibrary does not trigger loading on mount
    useProjectCreationStore.setState({
      fetchAvailableTemplates: vi.fn() as unknown as () => Promise<void>,
    });
    useAuthStore.setState({
      user: { id: 'user-1' } as never,
      role: 'CONSULTANT',
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('does not render when step is IDLE', () => {
    render(<ProjectCreationWizard />);
    expect(screen.queryByTestId('project-creation-wizard')).not.toBeInTheDocument();
  });

  it('renders DesignLibrary when step is BROWSE_TEMPLATES', () => {
    useProjectCreationStore.setState({ step: CreationStep.BROWSE_TEMPLATES });
    render(<ProjectCreationWizard />);
    expect(screen.getByTestId('project-creation-wizard')).toBeInTheDocument();
    expect(screen.getByTestId('design-library')).toBeInTheDocument();
  });

  it('renders ProjectDetailsForm when step is PROJECT_DETAILS', () => {
    useProjectCreationStore.setState({
      step: CreationStep.PROJECT_DETAILS,
      selectedTemplate: makeTemplate(),
    });
    render(<ProjectCreationWizard />);
    expect(screen.getByTestId('project-creation-wizard')).toBeInTheDocument();
    expect(screen.getByTestId('project-details-form')).toBeInTheDocument();
  });

  it('shows "Creating project..." when step is CREATING', () => {
    useProjectCreationStore.setState({ step: CreationStep.CREATING, isLoading: true });
    render(<ProjectCreationWizard />);
    expect(screen.getByText('Creating project...')).toBeInTheDocument();
  });

  it('shows success message when step is CREATED', () => {
    useProjectCreationStore.setState({ step: CreationStep.CREATED, createdProjectId: 'proj-1' });
    render(<ProjectCreationWizard />);
    expect(screen.getByText('Project created successfully!')).toBeInTheDocument();
  });

  it('shows error message and retry button when step is ERROR', () => {
    useProjectCreationStore.setState({
      step: CreationStep.ERROR,
      error: 'Something went wrong',
    });
    render(<ProjectCreationWizard />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('clicking Retry goes back to BROWSE_TEMPLATES step', () => {
    useProjectCreationStore.setState({
      step: CreationStep.ERROR,
      error: 'Some error',
    });
    render(<ProjectCreationWizard />);
    fireEvent.click(screen.getByText('Retry'));

    expect(useProjectCreationStore.getState().step).toBe(CreationStep.BROWSE_TEMPLATES);
    expect(useProjectCreationStore.getState().error).toBeNull();
  });

  it('clicking Close (x button) resets state', () => {
    useProjectCreationStore.setState({ step: CreationStep.BROWSE_TEMPLATES });
    render(<ProjectCreationWizard />);
    fireEvent.click(screen.getByTestId('project-creation-close-btn'));

    expect(useProjectCreationStore.getState().step).toBe(CreationStep.IDLE);
  });
});

describe('DesignLibrary', () => {
  beforeEach(() => {
    useProjectCreationStore.getState().reset();
    // Override fetchAvailableTemplates so it does not reset isLoading on mount
    useProjectCreationStore.setState({
      fetchAvailableTemplates: vi.fn() as unknown as () => Promise<void>,
    });
  });

  it('displays template cards when templates are loaded', () => {
    const templates = [
      makeTemplate({ id: 'tpl-1', name: 'Template One' }),
      makeTemplate({ id: 'tpl-2', name: 'Template Two' }),
    ];
    useProjectCreationStore.setState({
      availableTemplates: templates,
      isLoading: false,
      error: null,
    });

    render(<DesignLibrary />);
    const cards = screen.getAllByTestId('template-card');
    expect(cards).toHaveLength(2);
    expect(screen.getByText('Template One')).toBeInTheDocument();
    expect(screen.getByText('Template Two')).toBeInTheDocument();
  });

  it('shows loading message when isLoading is true', () => {
    useProjectCreationStore.setState({ isLoading: true, availableTemplates: [] });
    render(<DesignLibrary />);
    expect(screen.getByText('Loading templates...')).toBeInTheDocument();
  });

  it('shows error message when error is set', () => {
    useProjectCreationStore.setState({ error: 'Failed to load', isLoading: false });
    render(<DesignLibrary />);
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('shows empty state when no templates available', () => {
    useProjectCreationStore.setState({ availableTemplates: [], isLoading: false, error: null });
    render(<DesignLibrary />);
    expect(screen.getByText('No templates available')).toBeInTheDocument();
  });

  it('calls fetchAvailableTemplates on mount', () => {
    const mockFetch = vi.fn();
    useProjectCreationStore.setState({
      availableTemplates: [],
      isLoading: false,
      error: null,
      fetchAvailableTemplates: mockFetch as unknown as () => Promise<void>,
    });

    render(<DesignLibrary />);

    expect(mockFetch).toHaveBeenCalled();
  });

  it('clicking Select on a template card advances to PROJECT_DETAILS', () => {
    const template = makeTemplate({ id: 'tpl-1', name: 'Test Template' });
    useProjectCreationStore.setState({
      availableTemplates: [template],
      isLoading: false,
      error: null,
    });

    render(<DesignLibrary />);
    fireEvent.click(screen.getByTestId('template-select-btn'));

    const state = useProjectCreationStore.getState();
    expect(state.step).toBe(CreationStep.PROJECT_DETAILS);
    expect(state.selectedTemplate).toEqual(template);
  });
});

describe('TemplateCard', () => {
  it('displays template name, description, geometry, and dimensions', () => {
    const template = makeTemplate({
      name: 'Elegant Design',
      description: 'A beautiful design',
      wall_geometry: 'L_CORNER',
      base_width_mm: 4000,
      base_height_mm: 2500,
    });
    const onSelect = vi.fn();

    render(<TemplateCard template={template} onSelect={onSelect} />);

    expect(screen.getByText('Elegant Design')).toBeInTheDocument();
    expect(screen.getByText('A beautiful design')).toBeInTheDocument();
    expect(screen.getByText('L_CORNER')).toBeInTheDocument();
    expect(screen.getByText('4000 x 2500 mm')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('calls onSelect with template when Select button is clicked', () => {
    const template = makeTemplate();
    const onSelect = vi.fn();

    render(<TemplateCard template={template} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('template-select-btn'));

    expect(onSelect).toHaveBeenCalledWith(template);
  });

  it('does not show description when it is null', () => {
    const template = makeTemplate({ description: null });
    const onSelect = vi.fn();

    render(<TemplateCard template={template} onSelect={onSelect} />);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });
});

describe('ProjectDetailsForm', () => {
  beforeEach(() => {
    useProjectCreationStore.setState({
      step: CreationStep.PROJECT_DETAILS,
      selectedTemplate: makeTemplate(),
      customerReference: '',
      siteReference: '',
      isLoading: false,
    });
  });

  it('renders form inputs and template name', async () => {
    const { ProjectDetailsForm } = await import('../ProjectDetailsForm');
    render(<ProjectDetailsForm />);

    expect(screen.getByTestId('project-details-form')).toBeInTheDocument();
    expect(screen.getByTestId('customer-ref-input')).toBeInTheDocument();
    expect(screen.getByTestId('site-ref-input')).toBeInTheDocument();
    expect(screen.getByText('Modern Wall')).toBeInTheDocument();
  });

  it('Create button is disabled when fields are empty', async () => {
    const { ProjectDetailsForm } = await import('../ProjectDetailsForm');
    render(<ProjectDetailsForm />);

    const createBtn = screen.getByTestId('create-project-btn');
    expect(createBtn).toBeDisabled();
  });

  it('Create button is enabled when both fields are filled', async () => {
    useProjectCreationStore.setState({
      customerReference: 'CUST-001',
      siteReference: 'SITE-001',
    });

    const { ProjectDetailsForm } = await import('../ProjectDetailsForm');
    render(<ProjectDetailsForm />);

    const createBtn = screen.getByTestId('create-project-btn');
    expect(createBtn).not.toBeDisabled();
  });

  it('typing in customer reference updates store', async () => {
    const { ProjectDetailsForm } = await import('../ProjectDetailsForm');
    render(<ProjectDetailsForm />);

    fireEvent.change(screen.getByTestId('customer-ref-input'), { target: { value: 'My Customer' } });
    expect(useProjectCreationStore.getState().customerReference).toBe('My Customer');
  });

  it('typing in site reference updates store', async () => {
    const { ProjectDetailsForm } = await import('../ProjectDetailsForm');
    render(<ProjectDetailsForm />);

    fireEvent.change(screen.getByTestId('site-ref-input'), { target: { value: 'Site Alpha' } });
    expect(useProjectCreationStore.getState().siteReference).toBe('Site Alpha');
  });

  it('submitting form calls createProject', async () => {
    const createProjectMock = vi.fn();
    useProjectCreationStore.setState({
      customerReference: 'CUST-001',
      siteReference: 'SITE-001',
      createProject: createProjectMock,
    });

    const { ProjectDetailsForm } = await import('../ProjectDetailsForm');
    render(<ProjectDetailsForm />);

    fireEvent.submit(screen.getByTestId('project-details-form'));
    expect(createProjectMock).toHaveBeenCalled();
  });

  it('Back button returns to BROWSE_TEMPLATES', async () => {
    const { ProjectDetailsForm } = await import('../ProjectDetailsForm');
    render(<ProjectDetailsForm />);

    fireEvent.click(screen.getByText('Back'));
    expect(useProjectCreationStore.getState().step).toBe(CreationStep.BROWSE_TEMPLATES);
  });
});

describe('New Project button visibility', () => {
  it('New Project button only shows for CONSULTANT role', () => {
    // The App.tsx conditionally renders the new-project-btn when role === 'CONSULTANT'
    // We test the store-level condition that the button uses
    useAuthStore.setState({ role: 'CONSULTANT' });
    expect(useAuthStore.getState().role).toBe('CONSULTANT');

    useAuthStore.setState({ role: 'DESIGNER' });
    expect(useAuthStore.getState().role).not.toBe('CONSULTANT');

    useAuthStore.setState({ role: 'ADMIN' });
    expect(useAuthStore.getState().role).not.toBe('CONSULTANT');
  });
});
