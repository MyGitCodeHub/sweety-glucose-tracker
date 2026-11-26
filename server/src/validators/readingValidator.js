import { getTodayKolkataDate, parseCalendarDate } from '../utils/dates.js';

export const READING_SLOTS = [
  'morning_fasting',
  'after_breakfast',
  'after_lunch',
  'after_dinner',
];

export const SLOT_LABELS = {
  morning_fasting: 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};

export const MIN_GLUCOSE_VALUE = 40;
export const MAX_GLUCOSE_VALUE = 600;
const PG_INTEGER_MAX = 2147483647;
const CANONICAL_POSITIVE_INT_REGEX = /^[1-9]\d*$/;

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateReadingId(rawId) {
  if (typeof rawId !== 'string' || !CANONICAL_POSITIVE_INT_REGEX.test(rawId)) {
    return {
      error: {
        code: 'INVALID_READING_ID',
        message: 'Reading ID must be a positive integer.',
      },
    };
  }

  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1 || id > PG_INTEGER_MAX) {
    return {
      error: {
        code: 'INVALID_READING_ID',
        message: 'Reading ID must be a positive integer.',
      },
    };
  }

  return { id };
}

export function validateReadingDate(rawDate, { requiredMessage = 'Please select a date.' } = {}) {
  if (rawDate === undefined || rawDate === null || (typeof rawDate === 'string' && rawDate.trim() === '')) {
    return {
      error: {
        code: 'DATE_REQUIRED',
        message: requiredMessage,
      },
    };
  }

  if (typeof rawDate !== 'string' || !parseCalendarDate(rawDate)) {
    return {
      error: {
        code: 'INVALID_DATE',
        message: 'Please enter a valid calendar date in YYYY-MM-DD format.',
      },
    };
  }

  if (rawDate > getTodayKolkataDate()) {
    return {
      error: {
        code: 'FUTURE_DATE',
        message: 'Date cannot be in the future.',
      },
    };
  }

  return { date: rawDate };
}

export function validateDateQueryParam(rawQueryDate) {
  if (rawQueryDate === undefined) {
    return { date: getTodayKolkataDate() };
  }

  if (typeof rawQueryDate !== 'string' || rawQueryDate.trim() === '') {
    return {
      error: {
        code: 'INVALID_DATE',
        message: 'Please enter a valid calendar date in YYYY-MM-DD format.',
      },
    };
  }

  return validateReadingDate(rawQueryDate);
}

export function validateReadingSlot(rawSlot) {
  if (rawSlot === undefined || rawSlot === null || (typeof rawSlot === 'string' && rawSlot.trim() === '')) {
    return {
      error: {
        code: 'SLOT_REQUIRED',
        message: 'Please select a reading time slot.',
      },
    };
  }

  if (typeof rawSlot !== 'string' || !Object.hasOwn(SLOT_LABELS, rawSlot)) {
    return {
      error: {
        code: 'INVALID_SLOT',
        message:
          'Time slot must be one of morning_fasting, after_breakfast, after_lunch, or after_dinner.',
      },
    };
  }

  return { slot: rawSlot };
}

export function validateGlucoseValue(rawValue) {
  if (
    rawValue === undefined ||
    rawValue === null ||
    (typeof rawValue === 'string' && rawValue.trim() === '')
  ) {
    return {
      error: {
        code: 'VALUE_REQUIRED',
        message: 'Please enter a glucose value.',
      },
    };
  }

  if (
    typeof rawValue !== 'number' ||
    !Number.isInteger(rawValue) ||
    rawValue < MIN_GLUCOSE_VALUE ||
    rawValue > MAX_GLUCOSE_VALUE
  ) {
    return {
      error: {
        code: 'VALUE_RANGE',
        message: 'Value must be between 40 and 600 mg/dl.',
      },
    };
  }

  return { value: rawValue };
}

export function validateReadingPayload(body) {
  if (!isPlainObject(body)) {
    return {
      error: {
        code: 'INVALID_REQUEST',
        message: 'Request body must be a JSON object.',
      },
    };
  }

  const dateResult = validateReadingDate(body.date);
  if (dateResult.error) {
    return { error: dateResult.error };
  }

  const slotResult = validateReadingSlot(body.slot);
  if (slotResult.error) {
    return { error: slotResult.error };
  }

  const valueResult = validateGlucoseValue(body.value);
  if (valueResult.error) {
    return { error: valueResult.error };
  }

  return {
    data: {
      date: dateResult.date,
      slot: slotResult.slot,
      value: valueResult.value,
    },
  };
}
