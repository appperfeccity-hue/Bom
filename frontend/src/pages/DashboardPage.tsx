import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

/**
 * Minimal Dashboard Page - simplified to avoid any possible crash.
 * Shows user info, role, and navigation buttons.
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <div style={{ padding: '32px', minHeight: '100vh', backgroundColor: '#fafafa' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '24px', margin: 0 }}>Perfeccity</h1>
            <p style={{ color: '#666', margin: '4px 0 0' }}>
              {user?.email ?? 'unknown'} | Role: {role ?? 'not detected'}
            </p>
          </div>
          <button
            onClick={() => { void signOut(); }}
            style={{ padding: '8px 16px', fontSize: '13px', backgroundColor: '#f5f5f5', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>

        {!role && (
          <div style={{ padding: '16px', backgroundColor: '#fff3e0', borderRadius: '8px', marginBottom: '24px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#e65100' }}>
              Role not detected. The Custom Access Token Hook may not be propagating the role into the JWT correctly.
            </p>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#999' }}>
              app_metadata: {JSON.stringify(user?.app_metadata ?? {})}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#999' }}>
              user_metadata: {JSON.stringify(user?.user_metadata ?? {})}
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          <div onClick={() => navigate('/canvas')} style={{ padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '8px', cursor: 'pointer', border: '1px solid #90caf9' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Open Canvas</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>Designer/Consultant workspace</p>
          </div>

          {(role === 'DESIGNER' || !role) && (
            <div onClick={() => navigate('/canvas')} style={{ padding: '20px', backgroundColor: '#ede7f6', borderRadius: '8px', cursor: 'pointer', border: '1px solid #b39ddb' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>My Templates</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>Create and manage templates</p>
            </div>
          )}

          {(role === 'CONSULTANT' || !role) && (
            <div onClick={() => navigate('/canvas')} style={{ padding: '20px', backgroundColor: '#e8f5e9', borderRadius: '8px', cursor: 'pointer', border: '1px solid #a5d6a7' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>New Project</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>Start from a published template</p>
            </div>
          )}

          {(role === 'ADMIN' || !role) && (
            <div onClick={() => navigate('/admin/skus')} style={{ padding: '20px', backgroundColor: '#fff3e0', borderRadius: '8px', cursor: 'pointer', border: '1px solid #ffcc80' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Admin Panel</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>Manage SKUs, catalogue, rules</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
