import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { AlertBanner } from './AlertBanner.jsx';

function getNavLinkClass({ isActive }) {
  return isActive ? 'nav-link nav-link--active' : 'nav-link';
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(null);

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      setLogoutError(error?.message || 'Unable to log out right now. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <div className="header-left">
            <Link to="/" className="brand-wordmark">
              Sweety
            </Link>
            <nav aria-label="Primary navigation" className="primary-nav">
              <NavLink to="/" end className={getNavLinkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/readings" className={getNavLinkClass}>
                Readings
              </NavLink>
              <NavLink to="/reports" className={getNavLinkClass}>
                Reports
              </NavLink>
            </nav>
          </div>

          <div className="header-user">
            <span className="user-name">{user?.name}</span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? 'Logging out...' : 'Log out'}
            </button>
          </div>
        </div>
      </header>

      <main className="container main-content">
        {logoutError ? (
          <div style={{ marginBottom: '16px' }}>
            <AlertBanner
              type="error"
              message={logoutError}
              onDismiss={() => setLogoutError(null)}
            />
          </div>
        ) : null}
        <Outlet />
      </main>
    </>
  );
}
