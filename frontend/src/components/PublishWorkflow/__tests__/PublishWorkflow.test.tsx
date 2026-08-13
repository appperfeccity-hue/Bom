import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { usePublishStore, PublishStep } from '@/stores/publishStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasMode, TemplateStatus, AdaptationStrategy, MasterBomStatus } from '@/types/database';
import type { Template, MasterBom } from '@/types/database';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {},
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
  isSupabaseConfigured: false,
}));

// Import after mocks
import { PublishWorkflow } from '../PublishWorkflow';
import { Toolbar } from '@/components/Toolbar';

const makeTemplate = (overrides: Partial<Template> = {}): Template => ({
  template_id: 'tpl-1',
  name: 'Test Template',
  description: null,
  design_family_id: null,
  design_subfamily_id: null,
  wall_application: null,
  wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2400 },
  adaptation_strategy: AdaptationStrategy.PROPORTIONAL,
  priority_zone_id: null,
  waste_factor: null,
  metadata: null,
  status: TemplateStatus.DRAFT,
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const mockBom: MasterBom = {
  master_bom_id: 'bom-1',
  template_id: 'tpl-1',
  status: MasterBomStatus.GENERATED,
  generated_at: '2024-01-01T00:00:00Z',
  engine_version: '1.0',
  rule_set_id: 'default',
  approved_by: null,
  approved_at: null,
  created_at: '2024-01-01T00:00:00Z',
};

describe('PublishWorkflow', () => {
  beforeEach(() => {
    usePublishStore.setState({
      currentStep: PublishStep.IDLE,
      validationResults: [],
      generatedBom: null,
      generatedBomLines: [],
      isLoading: false,
      error: null,
    });
    useProjectStore.setState({
      currentTemplate: makeTemplate(),
      zones: [],
      zoneSku: new Map(),
    });
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      selection: { selectedZoneId: null, selectedZoneIds: [], resizeHandle: null, marqueeRect: null },
    });
  });

  it('does not render when currentStep is IDLE', () => {
    render(<PublishWorkflow />);
    expect(screen.queryByTestId('publish-workflow-panel')).not.toBeInTheDocument();
  });

  it('renders panel when workflow is active', () => {
    usePublishStore.setState({ currentStep: PublishStep.VALIDATING });
    render(<PublishWorkflow />);
    expect(screen.getByTestId('publish-workflow-panel')).toBeInTheDocument();
  });

  it('shows StepIndicator with correct active step', () => {
    usePublishStore.setState({ currentStep: PublishStep.VALIDATION_RESULTS });
    render(<PublishWorkflow />);
    expect(screen.getByTestId('publish-step-indicator')).toBeInTheDocument();
    // Step indicator should show "Validate" label
    expect(screen.getByText('Validate')).toBeInTheDocument();
    expect(screen.getByText('Generate BOM')).toBeInTheDocument();
    expect(screen.getByText('Approve BOM')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeInTheDocument();
  });

  it('shows ValidationResultsPanel with pass/fail results', () => {
    usePublishStore.setState({
      currentStep: PublishStep.VALIDATION_RESULTS,
      validationResults: [
        { gate: 'Zone SKU Assignment', passed: true, message: 'All zones have a primary SKU assigned' },
        { gate: 'Zone Overlaps', passed: false, message: 'One or more zones overlap with each other' },
      ],
    });
    render(<PublishWorkflow />);
    expect(screen.getByTestId('validation-results-panel')).toBeInTheDocument();
    expect(screen.getByText('Zone SKU Assignment')).toBeInTheDocument();
    expect(screen.getByText('Zone Overlaps')).toBeInTheDocument();
    expect(screen.getByText('All zones have a primary SKU assigned')).toBeInTheDocument();
    expect(screen.getByText('One or more zones overlap with each other')).toBeInTheDocument();
  });

  it('Generate BOM button appears only when all validations pass', () => {
    // Some validations fail - button should NOT appear
    usePublishStore.setState({
      currentStep: PublishStep.VALIDATION_RESULTS,
      validationResults: [
        { gate: 'Gate 1', passed: true, message: 'ok' },
        { gate: 'Gate 2', passed: false, message: 'fail' },
      ],
    });
    const { unmount } = render(<PublishWorkflow />);
    expect(screen.queryByTestId('generate-bom-btn')).not.toBeInTheDocument();
    unmount();

    // All validations pass - button should appear
    usePublishStore.setState({
      currentStep: PublishStep.VALIDATION_RESULTS,
      validationResults: [
        { gate: 'Gate 1', passed: true, message: 'ok' },
        { gate: 'Gate 2', passed: true, message: 'ok' },
      ],
    });
    render(<PublishWorkflow />);
    expect(screen.getByTestId('generate-bom-btn')).toBeInTheDocument();
  });

  it('ApprovalStep shows BOM info and Approve button', () => {
    usePublishStore.setState({
      currentStep: PublishStep.BOM_GENERATED,
      generatedBom: mockBom,
      generatedBomLines: [],
    });
    render(<PublishWorkflow />);
    expect(screen.getByTestId('approval-step')).toBeInTheDocument();
    expect(screen.getByTestId('approve-bom-btn')).toBeInTheDocument();
    expect(screen.getByText(/Engine Version:/)).toBeInTheDocument();
  });

  it('PublishConfirmation shows Publish button and template name', () => {
    usePublishStore.setState({ currentStep: PublishStep.BOM_APPROVED });
    render(<PublishWorkflow />);
    expect(screen.getByTestId('publish-confirmation')).toBeInTheDocument();
    expect(screen.getByTestId('publish-template-confirm-btn')).toBeInTheDocument();
    expect(screen.getByText('Test Template')).toBeInTheDocument();
  });

  it('close button resets state', () => {
    usePublishStore.setState({ currentStep: PublishStep.VALIDATION_RESULTS });
    render(<PublishWorkflow />);
    fireEvent.click(screen.getByTestId('publish-workflow-close-btn'));
    expect(usePublishStore.getState().currentStep).toBe(PublishStep.IDLE);
  });

  it('error state displays error message and retry button', () => {
    usePublishStore.setState({
      currentStep: PublishStep.ERROR,
      error: 'Something went wrong during publish',
    });
    render(<PublishWorkflow />);
    expect(screen.getByText('Something went wrong during publish')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });
});

describe('Toolbar - Publish Template button', () => {
  beforeEach(() => {
    usePublishStore.setState({
      currentStep: PublishStep.IDLE,
      validationResults: [],
      generatedBom: null,
      generatedBomLines: [],
      isLoading: false,
      error: null,
    });
    useProjectStore.setState({
      currentTemplate: makeTemplate(),
      zones: [],
      zoneSku: new Map(),
    });
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      selection: { selectedZoneId: null, selectedZoneIds: [], resizeHandle: null, marqueeRect: null },
    });
  });

  it('shows Publish Template button in DESIGNER mode with DRAFT template', () => {
    render(<Toolbar />);
    expect(screen.getByTestId('publish-template-btn')).toBeInTheDocument();
  });

  it('hides Publish Template button in CONSULTANT mode', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    render(<Toolbar />);
    expect(screen.queryByTestId('publish-template-btn')).not.toBeInTheDocument();
  });

  it('hides Publish Template button when template is ACTIVE (not DRAFT)', () => {
    useProjectStore.setState({
      currentTemplate: makeTemplate({ status: TemplateStatus.ACTIVE }),
    });
    render(<Toolbar />);
    expect(screen.queryByTestId('publish-template-btn')).not.toBeInTheDocument();
  });
});
