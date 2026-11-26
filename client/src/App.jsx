import { useEffect, useState } from 'react';

const STATUS_LABELS = {
  loading: 'Checking',
  connected: 'Connected',
  unavailable: 'Unavailable',
};

function App() {
  const [status, setStatus] = useState('loading');
  const [detail, setDetail] = useState('Checking backend connection...');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function verifyHealth() {
      try {
        const response = await fetch('/api/health', {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data?.status !== 'ok') {
          throw new Error('Unexpected health payload');
        }

        setStatus('connected');
        setDetail('Backend API is reachable and healthy (status: ok).');
      } catch (error) {
        if (error.name === 'AbortError') {
          return;
        }
        setStatus('unavailable');
        setDetail(
          'Unable to reach /api/health. Confirm the Express server is running on port 3001.'
        );
      }
    }

    verifyHealth();

    return () => {
      controller.abort();
    };
  }, [attempt]);

  function handleRetry() {
    setStatus('loading');
    setDetail('Checking backend connection...');
    setAttempt((count) => count + 1);
  }

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <span className="brand-wordmark">Sweety</span>
          <span className="header-tag">Module 01 Scaffold</span>
        </div>
      </header>

      <main className="container main-content">
        <section className="status-panel" aria-labelledby="sweety-title">
          <h1 id="sweety-title" className="page-title">
            Sweety — Blood Glucose Tracker
          </h1>
          <p className="page-description">
            Personal blood glucose tracking web application for logging readings across daily time
            slots and reviewing daily, month-to-date, and monthly summaries.
          </p>

          <div
            className={`health-box health-box--${status}`}
            role="status"
            aria-live="polite"
          >
            <div className="health-header">
              <h2 className="health-heading">API Health Check</h2>
              <span className={`status-badge status-badge--${status}`}>
                {STATUS_LABELS[status]}
              </span>
            </div>
            <p className="health-detail">{detail}</p>
          </div>

          <div className="actions-row">
            <button
              type="button"
              className="btn-primary"
              onClick={handleRetry}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Checking...' : 'Check API Health'}
            </button>
          </div>
        </section>
      </main>
    </>
  );
}

export default App;
