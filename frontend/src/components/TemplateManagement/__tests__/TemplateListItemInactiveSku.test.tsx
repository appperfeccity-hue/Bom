// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useTemplateManagementStore } from '@/stores/templateManagementStore';
import { TemplateStatus, AdaptationStrategy } from '@/types/database';
import type { Template } from '@/types/database';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
  supabase: {},
  isSupabaseConfigured: false,
}));

import { TemplateListItem } from '../TemplateListItem';

const makeTemplate = (overrides: Partial<Template> = {}): Template => ({
  template_id: 'tpl-1',
  name: 'Test Template',
  description: null,
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

describe('TemplateListItem - Inactive SKU badge', () => {
  beforeEach(() => {
    useTemplateManagementStore.getState().reset();
  });

  it('should show BLOCKED badge when hasInactiveSkus is true', () => {
    const template = makeTemplate();
    render(<TemplateListItem template={template} hasInactiveSkus={true} />);

    const badge = screen.getByTestId('sku-inactive-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('BLOCKED');
  });

  it('should NOT show BLOCKED badge when hasInactiveSkus is false', () => {
    const template = makeTemplate();
    render(<TemplateListItem template={template} hasInactiveSkus={false} />);

    expect(screen.queryByTestId('sku-inactive-badge')).not.toBeInTheDocument();
  });

  it('should NOT show BLOCKED badge when hasInactiveSkus is not provided', () => {
    const template = makeTemplate();
    render(<TemplateListItem template={template} />);

    expect(screen.queryByTestId('sku-inactive-badge')).not.toBeInTheDocument();
  });

  it('should show BLOCKED badge alongside the template name and status', () => {
    const template = makeTemplate({ name: 'My Template' });
    render(<TemplateListItem template={template} hasInactiveSkus={true} />);

    expect(screen.getByText('My Template')).toBeInTheDocument();
    expect(screen.getByTestId('sku-inactive-badge')).toBeInTheDocument();
  });
});
