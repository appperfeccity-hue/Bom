import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignLibraryStore } from '@/stores/designLibraryStore';
import { useProjectCreationStore } from '@/stores/projectCreationStore';
import type { TemplateWithAvailability } from '@/stores/designLibraryStore';
import { TemplateStatus, AdaptationStrategy } from '@/types/database';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  })),
  supabase: { rpc: vi.fn() },
  isSupabaseConfigured: false,
}));

import { TemplatePreviewPanel } from '../TemplatePreviewPanel';

const makeTemplateWithAvailability = (
  overrides: Partial<TemplateWithAvailability> = {},
): TemplateWithAvailability => ({
  template_id: 'tpl-1',
  name: 'Preview Template',
  description: 'A detailed description for the preview panel',
  design_family_id: 'fam-1',
  design_subfamily_id: null,
  wall_application: null,
  wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2400 },
  adaptation_strategy: AdaptationStrategy.PROPORTIONAL,
  priority_zone_id: null,
  waste_factor: null,
  metadata: null,
  status: TemplateStatus.ACTIVE,
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  availability: 'AVAILABLE',
  blockedReasons: [],
  designFamilyName: 'Modern Collection',
  ...overrides,
});

describe('TemplatePreviewPanel', () => {
  beforeEach(() => {
    useDesignLibraryStore.getState().reset();
    useProjectCreationStore.getState().reset();
  });

  it('renders nothing when no template is selected for preview', () => {
    const { container } = render(<TemplatePreviewPanel />);
    expect(container.innerHTML).toBe('');
  });

  it('renders template name when a template is selected', () => {
    const template = makeTemplateWithAvailability({ name: 'Modern Wall Design' });
    useDesignLibraryStore.setState({ selectedTemplateDetail: template });

    render(<TemplatePreviewPanel />);
    expect(screen.getByText('Modern Wall Design')).toBeDefined();
  });

  it('renders template description', () => {
    const template = makeTemplateWithAvailability({ description: 'A beautiful wall design' });
    useDesignLibraryStore.setState({ selectedTemplateDetail: template });

    render(<TemplatePreviewPanel />);
    expect(screen.getByText('A beautiful wall design')).toBeDefined();
  });

  it('renders wall geometry details', () => {
    const template = makeTemplateWithAvailability({
      wall_geometry: { type: 'L_CORNER', base_width_mm: 4000, base_height_mm: 2700 },
    });
    useDesignLibraryStore.setState({ selectedTemplateDetail: template });

    render(<TemplatePreviewPanel />);
    expect(screen.getByText('L_CORNER - 4000 x 2700 mm')).toBeDefined();
  });

  it('renders adaptation strategy', () => {
    const template = makeTemplateWithAvailability({
      adaptation_strategy: AdaptationStrategy.PRIORITY_ZONE,
    });
    useDesignLibraryStore.setState({ selectedTemplateDetail: template });

    render(<TemplatePreviewPanel />);
    expect(screen.getByText('PRIORITY_ZONE')).toBeDefined();
  });

  it('renders design family name', () => {
    const template = makeTemplateWithAvailability({ designFamilyName: 'Classic Series' });
    useDesignLibraryStore.setState({ selectedTemplateDetail: template });

    render(<TemplatePreviewPanel />);
    expect(screen.getByText('Classic Series')).toBeDefined();
  });

  it('does not render design family section when null', () => {
    const template = makeTemplateWithAvailability({ designFamilyName: null });
    useDesignLibraryStore.setState({ selectedTemplateDetail: template });

    render(<TemplatePreviewPanel />);
    expect(screen.queryByText('Design Family')).toBeNull();
  });

  it('shows AVAILABLE badge for available template', () => {
    const template = makeTemplateWithAvailability({ availability: 'AVAILABLE' });
    useDesignLibraryStore.setState({ selectedTemplateDetail: template });

    render(<TemplatePreviewPanel />);
    const badge = screen.getByTestId('availability-badge');
    expect(badge.textContent).toBe('AVAILABLE');
  });

  it('shows BLOCKED badge for blocked template', () => {
    const template = makeTemplateWithAvailability({
      availability: 'BLOCKED',
      blockedReasons: ['SKU is INACTIVE'],
    });
    useDesignLibraryStore.setState({ selectedTemplateDetail: template });

    render(<TemplatePreviewPanel />);
    const badge = screen.getByTestId('availability-badge');
    expect(badge.textContent).toBe('BLOCKED');
  });

  it('shows blocked reasons when BLOCKED', () => {
    const template = makeTemplateWithAvailability({
      availability: 'BLOCKED',
      blockedReasons: ['SKU SKU001 is INACTIVE', 'SKU SKU002 catalogue is INCOMPLETE'],
    });
    useDesignLibraryStore.setState({ selectedTemplateDetail: template });

    render(<TemplatePreviewPanel />);
    const reasons = screen.getByTestId('blocked-reasons');
    expect(reasons).toBeDefined();
    expect(screen.getByText('SKU SKU001 is INACTIVE')).toBeDefined();
    expect(screen.getByText('SKU SKU002 catalogue is INCOMPLETE')).toBeDefined();
  });

  it('does not show blocked reasons section when AVAILABLE', () => {
    const template = makeTemplateWithAvailability({ availability: 'AVAILABLE' });
    useDesignLibraryStore.setState({ selectedTemplateDetail: template });

    render(<TemplatePreviewPanel />);
    expect(screen.queryByTestId('blocked-reasons')).toBeNull();
  });

  it('Select Template button is disabled when BLOCKED', () => {
    const template = makeTemplateWithAvailability({
      availability: 'BLOCKED',
      blockedReasons: ['SKU INACTIVE'],
    });
    useDesignLibraryStore.setState({ selectedTemplateDetail: template });

    render(<TemplatePreviewPanel />);
    const selectBtn = screen.getByTestId('preview-select-btn');
    expect(selectBtn).toHaveProperty('disabled', true);
  });

  it('Select Template button is enabled when AVAILABLE', () => {
    const template = makeTemplateWithAvailability({ availability: 'AVAILABLE' });
    useDesignLibraryStore.setState({ selectedTemplateDetail: template });

    render(<TemplatePreviewPanel />);
    const selectBtn = screen.getByTestId('preview-select-btn');
    expect(selectBtn).toHaveProperty('disabled', false);
  });

  it('Select Template button calls projectCreationStore.selectTemplate when AVAILABLE', () => {
    const template = makeTemplateWithAvailability({ availability: 'AVAILABLE' });
    useDesignLibraryStore.setState({ selectedTemplateDetail: template });

    const mockSelectTemplate = vi.fn();
    useProjectCreationStore.setState({ selectTemplate: mockSelectTemplate } as never);

    render(<TemplatePreviewPanel />);
    fireEvent.click(screen.getByTestId('preview-select-btn'));

    expect(mockSelectTemplate).toHaveBeenCalledWith(template);
  });

  it('Select Template button also clears preview after selection', () => {
    const template = makeTemplateWithAvailability({ availability: 'AVAILABLE' });
    useDesignLibraryStore.setState({ selectedTemplateDetail: template });

    const mockSelectTemplate = vi.fn();
    useProjectCreationStore.setState({ selectTemplate: mockSelectTemplate } as never);

    render(<TemplatePreviewPanel />);
    fireEvent.click(screen.getByTestId('preview-select-btn'));

    // After select, clearPreview is called internally which sets selectedTemplateDetail to null
    expect(useDesignLibraryStore.getState().selectedTemplateDetail).toBeNull();
  });

  it('Close button calls clearPreview', () => {
    const template = makeTemplateWithAvailability({ availability: 'AVAILABLE' });
    useDesignLibraryStore.setState({ selectedTemplateDetail: template });

    render(<TemplatePreviewPanel />);
    fireEvent.click(screen.getByTestId('preview-close-btn'));

    expect(useDesignLibraryStore.getState().selectedTemplateDetail).toBeNull();
  });

  it('renders the panel element with correct testid', () => {
    const template = makeTemplateWithAvailability();
    useDesignLibraryStore.setState({ selectedTemplateDetail: template });

    render(<TemplatePreviewPanel />);
    expect(screen.getByTestId('template-preview-panel')).toBeDefined();
  });
});
