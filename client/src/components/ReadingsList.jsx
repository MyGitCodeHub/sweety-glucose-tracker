import { formatDisplayDate } from '../utils/dates.js';
import { formatGlucose } from '../utils/formatters.js';
import { compareReadingsBySlot, getSlotLabel } from '../utils/slots.js';
import { EmptyState } from './EmptyState.jsx';

export function ReadingsList({
  readings,
  onEdit,
  onDelete,
  emptyTitle = 'No readings recorded',
  emptyMessage = 'There are no glucose readings saved for this date yet.',
  onAddClick,
  addActionLabel = 'Add reading',
  readOnly = false,
}) {
  const orderedReadings = [...(readings || [])].sort(compareReadingsBySlot);

  if (orderedReadings.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        message={emptyMessage}
        actionLabel={!readOnly && onAddClick ? addActionLabel : undefined}
        onAction={!readOnly ? onAddClick : undefined}
      />
    );
  }

  return (
    <ul className="readings-list">
      {orderedReadings.map((reading) => {
        const slotLabel = getSlotLabel(reading.slot);
        const dateLabel = formatDisplayDate(reading.date);
        const valueLabel = formatGlucose(reading.value);

        return (
          <li key={reading.id} className="reading-item">
            <div className="reading-main">
              <span className="reading-slot">{slotLabel}</span>
              <span className="reading-date">{dateLabel}</span>
            </div>

            <div className="reading-value-actions">
              <span className="reading-value">{valueLabel}</span>
              {!readOnly ? (
                <div className="reading-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => onEdit(reading)}
                    aria-label={`Edit ${slotLabel} reading (${valueLabel}) on ${dateLabel}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger-outline"
                    onClick={() => onDelete(reading)}
                    aria-label={`Delete ${slotLabel} reading (${valueLabel}) on ${dateLabel}`}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
