import { apiRequest } from './apiClient.js';

function buildDateQuery(date) {
  return date ? `?date=${encodeURIComponent(date)}` : '';
}

export function getDailyReport(date, options = {}) {
  return apiRequest(`/reports/daily${buildDateQuery(date)}`, {
    method: 'GET',
    signal: options.signal,
  });
}

export function getMonthToDateReport(date, options = {}) {
  return apiRequest(`/reports/month-to-date${buildDateQuery(date)}`, {
    method: 'GET',
    signal: options.signal,
  });
}

export function getMonthlyReport(date, options = {}) {
  return apiRequest(`/reports/monthly${buildDateQuery(date)}`, {
    method: 'GET',
    signal: options.signal,
  });
}
