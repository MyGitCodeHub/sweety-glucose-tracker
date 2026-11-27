import { useEffect, useId, useRef, useState } from 'react';
import { AlertBanner } from '../components/AlertBanner.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { ReadingForm } from '../components/ReadingForm.jsx';
import { ReadingsList } from '../components/ReadingsList.jsx';
import { ReportTabs } from '../components/ReportTabs.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { useAuth } from '../context/useAuth.js';
import {
  formatDisplayDate,
  getTodayKolkataDate,
  validateDateInput,
} from '../utils/dates.js';
import {
  formatAverage,
  formatCount,
  formatGlucose,
  formatReadingsCountLabel,
} from '../utils/formatters.js';
import { describeReportPeriod, fetchReportForPeriod } from '../utils/reports.js';
import { getSlotLabel } from '../utils/slots.js';

export function DashboardPage() {
  const { user } = useAuth();
  const pageId = useId();
  const addButtonRef = useRef(null);
  const today = getTodayKolkataDate();

  const [selectedDate, setSelectedDate] = useState(today);
  const [dateInput, setDateInput] = useState(today);
  const [dateError, setDateError] = useState('');
  const [activeTab, setActiveTab] = useState('daily');
  const [reloadKey, setReloadKey] = useState(0);

  const [report, setReport] = useState(null);
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

    fetchReportForPeriod(activeTab, selectedDate, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setReport(data);
        }
      })
      .catch((error) => {
        if (error?.name === 'AbortError' || controller.signal.aborted) {
          return;
        }
        setLoadError(
          error?.message || 'Unable to load dashboard summary. Please try again.'
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
  }, [activeTab, selectedDate, reloadKey]);

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

    setActiveTab('daily');
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
  const tabIdPrefix = `${pageId}-tab`;
  const panelId = `${pageId}-panel`;

  const periodMeta = describeReportPeriod(activeTab, report);
  const dailyReadings = activeTab === 'daily' && report?.readings ? report.readings : [];

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Welcome back, {user?.name}. Track daily readings and review summaries.
          </p>
        </div>

        <div className="toolbar-controls">
          <div className="date-filter">
            <label htmlFor={dateInputId} className="field-label">
              Selected date
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

      <section className="surface-card page-stack" aria-label="Glucose report summary">
        <div className="report-tabs-bar">
          <ReportTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            tabIdPrefix={tabIdPrefix}
            panelId={panelId}
          />
          <div className="report-range-meta">
            <span>{periodMeta.title}: </span>
            <strong>{periodMeta.rangeText}</strong>
          </div>
        </div>

        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={`${tabIdPrefix}-${activeTab}`}
          className="page-stack"
        >
          {isLoading ? (
            <div className="loading-state" role="status" aria-live="polite">
              Loading report summary...
            </div>
          ) : (
            <>
              <div className="stats-grid">
                <StatCard
                  label="Highest"
                  value={formatGlucose(report?.highest)}
                />
                <StatCard
                  label="Lowest"
                  value={formatGlucose(report?.lowest)}
                />
                <StatCard
                  label="Average"
                  value={formatAverage(report?.average)}
                />
                <StatCard
                  label="Readings count"
                  value={formatCount(report?.count)}
                  caption={
                    report ? formatReadingsCountLabel(report.count) : undefined
                  }
                />
              </div>

              {activeTab === 'daily' ? (
                <div>
                  <div className="section-header">
                    <div>
                      <h2 className="section-title">
                        Readings for {formatDisplayDate(selectedDate)}
                      </h2>
                      <p className="section-meta">
                        {formatReadingsCountLabel(dailyReadings.length)} (maximum 4 per day)
                      </p>
                    </div>
                  </div>

                  <ReadingsList
                    readings={dailyReadings}
                    onEdit={openEditModal}
                    onDelete={setDeleteTarget}
                    emptyTitle="No readings for this date"
                    emptyMessage="Add your first glucose reading for this date to start tracking."
                    onAddClick={openCreateModal}
                  />
                </div>
              ) : report?.count === 0 ? (
                <EmptyState
                  title="No readings in this period"
                  message={`No glucose readings were recorded during ${periodMeta.rangeText}.`}
                  actionLabel={activeTab === 'month-to-date' ? 'Add reading' : undefined}
                  onAction={activeTab === 'month-to-date' ? openCreateModal : undefined}
                />
              ) : null}
            </>
          )}
        </div>
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
