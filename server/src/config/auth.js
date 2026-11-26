export const AUTH_COOKIE_NAME = 'sweety_token';
export const JWT_ALGORITHM = 'HS256';
export const JWT_EXPIRES_IN = '8h';
export const AUTH_COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;
export const BCRYPT_COST = 12;
export const MIN_JWT_SECRET_BYTES = 32;

export class AuthConfigurationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AuthConfigurationError';
    this.code = code;
  }
}

export function parseStrictOrigin(rawOrigin) {
  if (typeof rawOrigin !== 'string' || rawOrigin.length === 0 || rawOrigin.trim() !== rawOrigin) {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(rawOrigin);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  // Require an exact canonical origin with no path, query, hash, or embedded credentials.
  if (
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    parsed.pathname !== '/' ||
    parsed.origin !== rawOrigin
  ) {
    return null;
  }

  return parsed.origin;
}

export function getAuthConfig() {
  const jwtSecret = process.env.JWT_SECRET;
  if (typeof jwtSecret !== 'string' || jwtSecret.trim().length === 0) {
    throw new AuthConfigurationError('AUTH_CONFIG_MISSING', 'JWT_SECRET must be configured.');
  }

  if (Buffer.byteLength(jwtSecret, 'utf8') < MIN_JWT_SECRET_BYTES) {
    throw new AuthConfigurationError(
      'AUTH_CONFIG_INVALID',
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_BYTES} UTF-8 bytes.`
    );
  }

  const trustedOrigin = parseStrictOrigin(process.env.APP_ORIGIN);
  if (!trustedOrigin) {
    throw new AuthConfigurationError(
      'AUTH_CONFIG_INVALID',
      'APP_ORIGIN must be a valid HTTP/HTTPS origin without path, query, or credentials.'
    );
  }

  const isProduction = process.env.NODE_ENV === 'production';

  return {
    jwtSecret,
    trustedOrigin,
    isProduction,
  };
}

export function validateAuthConfig() {
  return getAuthConfig();
}

export function getAuthCookieOptions() {
  const { isProduction } = getAuthConfig();
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: isProduction,
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  };
}

export function getClearAuthCookieOptions() {
  const { isProduction } = getAuthConfig();
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: isProduction,
  };
}
