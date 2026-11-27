import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { getSafeInternalRedirect } from '../utils/navigation.js';

export function PublicOnlyRoute() {
  const { user, isCheckingSession } = useAuth();
  const location = useLocation();

  if (isCheckingSession) {
    return (
      <main className="session-loading-shell" role="status" aria-live="polite">
        <div className="surface-card">Loading Sweety...</div>
      </main>
    );
  }

  if (user) {
    const target = getSafeInternalRedirect(location.state?.from, '/');
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
