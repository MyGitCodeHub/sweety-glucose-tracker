import { useRef } from 'react';

const REPORT_TAB_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'month-to-date', label: 'Month-to-date' },
  { id: 'monthly', label: 'Monthly' },
];

export function ReportTabs({ activeTab, onChange, tabIdPrefix, panelId }) {
  const tabRefs = useRef([]);

  function handleKeyDown(event, index) {
    let nextIndex = null;

    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % REPORT_TAB_OPTIONS.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + REPORT_TAB_OPTIONS.length) % REPORT_TAB_OPTIONS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = REPORT_TAB_OPTIONS.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const nextTab = REPORT_TAB_OPTIONS[nextIndex];
      onChange(nextTab.id);
      tabRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <div
      className="report-tablist"
      role="tablist"
      aria-label="Report period"
    >
      {REPORT_TAB_OPTIONS.map((tab, index) => {
        const isSelected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={`${tabIdPrefix}-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-controls={isSelected ? panelId : undefined}
            tabIndex={isSelected ? 0 : -1}
            className={`report-tab ${isSelected ? 'report-tab--active' : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
