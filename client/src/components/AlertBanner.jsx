const BANNER_LABELS = {
  error: 'Error:',
  success: 'Success:',
  info: 'Notice:',
};

export function AlertBanner({ type = 'error', message, onDismiss }) {
  if (!message) {
    return null;
  }

  const isError = type === 'error';
  const label = BANNER_LABELS[type] || BANNER_LABELS.info;

  return (
    <div
      className={`alert-banner alert-banner--${type}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <div className="alert-banner-content">
        <span className="alert-banner-label">{label}</span>
        <span>{message}</span>
      </div>
      {onDismiss ? (
        <button
          type="button"
          className="alert-banner-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss message"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
