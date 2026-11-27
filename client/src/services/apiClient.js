export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN_ERROR' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let unauthorizedHandler = null;
let currentSessionGeneration = 0;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
}

export function advanceSessionGeneration() {
  currentSessionGeneration += 1;
  return currentSessionGeneration;
}

export async function apiRequest(
  path,
  { method = 'GET', body, signal, skipUnauthorizedHandler = false } = {}
) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const requestSessionGeneration = currentSessionGeneration;
  const headers = {};
  const fetchOptions = {
    method,
    credentials: 'same-origin',
    headers,
    signal,
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`/api${normalizedPath}`, fetchOptions);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error;
    }
    throw new ApiError(
      'Unable to reach the server. Please check your connection and try again.',
      { status: 0, code: 'NETWORK_ERROR' }
    );
  }

  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  let payload = null;

  if (isJson) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  }

  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  if (!response.ok) {
    const serverCode = payload?.error?.code || 'API_ERROR';
    const fallbackMessage =
      response.status >= 500
        ? 'An unexpected server error occurred. Please try again.'
        : 'Request could not be completed.';
    const message = payload?.error?.message || fallbackMessage;

    if (
      response.status === 401 &&
      !skipUnauthorizedHandler &&
      unauthorizedHandler &&
      requestSessionGeneration === currentSessionGeneration
    ) {
      unauthorizedHandler(requestSessionGeneration);
    }

    throw new ApiError(message, {
      status: response.status,
      code: serverCode,
    });
  }

  return payload;
}
