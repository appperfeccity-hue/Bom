import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

/**
 * Dashboard Page - uses Perfeccity design system tokens.
 * Shows user info, role, and navigation buttons.
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const signOut = useAuthStore((s) => s.signOut);

  const cardStyle = {
    padding: 'var(--space-5)',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    border: '1px solid var(--color-hairline)',
    boxShadow: 'var(--shadow-sm)',
    transition: 'box-shadow 0.15s ease',
  };

  return (
    <div style={{ padding: 'var(--space-8)', minHeight: '100vh', backgroundColor: 'var(--color-canvas)' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-2xl)', margin: 0, color: 'var(--color-ink-primary)' }}>Perfeccity</h1>
            <p style={{ color: 'var(--color-ink-secondary)', margin: '4px 0 0', fontSize: 'var(--text-base)' }}>
              {user?.email ?? 'unknown'} | Role: <span style={{ color: 'var(--color-accent)', fontWeight: 'var(--weight-medium)' }}>{role ?? 'not detected'}</span>
            </p>
          </div>
          <button
            onClick={() => { void signOut(); }}
            style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-base)', background: 'transparent', border: '1px solid var(--color-disabled)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-ink-primary)' }}
          >
            Logout
          </button>
        </div>

        {!role && (
          <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-6)', border: '1px solid var(--color-warning)' }}>
            <p style={{ margin: 0, fontSize: 'var(--text-md)', color: 'var(--color-warning)' }}>
              Role not detected. The Custom Access Token Hook may not be propagating the role into the JWT correctly.
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-ink-secondary)' }}>
              app_metadata: {JSON.stringify(user?.app_metadata ?? {})}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-ink-secondary)' }}>
              user_metadata: {JSON.stringify(user?.user_metadata ?? {})}
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
          <div onClick={() => navigate('/canvas')} style={cardStyle}>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--text-lg)', color: 'var(--color-ink-primary)' }}>Open Canvas</h3>
            <p style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--color-ink-secondary)' }}>Designer/Consultant workspace</p>
          </div>

          {(role === 'DESIGNER' || !role) && (
            <div onClick={() => navigate('/canvas')} style={cardStyle}>
              <h3 style={{ margin: '0 0 8px', fontSize: 'var(--text-lg)', color: 'var(--color-ink-primary)' }}>My Templates</h3>
              <p style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--color-ink-secondary)' }}>Create and manage templates</p>
            </div>
          )}

          {(role === 'CONSULTANT' || !role) && (
            <div onClick={() => navigate('/canvas')} style={cardStyle}>
              <h3 style={{ margin: '0 0 8px', fontSize: 'var(--text-lg)', color: 'var(--color-ink-primary)' }}>New Project</h3>
              <p style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--color-ink-secondary)' }}>Start from a published template</p>
            </div>
          )}

          {(role === 'ADMIN' || !role) && (
            <div onClick={() => navigate('/admin/skus')} style={{ ...cardStyle, border: '1px solid var(--color-accent)' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 'var(--text-lg)', color: 'var(--color-ink-primary)' }}>Admin Panel</h3>
              <p style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--color-ink-secondary)' }}>Manage SKUs, catalogue, rules</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
