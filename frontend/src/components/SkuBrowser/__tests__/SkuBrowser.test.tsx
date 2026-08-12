import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useSkuStore } from '@/stores/skuStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import {
  CanvasMode,
  ProductType,
  SkuStatus,
  CatalogueStatus,
  QuantityMode,
} from '@/types/database';
import type { SkuWithCatalogue } from '@/types/database';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {},
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
  isSupabaseConfigured: false,
}));

// We override the store actions that trigger network calls so they become no-ops
// in our component tests. This prevents useEffect in SkuFilterBar from overwriting
// the test data we set up.
const noopFetchSkus = vi.fn();
const noopFetchFamilies = vi.fn();
const noopFetchCategories = vi.fn();

// Import after mocks
import { SkuBrowser } from '../SkuBrowser';

const mockSkuActive: SkuWithCatalogue = {
  sku: {
    sku_id: 'sku-001',
    sku_code: 'WP-OAK-001',
    product_type: ProductType.WALL_PANEL,
    family_id: 'fam-1',
    category_id: 'cat-1',
    width_mm: 600,
    height_mm: 2400,
    thickness_mm: 18,
    depth_mm: null,
    unit_length_mm: null,
    material: 'Oak',
    colour: 'Natural',
    finish: 'Matte',
    pattern_identity: 'vertical-grain',
    gh_mm: 0,
    gv_mm: 0,
    quantity_mode: QuantityMode.DISCRETE,
    commercial_attributes: {},
    status: SkuStatus.ACTIVE,
    created_by: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  catalogueEntry: {
    catalogue_entry_id: 'ce-001',
    sku_id: 'sku-001',
    status: CatalogueStatus.READY,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  thumbnailUrl: 'https://example.com/render.png',
};

const mockSkuInactive: SkuWithCatalogue = {
  sku: {
    sku_id: 'sku-002',
    sku_code: 'WP-BIRCH-002',
    product_type: ProductType.WALL_PANEL,
    family_id: 'fam-1',
    category_id: 'cat-2',
    width_mm: 400,
    height_mm: 2400,
    thickness_mm: 12,
    depth_mm: null,
    unit_length_mm: null,
    material: 'Birch',
    colour: 'White',
    finish: 'Satin',
    pattern_identity: null,
    gh_mm: 0,
    gv_mm: 0,
    quantity_mode: null,
    commercial_attributes: {},
    status: SkuStatus.INACTIVE,
    created_by: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  catalogueEntry: {
    catalogue_entry_id: 'ce-002',
    sku_id: 'sku-002',
    status: CatalogueStatus.INCOMPLETE,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  thumbnailUrl: null,
};

describe('SkuBrowser', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      mode: CanvasMode.DESIGNER,
      selection: { selectedZoneId: 'zone-1', resizeHandle: null },
    });
    useSkuStore.setState({
      isBrowserOpen: true,
      skus: [mockSkuActive, mockSkuInactive],
      families: [],
      categories: [],
      filters: {
        productType: null,
        familyId: null,
        categoryId: null,
        material: null,
        colour: null,
        catalogueStatus: null,
        skuStatus: null,
        searchQuery: '',
      },
      selectedSkuId: null,
      isLoading: false,
      error: null,
      page: 0,
      pageSize: 20,
      totalCount: 2,
      hasNextPage: false,
      // Override fetch actions to prevent useEffect from calling real supabase
      fetchSkus: noopFetchSkus,
      fetchFamilies: noopFetchFamilies,
      fetchCategories: noopFetchCategories,
    });
    useProjectStore.setState({
      zoneSku: new Map(),
    });
  });

  it('renders when isBrowserOpen is true', () => {
    render(<SkuBrowser />);
    expect(screen.getByTestId('sku-browser-panel')).toBeInTheDocument();
  });

  it('does not render when isBrowserOpen is false', () => {
    useSkuStore.setState({ isBrowserOpen: false });
    render(<SkuBrowser />);
    expect(screen.queryByTestId('sku-browser-panel')).not.toBeInTheDocument();
  });

  it('does not render in CONSULTANT mode', () => {
    useCanvasStore.setState({ mode: CanvasMode.CONSULTANT });
    render(<SkuBrowser />);
    expect(screen.queryByTestId('sku-browser-panel')).not.toBeInTheDocument();
  });

  it('displays filter bar', () => {
    render(<SkuBrowser />);
    expect(screen.getByTestId('sku-filter-bar')).toBeInTheDocument();
    expect(screen.getByTestId('sku-filter-product-type')).toBeInTheDocument();
    expect(screen.getByTestId('sku-filter-search')).toBeInTheDocument();
  });

  it('displays SKU grid with mock data', () => {
    render(<SkuBrowser />);
    expect(screen.getByTestId('sku-grid')).toBeInTheDocument();
    expect(screen.getByTestId('sku-card-sku-001')).toBeInTheDocument();
    expect(screen.getByTestId('sku-card-sku-002')).toBeInTheDocument();
  });

  it('non-selectable SKUs are dimmed (opacity 0.4)', () => {
    render(<SkuBrowser />);
    const inactiveCard = screen.getByTestId('sku-card-sku-002');
    expect(inactiveCard).toHaveStyle({ opacity: '0.4' });
  });

  it('selectable SKUs are not dimmed', () => {
    render(<SkuBrowser />);
    const activeCard = screen.getByTestId('sku-card-sku-001');
    expect(activeCard).toHaveStyle({ opacity: '1' });
  });

  it('selecting a SKU shows detail panel', () => {
    render(<SkuBrowser />);
    fireEvent.click(screen.getByTestId('sku-card-sku-001'));
    expect(screen.getByTestId('sku-detail-panel')).toBeInTheDocument();
  });

  it('catalogue status badges render correctly', () => {
    render(<SkuBrowser />);
    const readyBadge = screen.getByTestId('sku-badge-sku-001');
    expect(readyBadge).toHaveTextContent('READY');
    const incompleteBadge = screen.getByTestId('sku-badge-sku-002');
    expect(incompleteBadge).toHaveTextContent('INCOMPLETE');
  });

  it('assign button calls assignSku and closes browser', async () => {
    // Select the active SKU
    useSkuStore.setState({ selectedSkuId: 'sku-001' });

    render(<SkuBrowser />);

    const assignBtn = screen.getByTestId('sku-detail-assign-btn');
    expect(assignBtn).not.toBeDisabled();

    fireEvent.click(assignBtn);

    await waitFor(() => {
      expect(useSkuStore.getState().isBrowserOpen).toBe(false);
    });
  });

  it('assign button is disabled when SKU is not selectable', () => {
    // Select the inactive SKU
    useSkuStore.setState({ selectedSkuId: 'sku-002' });

    render(<SkuBrowser />);

    const assignBtn = screen.getByTestId('sku-detail-assign-btn');
    expect(assignBtn).toBeDisabled();
  });

  it('assign button is disabled when no zone is selected', () => {
    useSkuStore.setState({ selectedSkuId: 'sku-001' });
    useCanvasStore.setState({
      selection: { selectedZoneId: null, resizeHandle: null },
    });

    render(<SkuBrowser />);

    const assignBtn = screen.getByTestId('sku-detail-assign-btn');
    expect(assignBtn).toBeDisabled();
  });

  it('close button closes the browser', () => {
    render(<SkuBrowser />);
    fireEvent.click(screen.getByTestId('sku-browser-close-btn'));
    expect(useSkuStore.getState().isBrowserOpen).toBe(false);
  });

  it('pagination controls are present', () => {
    render(<SkuBrowser />);
    expect(screen.getByTestId('sku-grid-pagination')).toBeInTheDocument();
    expect(screen.getByTestId('sku-grid-prev-btn')).toBeInTheDocument();
    expect(screen.getByTestId('sku-grid-next-btn')).toBeInTheDocument();
    expect(screen.getByTestId('sku-grid-page-indicator')).toHaveTextContent('Page 1 of 1');
  });

  it('pagination next button calls setPage', () => {
    useSkuStore.setState({ totalCount: 40, pageSize: 20, hasNextPage: true });
    render(<SkuBrowser />);

    expect(screen.getByTestId('sku-grid-page-indicator')).toHaveTextContent('Page 1 of 2');

    fireEvent.click(screen.getByTestId('sku-grid-next-btn'));
    expect(useSkuStore.getState().page).toBe(1);
  });

  it('clear filters button resets filters', () => {
    useSkuStore.setState({
      filters: {
        productType: ProductType.WALL_PANEL,
        familyId: 'fam-1',
        categoryId: 'cat-1',
        material: 'Wood',
        colour: 'White',
        catalogueStatus: CatalogueStatus.READY,
        skuStatus: SkuStatus.ACTIVE,
        searchQuery: 'test',
      },
    });

    render(<SkuBrowser />);
    fireEvent.click(screen.getByTestId('sku-filter-clear-btn'));

    const state = useSkuStore.getState();
    expect(state.filters.productType).toBeNull();
    expect(state.filters.searchQuery).toBe('');
  });
});
