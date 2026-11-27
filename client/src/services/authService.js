import { apiRequest } from './apiClient.js';

export function registerUser({ name, email, password }, options = {}) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: { name, email, password },
    signal: options.signal,
    skipUnauthorizedHandler: true,
  });
}

export function loginUser({ email, password }, options = {}) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
    signal: options.signal,
    skipUnauthorizedHandler: true,
  });
}

export function logoutUser(options = {}) {
  return apiRequest('/auth/logout', {
    method: 'POST',
    signal: options.signal,
    skipUnauthorizedHandler: true,
  });
}

export function getCurrentUser(options = {}) {
  return apiRequest('/auth/me', {
    method: 'GET',
    signal: options.signal,
    skipUnauthorizedHandler: true,
  });
}
