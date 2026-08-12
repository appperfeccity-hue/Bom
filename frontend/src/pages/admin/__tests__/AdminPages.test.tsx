import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminRoute } from '@/components/Admin/AdminRoute';
import { AdminLayout } from '@/components/Admin/AdminLayout';
import { FamilyCategoryPage } from '../FamilyCategoryPage';
import { DesignFamilyPage } from '../DesignFamilyPage';
import { SkuMasterPage } from '../SkuMasterPage';
import { SkuCompatibilityPage } from '../SkuCompatibilityPage';
import { CataloguePage } from '../CataloguePage';
import { RuleSetPage } from '../RuleSetPage';

// Mock supabase
vi.mock('@/lib/supabase', () => {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  return {
    fromTable: vi.fn(() => ({ ...mockQueryBuilder })),
    supabase: {
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
          createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed' } }),
        })),
      },
    },
  };
});

// Mock auth store
const mockAuthStore = {
  user: { email: 'admin@test.com' },
  role: 'ADMIN' as const,
  isAuthenticated: true,
  isLoading: false,
};

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: typeof mockAuthStore) => unknown) => selector(mockAuthStore),
}));

describe('AdminRoute', () => {
  it('should render Outlet when user is ADMIN', () => {
    render(
      <MemoryRouter initialEntries={['/admin/families']}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="/admin/families" element={<div data-testid="admin-content">Admin Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('admin-content')).toBeDefined();
  });

  it('should redirect to / when user is not ADMIN', () => {
    mockAuthStore.role = 'DESIGNER' as unknown as typeof mockAuthStore.role;
    render(
      <MemoryRouter initialEntries={['/admin/families']}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="/admin/families" element={<div data-testid="admin-content">Admin Content</div>} />
          </Route>
          <Route path="/" element={<div data-testid="home-page">Home</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('admin-content')).toBeNull();
    expect(screen.getByTestId('home-page')).toBeDefined();
    // Reset
    mockAuthStore.role = 'ADMIN';
  });

  it('should show loading spinner when isLoading', () => {
    mockAuthStore.isLoading = true;
    render(
      <MemoryRouter initialEntries={['/admin/families']}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="/admin/families" element={<div>Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('admin-route-loading')).toBeDefined();
    mockAuthStore.isLoading = false;
  });
});

describe('AdminLayout', () => {
  it('should render sidebar with navigation links', () => {
    render(
      <MemoryRouter initialEntries={['/admin/families']}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/admin/families" element={<div>Families</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('admin-layout')).toBeDefined();
    expect(screen.getByTestId('admin-sidebar')).toBeDefined();
    expect(screen.getByTestId('admin-content')).toBeDefined();
    expect(screen.getByTestId('admin-nav-families')).toBeDefined();
    expect(screen.getByTestId('admin-nav-design-families')).toBeDefined();
    expect(screen.getByTestId('admin-nav-skus')).toBeDefined();
    expect(screen.getByTestId('admin-nav-compatibility')).toBeDefined();
    expect(screen.getByTestId('admin-nav-catalogue')).toBeDefined();
    expect(screen.getByTestId('admin-nav-rule-sets')).toBeDefined();
  });

  it('should display user email', () => {
    render(
      <MemoryRouter initialEntries={['/admin/families']}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/admin/families" element={<div>Families</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('admin@test.com')).toBeDefined();
  });
});

describe('FamilyCategoryPage', () => {
  it('should render the page with main elements', () => {
    render(
      <MemoryRouter>
        <FamilyCategoryPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('family-category-page')).toBeDefined();
    expect(screen.getByText('Families & Categories')).toBeDefined();
    expect(screen.getByTestId('new-family-input')).toBeDefined();
    expect(screen.getByTestId('add-family-btn')).toBeDefined();
    expect(screen.getByTestId('families-table')).toBeDefined();
  });
});

describe('DesignFamilyPage', () => {
  it('should render the page with main elements', () => {
    render(
      <MemoryRouter>
        <DesignFamilyPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('design-family-page')).toBeDefined();
    expect(screen.getAllByText('Design Families').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('new-design-family-input')).toBeDefined();
    expect(screen.getByTestId('add-design-family-btn')).toBeDefined();
  });
});

describe('SkuMasterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the page with main elements', () => {
    render(
      <MemoryRouter>
        <SkuMasterPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('sku-master-page')).toBeDefined();
    expect(screen.getByText('SKU Master')).toBeDefined();
    expect(screen.getByTestId('add-sku-btn')).toBeDefined();
    expect(screen.getByTestId('sku-filters')).toBeDefined();
    expect(screen.getByTestId('sku-table')).toBeDefined();
  });

  it('should render filters for product type and status', () => {
    render(
      <MemoryRouter>
        <SkuMasterPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('filter-product-type')).toBeDefined();
    expect(screen.getByTestId('filter-status')).toBeDefined();
  });
});

describe('SkuCompatibilityPage', () => {
  it('should render the page with main elements', () => {
    render(
      <MemoryRouter>
        <SkuCompatibilityPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('sku-compatibility-page')).toBeDefined();
    expect(screen.getByText('SKU Compatibility')).toBeDefined();
    expect(screen.getByTestId('add-compatibility-btn')).toBeDefined();
    expect(screen.getByTestId('compatibility-table')).toBeDefined();
  });
});

describe('CataloguePage', () => {
  it('should render the page with main elements', () => {
    render(
      <MemoryRouter>
        <CataloguePage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('catalogue-page')).toBeDefined();
    expect(screen.getByText('Catalogue Management')).toBeDefined();
    expect(screen.getByTestId('catalogue-entries-table')).toBeDefined();
  });
});

describe('RuleSetPage', () => {
  it('should render the page with main elements', () => {
    render(
      <MemoryRouter>
        <RuleSetPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('rule-set-page')).toBeDefined();
    expect(screen.getByText('Rule Sets')).toBeDefined();
    expect(screen.getByTestId('add-rule-set-btn')).toBeDefined();
    expect(screen.getByTestId('rule-sets-table')).toBeDefined();
  });
});
