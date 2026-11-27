export function formatGlucose(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return `${value} mg/dl`;
}

export function formatAverage(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return `${Number(value).toFixed(1)} mg/dl`;
}

export function formatCount(count) {
  if (count === null || count === undefined || Number.isNaN(Number(count))) {
    return '0';
  }
  return String(count);
}

export function formatReadingsCountLabel(count) {
  const normalized = Number(count) || 0;
  return `${normalized} ${normalized === 1 ? 'reading' : 'readings'}`;
}
