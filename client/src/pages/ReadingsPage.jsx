import { useEffect, useId, useRef, useState } from 'react';
import { AlertBanner } from '../components/AlertBanner.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { ReadingForm } from '../components/ReadingForm.jsx';
import { ReadingsList } from '../components/ReadingsList.jsx';
import { getReadings } from '../services/readingsService.js';
import {
  formatDisplayDate,
  getTodayKolkataDate,
  validateDateInput,
} from '../utils/dates.js';
import { formatReadingsCountLabel } from '../utils/formatters.js';
import { getSlotLabel } from '../utils/slots.js';

export function ReadingsPage() {
  const pageId = useId();
  const addButtonRef = useRef(null);
  const today = getTodayKolkataDate();

  const [selectedDate, setSelectedDate] = useState(today);
  const [dateInput, setDateInput] = useState(today);
  const [dateError, setDateError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [readings, setReadings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const [formState, setFormState] = useState({
    isOpen: false,
    mode: 'create',
    reading: null,
  });
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError('');

    getReadings(selectedDate, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setReadings(Array.isArray(data) ? data : []);
        }
      })
      .catch((error) => {
        if (error?.name === 'AbortError' || controller.signal.aborted) {
          return;
        }
        setLoadError(
          error?.message || 'Unable to load readings for this date. Please try again.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedDate, reloadKey]);

  function handleDateChange(event) {
    const nextValue = event.target.value;
    setDateInput(nextValue);

    const validationError = validateDateInput(nextValue);
    if (validationError) {
      setDateError(validationError);
      return;
    }

    setDateError('');
    setSelectedDate(nextValue);
  }

  function openCreateModal() {
    setFormState({ isOpen: true, mode: 'create', reading: null });
  }

  function openEditModal(reading) {
    setFormState({ isOpen: true, mode: 'edit', reading });
  }

  function closeFormModal() {
    setFormState({ isOpen: false, mode: 'create', reading: null });
  }

  function handleReadingSaved(savedReading) {
    const wasCreate = formState.mode === 'create';
    closeFormModal();

    const savedDateLabel = formatDisplayDate(savedReading.date);
    if (savedReading.date !== selectedDate) {
      setDateInput(savedReading.date);
      setDateError('');
      setSelectedDate(savedReading.date);
      setFeedbackMessage(
        `${wasCreate ? 'Reading added' : 'Reading updated'} for ${savedDateLabel}. Switched view to ${savedDateLabel}.`
      );
    } else {
      setFeedbackMessage(
        wasCreate
          ? `Added ${getSlotLabel(savedReading.slot)} reading for ${savedDateLabel}.`
          : `Updated ${getSlotLabel(savedReading.slot)} reading for ${savedDateLabel}.`
      );
    }

    setReloadKey((count) => count + 1);
  }

  function handleReadingDeleted(deletedReading) {
    setDeleteTarget(null);
    setFeedbackMessage(
      `Deleted ${getSlotLabel(deletedReading.slot)} reading for ${formatDisplayDate(deletedReading.date)}.`
    );
    setReloadKey((count) => count + 1);
  }

  const dateInputId = `${pageId}-date`;
  const dateErrorId = `${pageId}-date-error`;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Readings</h1>
          <p className="page-subtitle">
            Log, review, edit, or delete up to four readings per calendar day.
          </p>
        </div>

        <div className="toolbar-controls">
          <div className="date-filter">
            <label htmlFor={dateInputId} className="field-label">
              Filter by date
            </label>
            <input
              id={dateInputId}
              type="date"
              max={today}
              className={`field-input ${dateError ? 'field-input--error' : ''}`}
              value={dateInput}
              onChange={handleDateChange}
              aria-invalid={Boolean(dateError)}
              aria-describedby={dateError ? dateErrorId : undefined}
            />
          </div>

          <button
            ref={addButtonRef}
            type="button"
            className="btn btn-primary"
            onClick={openCreateModal}
          >
            Add reading
          </button>
        </div>
      </div>

      {dateError ? (
        <p id={dateErrorId} className="field-error" role="alert">
          {dateError}
        </p>
      ) : null}

      {feedbackMessage ? (
        <AlertBanner
          type="success"
          message={feedbackMessage}
          onDismiss={() => setFeedbackMessage('')}
        />
      ) : null}

      {loadError ? (
        <AlertBanner
          type="error"
          message={loadError}
          onDismiss={() => setLoadError('')}
        />
      ) : null}

      <section className="surface-card" aria-labelledby={`${pageId}-list-heading`}>
        <div className="section-header">
          <div>
            <h2 id={`${pageId}-list-heading`} className="section-title">
              Readings for {formatDisplayDate(selectedDate)}
            </h2>
            <p className="section-meta">
              {formatReadingsCountLabel(readings.length)} saved (maximum 4 per day)
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="loading-state" role="status" aria-live="polite">
            Loading readings...
          </div>
        ) : (
          <ReadingsList
            readings={readings}
            onEdit={openEditModal}
            onDelete={setDeleteTarget}
            emptyTitle="No readings for this date"
            emptyMessage="Add a blood glucose reading for this date using the button below."
            onAddClick={openCreateModal}
          />
        )}
      </section>

      <ReadingForm
        isOpen={formState.isOpen}
        mode={formState.mode}
        initialReading={formState.reading}
        defaultDate={selectedDate}
        onClose={closeFormModal}
        onSaved={handleReadingSaved}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        reading={deleteTarget}
        fallbackFocusRef={addButtonRef}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleReadingDeleted}
      />
    </div>
  );
}
