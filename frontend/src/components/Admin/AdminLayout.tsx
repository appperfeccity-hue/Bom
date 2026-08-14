import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const navItems = [
  { to: '/admin/families', label: 'Families & Categories' },
  { to: '/admin/design-families', label: 'Design Families' },
  { to: '/admin/skus', label: 'SKU Master' },
  { to: '/admin/compatibility', label: 'Compatibility' },
  { to: '/admin/catalogue', label: 'Catalogue' },
  { to: '/admin/rule-sets', label: 'Rule Sets' },
];

export function AdminLayout() {
  const user = useAuthStore((s) => s.user);

  return (
    <div data-testid="admin-layout" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <nav
        data-testid="admin-sidebar"
        style={{
          width: '240px',
          backgroundColor: 'var(--color-surface)',
          borderRight: '1px solid var(--color-hairline)',
          padding: '16px 0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--color-hairline)' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--color-ink-primary)' }}>Admin Panel</h2>
          {user && (
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-ink-secondary)' }}>
              {user.email}
            </p>
          )}
        </div>
        <div style={{ padding: '8px 0', flex: 1 }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={`admin-nav-${item.to.split('/').pop()}`}
              style={({ isActive }) => ({
                display: 'block',
                padding: '10px 16px',
                fontSize: '14px',
                color: isActive ? 'var(--color-ink-primary)' : 'var(--color-ink-secondary)',
                backgroundColor: isActive ? 'var(--color-nav-active-bg)' : 'transparent',
                textDecoration: 'none',
                borderLeft: isActive ? '3px solid var(--color-accent)' : '3px solid transparent',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Content area */}
      <main
        data-testid="admin-content"
        style={{
          flex: 1,
          backgroundColor: 'var(--color-canvas)',
          padding: '24px',
          overflow: 'auto',
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
