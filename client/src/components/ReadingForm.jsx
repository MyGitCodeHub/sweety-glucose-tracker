import { useEffect, useId, useRef, useState } from 'react';
import { createReading, updateReading } from '../services/readingsService.js';
import { getTodayKolkataDate, validateDateInput } from '../utils/dates.js';
import { READING_SLOTS, SLOT_LABELS } from '../utils/slots.js';
import { AlertBanner } from './AlertBanner.jsx';

const INTEGER_PATTERN = /^-?\d+$/;
const MIN_GLUCOSE_VALUE = 40;
const MAX_GLUCOSE_VALUE = 600;

function validateReadingFields(date, slot, rawValue) {
  const errors = {};

  const dateError = validateDateInput(date);
  if (dateError) {
    errors.date = dateError;
  }

  if (!slot || !Object.hasOwn(SLOT_LABELS, slot)) {
    errors.slot = 'Please select a reading time slot.';
  }

  const trimmedValue = String(rawValue ?? '').trim();
  if (trimmedValue === '') {
    errors.value = 'Please enter a glucose value.';
  } else if (!INTEGER_PATTERN.test(trimmedValue)) {
    errors.value = 'Value must be between 40 and 600 mg/dl.';
  } else {
    const parsedValue = Number.parseInt(trimmedValue, 10);
    if (
      !Number.isSafeInteger(parsedValue) ||
      parsedValue < MIN_GLUCOSE_VALUE ||
      parsedValue > MAX_GLUCOSE_VALUE
    ) {
      errors.value = 'Value must be between 40 and 600 mg/dl.';
    }
  }

  return errors;
}

export function ReadingForm({
  isOpen,
  mode = 'create',
  initialReading = null,
  defaultDate,
  onClose,
  onSaved,
}) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const formId = useId();
  const today = getTodayKolkataDate();

  const [date, setDate] = useState(defaultDate || today);
  const [slot, setSlot] = useState(READING_SLOTS[0]);
  const [valueInput, setValueInput] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isEditMode = mode === 'edit' && Boolean(initialReading);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      setFieldErrors({});
      setServerError('');
      setIsSaving(false);

      if (mode === 'edit' && initialReading) {
        setDate(initialReading.date);
        setSlot(initialReading.slot);
        setValueInput(String(initialReading.value));
      } else {
        setDate(defaultDate || getTodayKolkataDate());
        setSlot(READING_SLOTS[0]);
        setValueInput('');
      }

      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
      if (
        previousFocusRef.current instanceof HTMLElement &&
        previousFocusRef.current.isConnected
      ) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    }
  }, [isOpen, mode, initialReading, defaultDate]);

  function handleDialogCancel(event) {
    event.preventDefault();
    if (!isSaving) {
      onClose();
    }
  }

  function handleBackdropClick(event) {
    if (event.target === dialogRef.current && !isSaving) {
      onClose();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setServerError('');

    const errors = validateReadingFields(date, slot, valueInput);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const numericValue = Number.parseInt(valueInput.trim(), 10);
    const payload = {
      date,
      slot,
      value: numericValue,
    };

    setIsSaving(true);
    try {
      const savedReading = isEditMode
        ? await updateReading(initialReading.id, payload)
        : await createReading(payload);
      onSaved(savedReading);
    } catch (error) {
      setServerError(error?.message || 'Unable to save reading. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  const titleId = `${formId}-title`;
  const dateId = `${formId}-date`;
  const dateErrorId = `${formId}-date-error`;
  const slotId = `${formId}-slot`;
  const slotErrorId = `${formId}-slot-error`;
  const valueId = `${formId}-value`;
  const valueHintId = `${formId}-value-hint`;
  const valueErrorId = `${formId}-value-error`;

  const valueDescribedBy = fieldErrors.value
    ? `${valueHintId} ${valueErrorId}`
    : valueHintId;

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog"
      aria-labelledby={titleId}
      onCancel={handleDialogCancel}
      onClick={handleBackdropClick}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">
            {isEditMode ? 'Edit reading' : 'Add reading'}
          </h2>
          <button
            type="button"
            className="btn-text"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close dialog"
          >
            Close
          </button>
        </div>

        {serverError ? <AlertBanner type="error" message={serverError} /> : null}

        <form onSubmit={handleSubmit} className="form-stack" noValidate>
          <div className="form-field">
            <label htmlFor={dateId} className="field-label">
              Date
            </label>
            <input
              id={dateId}
              name="date"
              type="date"
              max={today}
              className={`field-input ${fieldErrors.date ? 'field-input--error' : ''}`}
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                if (fieldErrors.date) {
                  setFieldErrors((prev) => ({ ...prev, date: '' }));
                }
              }}
              aria-invalid={Boolean(fieldErrors.date)}
              aria-describedby={fieldErrors.date ? dateErrorId : undefined}
              disabled={isSaving}
            />
            {fieldErrors.date ? (
              <p id={dateErrorId} className="field-error" role="alert">
                {fieldErrors.date}
              </p>
            ) : null}
          </div>

          <div className="form-field">
            <label htmlFor={slotId} className="field-label">
              Time slot
            </label>
            <select
              id={slotId}
              name="slot"
              className={`field-select ${fieldErrors.slot ? 'field-select--error' : ''}`}
              value={slot}
              onChange={(event) => {
                setSlot(event.target.value);
                if (fieldErrors.slot) {
                  setFieldErrors((prev) => ({ ...prev, slot: '' }));
                }
              }}
              aria-invalid={Boolean(fieldErrors.slot)}
              aria-describedby={fieldErrors.slot ? slotErrorId : undefined}
              disabled={isSaving}
            >
              {READING_SLOTS.map((slotCode) => (
                <option key={slotCode} value={slotCode}>
                  {SLOT_LABELS[slotCode]}
                </option>
              ))}
            </select>
            {fieldErrors.slot ? (
              <p id={slotErrorId} className="field-error" role="alert">
                {fieldErrors.slot}
              </p>
            ) : null}
          </div>

          <div className="form-field">
            <label htmlFor={valueId} className="field-label">
              Glucose value
            </label>
            <div className="input-unit-row">
              <input
                id={valueId}
                name="value"
                type="text"
                inputMode="numeric"
                className={`field-input ${fieldErrors.value ? 'field-input--error' : ''}`}
                value={valueInput}
                onChange={(event) => {
                  setValueInput(event.target.value);
                  if (fieldErrors.value) {
                    setFieldErrors((prev) => ({ ...prev, value: '' }));
                  }
                }}
                aria-invalid={Boolean(fieldErrors.value)}
                aria-describedby={valueDescribedBy}
                disabled={isSaving}
              />
              <span className="input-unit-label">mg/dl</span>
            </div>
            <p id={valueHintId} className="field-hint">
              Enter a whole number between 40 and 600 mg/dl.
            </p>
            {fieldErrors.value ? (
              <p id={valueErrorId} className="field-error" role="alert">
                {fieldErrors.value}
              </p>
            ) : null}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
            >
              {isSaving
                ? 'Saving...'
                : isEditMode
                  ? 'Save changes'
                  : 'Save reading'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
