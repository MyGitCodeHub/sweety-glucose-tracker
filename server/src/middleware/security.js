import rateLimit from 'express-rate-limit';
import { getAuthConfig, parseStrictOrigin } from '../config/auth.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const DEFAULT_AUTH_RATE_LIMIT_MAX = 20;
export const TEST_AUTH_RATE_LIMIT_MAX = 200;

export function requireTrustedOrigin(req, res, next) {
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    return next();
  }

  const { trustedOrigin } = getAuthConfig();
  const requestOrigin = parseStrictOrigin(req.get('origin'));

  if (!requestOrigin || requestOrigin !== trustedOrigin) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN_ORIGIN',
        message: 'Request origin is missing, malformed, or not trusted.',
      },
    });
  }

  return next();
}

export function resolveAuthRateLimitMax(maxOverride) {
  const isTest = process.env.NODE_ENV === 'test';
  if (!isTest) {
    return DEFAULT_AUTH_RATE_LIMIT_MAX;
  }

  return Number.isInteger(maxOverride) && maxOverride > 0
    ? maxOverride
    : TEST_AUTH_RATE_LIMIT_MAX;
}

export function createAuthRateLimiter(maxOverride) {
  const max = resolveAuthRateLimitMax(maxOverride);

  return rateLimit({
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many authentication requests. Please try again later.',
        },
      });
    },
  });
}
