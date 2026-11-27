export const APP_TIMEZONE = 'Asia/Kolkata';

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const FULL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Returns today's calendar date in Asia/Kolkata as YYYY-MM-DD.
 */
export function getTodayKolkataDate(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(now);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

/**
 * Strictly validates a YYYY-MM-DD calendar date without local-timezone drift.
 */
export function parseCalendarDate(dateString) {
  if (typeof dateString !== 'string') {
    return null;
  }

  const match = DATE_ONLY_REGEX.exec(dateString);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const utcDate = new Date(0);
  utcDate.setUTCFullYear(year, month - 1, day);
  utcDate.setUTCHours(0, 0, 0, 0);

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day, dateString };
}

export function isValidCalendarDate(dateString) {
  return parseCalendarDate(dateString) !== null;
}

export function isFutureKolkataDate(dateString, now = new Date()) {
  const parsed = parseCalendarDate(dateString);
  if (!parsed) {
    return false;
  }
  return parsed.dateString > getTodayKolkataDate(now);
}

/**
 * Mirrors the server reading/report date validation messages.
 */
export function validateDateInput(dateString, { requiredMessage = 'Please select a date.' } = {}) {
  if (typeof dateString !== 'string' || dateString.trim() === '') {
    return requiredMessage;
  }
  if (!isValidCalendarDate(dateString)) {
    return 'Please enter a valid calendar date in YYYY-MM-DD format.';
  }
  if (isFutureKolkataDate(dateString)) {
    return 'Date cannot be in the future.';
  }
  return null;
}

export function formatDisplayDate(dateString) {
  const parsed = parseCalendarDate(dateString);
  if (!parsed) {
    return dateString || '—';
  }
  return `${parsed.day} ${SHORT_MONTHS[parsed.month - 1]} ${parsed.year}`;
}

export function formatMonthYear(dateString) {
  const parsed = parseCalendarDate(dateString);
  if (!parsed) {
    return '';
  }
  return `${FULL_MONTHS[parsed.month - 1]} ${parsed.year}`;
}

export function formatReportRange(startDate, endDate) {
  const start = parseCalendarDate(startDate);
  const end = parseCalendarDate(endDate);
  if (!start || !end) {
    return '—';
  }

  if (start.dateString === end.dateString) {
    return formatDisplayDate(start.dateString);
  }

  if (start.year === end.year) {
    return `${start.day} ${SHORT_MONTHS[start.month - 1]} – ${end.day} ${SHORT_MONTHS[end.month - 1]} ${end.year}`;
  }

  return `${formatDisplayDate(start.dateString)} – ${formatDisplayDate(end.dateString)}`;
}
