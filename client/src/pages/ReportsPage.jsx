import { useEffect, useId, useState } from 'react';
import { AlertBanner } from '../components/AlertBanner.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { ReadingsList } from '../components/ReadingsList.jsx';
import { ReportTabs } from '../components/ReportTabs.jsx';
import { StatCard } from '../components/StatCard.jsx';
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

export function ReportsPage() {
  const pageId = useId();
  const today = getTodayKolkataDate();

  const [selectedDate, setSelectedDate] = useState(today);
  const [dateInput, setDateInput] = useState(today);
  const [dateError, setDateError] = useState('');
  const [activeTab, setActiveTab] = useState('daily');

  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

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
        setLoadError(error?.message || 'Unable to load report. Please try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [activeTab, selectedDate]);

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
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            Review Daily, Month-to-date, and previous calendar Monthly glucose statistics.
          </p>
        </div>

        <div className="toolbar-controls">
          <div className="date-filter">
            <label htmlFor={dateInputId} className="field-label">
              Reference date
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
        </div>
      </div>

      {dateError ? (
        <p id={dateErrorId} className="field-error" role="alert">
          {dateError}
        </p>
      ) : null}

      {loadError ? (
        <AlertBanner
          type="error"
          message={loadError}
          onDismiss={() => setLoadError('')}
        />
      ) : null}

      <section className="surface-card page-stack" aria-label="Glucose reports">
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
              Loading report...
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
                        Daily readings ({formatDisplayDate(selectedDate)})
                      </h2>
                      <p className="section-meta">
                        {formatReadingsCountLabel(dailyReadings.length)} included in this report
                      </p>
                    </div>
                  </div>

                  <ReadingsList
                    readings={dailyReadings}
                    readOnly
                    emptyTitle="No readings for this date"
                    emptyMessage="There are no recorded glucose readings for the selected date."
                  />
                </div>
              ) : report?.count === 0 ? (
                <EmptyState
                  title="No readings in this period"
                  message={`No glucose readings were recorded during ${periodMeta.rangeText}.`}
                />
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
