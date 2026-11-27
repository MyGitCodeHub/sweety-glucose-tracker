import { apiRequest } from './apiClient.js';

export function getReadings(date, options = {}) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiRequest(`/readings${query}`, {
    method: 'GET',
    signal: options.signal,
  });
}

export function createReading({ date, slot, value }, options = {}) {
  return apiRequest('/readings', {
    method: 'POST',
    body: { date, slot, value },
    signal: options.signal,
  });
}

export function updateReading(id, { date, slot, value }, options = {}) {
  return apiRequest(`/readings/${encodeURIComponent(String(id))}`, {
    method: 'PUT',
    body: { date, slot, value },
    signal: options.signal,
  });
}

export function deleteReading(id, options = {}) {
  return apiRequest(`/readings/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
    signal: options.signal,
  });
}
