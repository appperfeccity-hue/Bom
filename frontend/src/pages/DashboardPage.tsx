import { useNavigate } from 'react-router-dom';
import { useAuthStore, UserRole } from '@/stores/authStore';
import { useTemplateManagementStore } from '@/stores/templateManagementStore';
import { useProjectCreationStore, CreationStep } from '@/stores/projectCreationStore';

interface ActionCard {
  title: string;
  description: string;
  color: string;
  onClick: () => void;
  testId: string;
}

function getCardsForRole(
  role: UserRole | null,
  navigate: ReturnType<typeof useNavigate>,
  openTemplatePanel: () => void,
): ActionCard[] {
  switch (role) {
    case 'DESIGNER':
      return [
        {
          title: 'My Templates',
          description: 'View and manage your design templates',
          color: '#ede7f6',
          onClick: () => {
            openTemplatePanel();
            navigate('/canvas');
          },
          testId: 'dashboard-my-templates',
        },
        {
          title: 'Create New Template',
          description: 'Start designing a new room template',
          color: '#e3f2fd',
          onClick: () => {
            openTemplatePanel();
            navigate('/canvas');
          },
          testId: 'dashboard-create-template',
        },
        {
          title: 'Recent Templates',
          description: 'Continue working on recent drafts',
          color: '#f3e5f5',
          onClick: () => navigate('/canvas'),
          testId: 'dashboard-recent-templates',
        },
      ];
    case 'CONSULTANT':
      return [
        {
          title: 'New Project',
          description: 'Create a new project from a template',
          color: '#e8f5e9',
          onClick: () => {
            useProjectCreationStore.setState({ step: CreationStep.BROWSE_TEMPLATES });
            navigate('/canvas');
          },
          testId: 'dashboard-new-project',
        },
        {
          title: 'My Projects',
          description: 'View and manage your active projects',
          color: '#fff3e0',
          onClick: () => navigate('/canvas'),
          testId: 'dashboard-my-projects',
        },
        {
          title: 'Recent Projects',
          description: 'Pick up where you left off',
          color: '#fce4ec',
          onClick: () => navigate('/canvas'),
          testId: 'dashboard-recent-projects',
        },
      ];
    case 'ADMIN':
      return [
        {
          title: 'Manage SKUs',
          description: 'Add, edit, and organize product SKUs',
          color: '#e3f2fd',
          onClick: () => navigate('/admin/skus'),
          testId: 'dashboard-manage-skus',
        },
        {
          title: 'Manage Catalogue',
          description: 'Organize the product catalogue',
          color: '#e8f5e9',
          onClick: () => navigate('/admin/catalogue'),
          testId: 'dashboard-manage-catalogue',
        },
        {
          title: 'Rule Sets',
          description: 'Configure placement and validation rules',
          color: '#fff8e1',
          onClick: () => navigate('/admin/rule-sets'),
          testId: 'dashboard-rule-sets',
        },
      ];
    default:
      return [];
  }
}

function roleLabel(role: UserRole | null): string {
  switch (role) {
    case 'DESIGNER':
      return 'Designer';
    case 'CONSULTANT':
      return 'Consultant';
    case 'ADMIN':
      return 'Administrator';
    default:
      return 'User';
  }
}

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const openPanel = useTemplateManagementStore((s) => s.openPanel);

  const cards = getCardsForRole(role, navigate, openPanel);
  const displayName = user?.email?.split('@')[0] ?? 'there';

  // If no role detected, show a helpful message instead of blank page
  if (!role) {
    return (
      <div data-testid="dashboard-page" style={{ minHeight: '100vh', backgroundColor: '#fafafa', padding: '32px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', textAlign: 'center', paddingTop: '60px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#212121' }}>Welcome, {displayName}!</h1>
          <p style={{ color: '#757575', margin: '12px 0' }}>Your role could not be determined from the session.</p>
          <p style={{ color: '#9e9e9e', fontSize: '13px', margin: '8px 0' }}>
            This usually means the Custom Access Token Hook is not enabled in Supabase.
          </p>
          <p style={{ color: '#9e9e9e', fontSize: '13px', margin: '8px 0' }}>
            app_metadata: {JSON.stringify(user?.app_metadata ?? {})}
          </p>
          <p style={{ color: '#9e9e9e', fontSize: '13px', margin: '8px 0' }}>
            user_metadata: {JSON.stringify(user?.user_metadata ?? {})}
          </p>
          <button
            onClick={() => navigate('/canvas')}
            style={{ marginTop: '20px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, backgroundColor: '#1976d2', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Open Canvas Anyway
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="dashboard-page"
      style={{
        minHeight: '100vh',
        backgroundColor: '#fafafa',
        padding: '32px',
      }}
    >
      {/* Header */}
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '32px',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#212121' }}>
              Welcome back, {displayName}!
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#757575' }}>
              Role: {roleLabel(role)}
            </p>
          </div>
          <button
            onClick={() => navigate('/canvas')}
            data-testid="dashboard-open-canvas"
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              backgroundColor: '#1976d2',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Open Canvas
          </button>
        </div>

        {/* Action Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {cards.map((card) => (
            <div
              key={card.testId}
              data-testid={card.testId}
              onClick={card.onClick}
              style={{
                padding: '24px',
                backgroundColor: card.color,
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow =
                  '0 4px 12px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              }}
            >
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600, color: '#212121' }}>
                {card.title}
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#616161' }}>{card.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
