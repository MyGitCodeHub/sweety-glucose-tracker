import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { AlertBanner } from './AlertBanner.jsx';

export function ProtectedRoute() {
  const { user, isCheckingSession, sessionCheckError, retrySessionCheck } = useAuth();
  const location = useLocation();

  if (isCheckingSession) {
    return (
      <main className="session-loading-shell" role="status" aria-live="polite">
        <div className="surface-card">Checking your session...</div>
      </main>
    );
  }

  if (sessionCheckError) {
    return (
      <main className="session-loading-shell">
        <div className="auth-card page-stack">
          <div className="auth-brand" style={{ marginBottom: 0 }}>
            <span className="brand-wordmark">Sweety</span>
          </div>
          <h1 className="auth-title">Connection issue</h1>
          <AlertBanner type="error" message={sessionCheckError} />
          <button
            type="button"
            className="btn btn-primary"
            onClick={retrySessionCheck}
          >
            Retry connection
          </button>
        </div>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
