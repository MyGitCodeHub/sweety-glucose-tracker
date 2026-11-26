export const APP_TIMEZONE = 'Asia/Kolkata';

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatDateOnly(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

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

  // Reject year zero and avoid Date.UTC()'s 0..99 -> 1900..1999 year mapping.
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
