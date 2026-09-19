import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const Header = () => {
  const { user, tenantName, logout } = useAuth();
  const location = useLocation();

  const navLinkStyle = (path: string) => ({
    color: location.pathname === path ? '#fff' : '#aaa',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: location.pathname === path ? 600 : 400,
    padding: '6px 12px',
    borderRadius: '6px',
    background: location.pathname === path ? 'rgba(255,255,255,0.1)' : 'transparent',
  });

  return (
    <header className="app-header" style={{
      background: '#1a1a2e',
      padding: '16px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid #333',
    }}>
      {/* Left: Logo + Nav */}
      <div className="app-header__left" style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        <div className="app-header__brand">
          <h1 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>
            TaskHub
          </h1>
          {tenantName && (
            <span style={{ color: '#888', fontSize: '12px' }}>
              {tenantName}
            </span>
          )}
        </div>

        {user && (
          <nav className="app-header__nav" style={{ display: 'flex', gap: '4px' }}>
            <Link to="/tasks" style={navLinkStyle('/tasks')}>
              Tasks
            </Link>
            <Link to="/projects" style={navLinkStyle('/projects')}>
              Projects
            </Link>
            <Link to="/team" style={navLinkStyle('/team')}>
              Team
            </Link>
          </nav>
        )}
      </div>

      {/* Right: User info + Logout */}
      {user && (
        <div className="app-header__user" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div className="app-header__email" style={{ color: '#fff', fontSize: '13px' }}>
              {user.email}
            </div>
            <div style={{
              color: user.role === 'admin' ? '#e74c3c' : '#3498db',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}>
              {user.role}
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              background: '#e74c3c',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
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