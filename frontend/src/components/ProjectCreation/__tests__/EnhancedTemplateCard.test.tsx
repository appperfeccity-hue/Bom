import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplateStatus, AdaptationStrategy } from '@/types/database';
import type { TemplateWithAvailability } from '@/stores/designLibraryStore';

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

import { EnhancedTemplateCard } from '../EnhancedTemplateCard';

const makeTemplateWithAvailability = (
  overrides: Partial<TemplateWithAvailability> = {},
): TemplateWithAvailability => ({
  template_id: 'tpl-1',
  name: 'Test Template',
  description: 'A template for testing',
  design_family_id: null,
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
  designFamilyName: null,
  ...overrides,
});

describe('EnhancedTemplateCard', () => {
  let onSelect: ReturnType<typeof vi.fn>;
  let onPreview: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSelect = vi.fn();
    onPreview = vi.fn();
  });

  it('renders template name', () => {
    const template = makeTemplateWithAvailability({ name: 'Modern Wall Design' });
    render(<EnhancedTemplateCard template={template} onSelect={onSelect} onPreview={onPreview} />);

    expect(screen.getByText('Modern Wall Design')).toBeDefined();
  });

  it('renders description truncated when longer than 100 characters', () => {
    const longDescription = 'A'.repeat(120);
    const template = makeTemplateWithAvailability({ description: longDescription });
    render(<EnhancedTemplateCard template={template} onSelect={onSelect} onPreview={onPreview} />);

    const expectedText = 'A'.repeat(100) + '...';
    expect(screen.getByText(expectedText)).toBeDefined();
  });

  it('renders full description when 100 characters or less', () => {
    const shortDescription = 'A short description';
    const template = makeTemplateWithAvailability({ description: shortDescription });
    render(<EnhancedTemplateCard template={template} onSelect={onSelect} onPreview={onPreview} />);

    expect(screen.getByText(shortDescription)).toBeDefined();
  });

  it('renders geometry badge with type', () => {
    const template = makeTemplateWithAvailability({
      wall_geometry: { type: 'L_CORNER', base_width_mm: 4000, base_height_mm: 2700 },
    });
    render(<EnhancedTemplateCard template={template} onSelect={onSelect} onPreview={onPreview} />);

    expect(screen.getByText('L_CORNER')).toBeDefined();
  });

  it('renders dimensions', () => {
    const template = makeTemplateWithAvailability({
      wall_geometry: { type: 'STRAIGHT', base_width_mm: 3000, base_height_mm: 2400 },
    });
    render(<EnhancedTemplateCard template={template} onSelect={onSelect} onPreview={onPreview} />);

    expect(screen.getByText('3000 x 2400 mm')).toBeDefined();
  });

  it('shows green AVAILABLE badge for available template', () => {
    const template = makeTemplateWithAvailability({ availability: 'AVAILABLE' });
    render(<EnhancedTemplateCard template={template} onSelect={onSelect} onPreview={onPreview} />);

    const badge = screen.getByTestId('availability-badge');
    expect(badge.textContent).toBe('AVAILABLE');
  });

  it('shows red BLOCKED badge for blocked template', () => {
    const template = makeTemplateWithAvailability({
      availability: 'BLOCKED',
      blockedReasons: ['SKU SKU001 is INACTIVE'],
    });
    render(<EnhancedTemplateCard template={template} onSelect={onSelect} onPreview={onPreview} />);

    const badge = screen.getByTestId('availability-badge');
    expect(badge.textContent).toBe('BLOCKED');
  });

  it('shows blocked reasons when BLOCKED', () => {
    const template = makeTemplateWithAvailability({
      availability: 'BLOCKED',
      blockedReasons: ['SKU SKU001 is INACTIVE', 'SKU SKU002 catalogue is INCOMPLETE'],
    });
    render(<EnhancedTemplateCard template={template} onSelect={onSelect} onPreview={onPreview} />);

    const reasons = screen.getByTestId('blocked-reasons');
    expect(reasons).toBeDefined();
    expect(screen.getByText('SKU SKU001 is INACTIVE')).toBeDefined();
    expect(screen.getByText('SKU SKU002 catalogue is INCOMPLETE')).toBeDefined();
  });

  it('does not show blocked reasons when AVAILABLE', () => {
    const template = makeTemplateWithAvailability({ availability: 'AVAILABLE' });
    render(<EnhancedTemplateCard template={template} onSelect={onSelect} onPreview={onPreview} />);

    expect(screen.queryByTestId('blocked-reasons')).toBeNull();
  });

  it('Select button is disabled when BLOCKED', () => {
    const template = makeTemplateWithAvailability({
      availability: 'BLOCKED',
      blockedReasons: ['SKU INACTIVE'],
    });
    render(<EnhancedTemplateCard template={template} onSelect={onSelect} onPreview={onPreview} />);

    const selectBtn = screen.getByTestId('template-select-btn');
    expect(selectBtn).toHaveProperty('disabled', true);
  });

  it('Select button is enabled when AVAILABLE', () => {
    const template = makeTemplateWithAvailability({ availability: 'AVAILABLE' });
    render(<EnhancedTemplateCard template={template} onSelect={onSelect} onPreview={onPreview} />);

    const selectBtn = screen.getByTestId('template-select-btn');
    expect(selectBtn).toHaveProperty('disabled', false);
  });

  it('Preview button is always enabled', () => {
    const blockedTemplate = makeTemplateWithAvailability({
      availability: 'BLOCKED',
      blockedReasons: ['reason'],
    });
    render(<EnhancedTemplateCard template={blockedTemplate} onSelect={onSelect} onPreview={onPreview} />);

    const previewBtn = screen.getByTestId('template-preview-btn');
    expect(previewBtn).toHaveProperty('disabled', false);
  });

  it('clicking Select calls onSelect with template', () => {
    const template = makeTemplateWithAvailability({ availability: 'AVAILABLE' });
    render(<EnhancedTemplateCard template={template} onSelect={onSelect} onPreview={onPreview} />);

    fireEvent.click(screen.getByTestId('template-select-btn'));
    expect(onSelect).toHaveBeenCalledWith(template);
  });

  it('clicking Select when BLOCKED does not call onSelect', () => {
    const template = makeTemplateWithAvailability({
      availability: 'BLOCKED',
      blockedReasons: ['reason'],
    });
    render(<EnhancedTemplateCard template={template} onSelect={onSelect} onPreview={onPreview} />);

    fireEvent.click(screen.getByTestId('template-select-btn'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('clicking Preview calls onPreview with template', () => {
    const template = makeTemplateWithAvailability({ availability: 'AVAILABLE' });
    render(<EnhancedTemplateCard template={template} onSelect={onSelect} onPreview={onPreview} />);

    fireEvent.click(screen.getByTestId('template-preview-btn'));
    expect(onPreview).toHaveBeenCalledWith(template);
  });

  it('clicking Preview when BLOCKED still calls onPreview', () => {
    const template = makeTemplateWithAvailability({
      availability: 'BLOCKED',
      blockedReasons: ['reason'],
    });
    render(<EnhancedTemplateCard template={template} onSelect={onSelect} onPreview={onPreview} />);

    fireEvent.click(screen.getByTestId('template-preview-btn'));
    expect(onPreview).toHaveBeenCalledWith(template);
  });

  it('shows design family name when present', () => {
    const template = makeTemplateWithAvailability({ designFamilyName: 'Modern Collection' });
    render(<EnhancedTemplateCard template={template} onSelect={onSelect} onPreview={onPreview} />);

    expect(screen.getByText('Modern Collection')).toBeDefined();
  });

  it('does not show design family name when null', () => {
    const template = makeTemplateWithAvailability({ designFamilyName: null });
    render(<EnhancedTemplateCard template={template} onSelect={onSelect} onPreview={onPreview} />);

    expect(screen.queryByText('Modern Collection')).toBeNull();
  });
});
