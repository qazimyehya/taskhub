import { useAuth } from '../../hooks/useAuth';

const Header = () => {
  const { user, tenantName, logout } = useAuth();

  return (
    <header style={{
      background: '#1a1a2e',
      padding: '16px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid #333'
    }}>
      <div>
        <h1 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>
          TaskHub
        </h1>
        {tenantName && (
          <span style={{ color: '#888', fontSize: '13px' }}>
            {tenantName}
          </span>
        )}
      </div>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: '#aaa', fontSize: '14px' }}>
            {user.email} ({user.role})
          </span>
          <button
            onClick={logout}
            style={{
              background: '#e74c3c',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Logout
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;