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

import { CategoryCarousel } from '../CategoryCarousel';

const makeTemplate = (overrides: Partial<TemplateWithAvailability> = {}): TemplateWithAvailability => ({
  template_id: 'tpl-1',
  name: 'Test Template',
  description: 'A template for testing',
  design_family_id: null,
  design_subfamily_id: null,
  wall_application: 'Living Room',
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

describe('CategoryCarousel', () => {
  let onCategorySelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onCategorySelect = vi.fn();
  });

  it('renders nothing when templates have no wall_application', () => {
    const templates = [makeTemplate({ wall_application: null })];
    const { container } = render(
      <CategoryCarousel templates={templates} activeCategory={null} onCategorySelect={onCategorySelect} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when templates array is empty', () => {
    const { container } = render(
      <CategoryCarousel templates={[]} activeCategory={null} onCategorySelect={onCategorySelect} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the section title', () => {
    const templates = [makeTemplate({ wall_application: 'Living Room' })];
    render(
      <CategoryCarousel templates={templates} activeCategory={null} onCategorySelect={onCategorySelect} />
    );
    expect(screen.getByText('Explore designs for')).toBeDefined();
  });

  it('renders category cards from unique wall_application values', () => {
    const templates = [
      makeTemplate({ template_id: 'tpl-1', wall_application: 'Living Room' }),
      makeTemplate({ template_id: 'tpl-2', wall_application: 'Bedroom Wall' }),
      makeTemplate({ template_id: 'tpl-3', wall_application: 'Living Room' }),
    ];
    render(
      <CategoryCarousel templates={templates} activeCategory={null} onCategorySelect={onCategorySelect} />
    );
    expect(screen.getByText('Living Room')).toBeDefined();
    expect(screen.getByText('Bedroom Wall')).toBeDefined();
    // Should deduplicate
    expect(screen.getAllByText('Living Room')).toHaveLength(1);
  });

  it('excludes empty or whitespace-only wall_application values', () => {
    const templates = [
      makeTemplate({ template_id: 'tpl-1', wall_application: 'TV Wall' }),
      makeTemplate({ template_id: 'tpl-2', wall_application: '' }),
      makeTemplate({ template_id: 'tpl-3', wall_application: '   ' }),
    ];
    render(
      <CategoryCarousel templates={templates} activeCategory={null} onCategorySelect={onCategorySelect} />
    );
    expect(screen.getByText('TV Wall')).toBeDefined();
    // Only one category card rendered
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
  });

  it('calls onCategorySelect with category name on click', () => {
    const templates = [makeTemplate({ wall_application: 'Living Room' })];
    render(
      <CategoryCarousel templates={templates} activeCategory={null} onCategorySelect={onCategorySelect} />
    );
    fireEvent.click(screen.getByText('Living Room'));
    expect(onCategorySelect).toHaveBeenCalledWith('Living Room');
  });

  it('calls onCategorySelect with null when clicking the active category (toggle off)', () => {
    const templates = [makeTemplate({ wall_application: 'Living Room' })];
    render(
      <CategoryCarousel templates={templates} activeCategory="Living Room" onCategorySelect={onCategorySelect} />
    );
    fireEvent.click(screen.getByText('Living Room'));
    expect(onCategorySelect).toHaveBeenCalledWith(null);
  });

  it('marks active category with aria-pressed=true', () => {
    const templates = [
      makeTemplate({ template_id: 'tpl-1', wall_application: 'Living Room' }),
      makeTemplate({ template_id: 'tpl-2', wall_application: 'Bedroom Wall' }),
    ];
    render(
      <CategoryCarousel templates={templates} activeCategory="Living Room" onCategorySelect={onCategorySelect} />
    );
    const livingRoom = screen.getByLabelText('Filter by Living Room');
    const bedroom = screen.getByLabelText('Filter by Bedroom Wall');
    expect(livingRoom.getAttribute('aria-pressed')).toBe('true');
    expect(bedroom.getAttribute('aria-pressed')).toBe('false');
  });

  it('supports keyboard activation with Enter key', () => {
    const templates = [makeTemplate({ wall_application: 'TV Wall' })];
    render(
      <CategoryCarousel templates={templates} activeCategory={null} onCategorySelect={onCategorySelect} />
    );
    const card = screen.getByLabelText('Filter by TV Wall');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onCategorySelect).toHaveBeenCalledWith('TV Wall');
  });

  it('supports keyboard activation with Space key', () => {
    const templates = [makeTemplate({ wall_application: 'TV Wall' })];
    render(
      <CategoryCarousel templates={templates} activeCategory={null} onCategorySelect={onCategorySelect} />
    );
    const card = screen.getByLabelText('Filter by TV Wall');
    fireEvent.keyDown(card, { key: ' ' });
    expect(onCategorySelect).toHaveBeenCalledWith('TV Wall');
  });

  it('has data-testid="category-carousel" on root', () => {
    const templates = [makeTemplate({ wall_application: 'Living Room' })];
    render(
      <CategoryCarousel templates={templates} activeCategory={null} onCategorySelect={onCategorySelect} />
    );
    expect(screen.getByTestId('category-carousel')).toBeDefined();
  });
});
