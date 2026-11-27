import { useEffect, useId, useRef, useState } from 'react';
import { deleteReading } from '../services/readingsService.js';
import { formatDisplayDate } from '../utils/dates.js';
import { formatGlucose } from '../utils/formatters.js';
import { getSlotLabel } from '../utils/slots.js';
import { AlertBanner } from './AlertBanner.jsx';

function restoreFocusTarget(previousElement, fallbackElement) {
  if (previousElement instanceof HTMLElement && previousElement.isConnected) {
    previousElement.focus();
    return;
  }
  if (fallbackElement instanceof HTMLElement && fallbackElement.isConnected) {
    fallbackElement.focus();
    return;
  }
  const heading = document.querySelector('main h1, main h2');
  if (heading instanceof HTMLElement) {
    if (!heading.hasAttribute('tabindex')) {
      heading.setAttribute('tabindex', '-1');
    }
    heading.focus();
  }
}

export function ConfirmDialog({
  isOpen,
  reading,
  fallbackFocusRef,
  onClose,
  onDeleted,
}) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const wasDeletedRef = useRef(false);
  const dialogId = useId();
  const [errorMessage, setErrorMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (isOpen && reading) {
      previousFocusRef.current = document.activeElement;
      wasDeletedRef.current = false;
      setErrorMessage('');
      setIsDeleting(false);
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
      const previousElement = previousFocusRef.current;
      const fallbackElement = fallbackFocusRef?.current ?? null;
      const deleted = wasDeletedRef.current;

      previousFocusRef.current = null;
      wasDeletedRef.current = false;

      if (deleted) {
        // After a confirmed deletion, the source reading row unmounts on refresh,
        // so move focus directly to the surviving fallback control/heading.
        restoreFocusTarget(null, fallbackElement);
      } else if (previousElement) {
        restoreFocusTarget(previousElement, fallbackElement);
      }
    }
  }, [isOpen, reading, fallbackFocusRef]);

  function handleDialogCancel(event) {
    event.preventDefault();
    if (!isDeleting) {
      onClose();
    }
  }

  function handleBackdropClick(event) {
    if (event.target === dialogRef.current && !isDeleting) {
      onClose();
    }
  }

  async function handleConfirmDelete() {
    if (!reading) {
      return;
    }

    setErrorMessage('');
    setIsDeleting(true);
    try {
      await deleteReading(reading.id);
      wasDeletedRef.current = true;
      onDeleted(reading);
    } catch (error) {
      setErrorMessage(
        error?.message || 'Unable to delete this reading right now. Please try again.'
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const titleId = `${dialogId}-title`;
  const descId = `${dialogId}-desc`;

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={handleDialogCancel}
      onClick={handleBackdropClick}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">
            Delete reading
          </h2>
          <button
            type="button"
            className="btn-text"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close dialog"
          >
            Close
          </button>
        </div>

        <p id={descId} className="page-subtitle" style={{ margin: 0 }}>
          Are you sure you want to delete this reading? This action cannot be undone.
        </p>

        {reading ? (
          <dl className="confirm-details">
            <div className="confirm-detail-row">
              <dt className="confirm-detail-label">Date</dt>
              <dd className="confirm-detail-value" style={{ margin: 0 }}>
                {formatDisplayDate(reading.date)}
              </dd>
            </div>
            <div className="confirm-detail-row">
              <dt className="confirm-detail-label">Time slot</dt>
              <dd className="confirm-detail-value" style={{ margin: 0 }}>
                {getSlotLabel(reading.slot)}
              </dd>
            </div>
            <div className="confirm-detail-row">
              <dt className="confirm-detail-label">Glucose</dt>
              <dd className="confirm-detail-value" style={{ margin: 0 }}>
                {formatGlucose(reading.value)}
              </dd>
            </div>
          </dl>
        ) : null}

        {errorMessage ? <AlertBanner type="error" message={errorMessage} /> : null}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete reading'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
