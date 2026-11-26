import jwt from 'jsonwebtoken';
import { AUTH_COOKIE_NAME, getAuthConfig, JWT_ALGORITHM } from '../config/auth.js';
import { query } from '../db/pool.js';

const PG_INTEGER_MAX = 2147483647;
const CANONICAL_POSITIVE_INT_REGEX = /^[1-9]\d*$/;

function parseCanonicalUserId(subject) {
  if (typeof subject !== 'string' || !CANONICAL_POSITIVE_INT_REGEX.test(subject)) {
    return null;
  }

  const userId = Number(subject);
  if (!Number.isSafeInteger(userId) || userId < 1 || userId > PG_INTEGER_MAX) {
    return null;
  }

  return userId;
}

function sendUnauthorized(res) {
  return res.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required.',
    },
  });
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof token !== 'string' || token.length === 0) {
    return sendUnauthorized(res);
  }

  const { jwtSecret } = getAuthConfig();

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret, {
      algorithms: [JWT_ALGORITHM],
    });
  } catch {
    return sendUnauthorized(res);
  }

  // Require an explicit expiration claim and a canonical positive PG integer subject.
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !Number.isFinite(payload.exp)
  ) {
    return sendUnauthorized(res);
  }

  const userId = parseCanonicalUserId(payload.sub);
  if (userId === null) {
    return sendUnauthorized(res);
  }

  // Let unexpected database errors propagate to the global error handler rather than returning 401.
  const result = await query(
    'SELECT id, name, email FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return sendUnauthorized(res);
  }

  const user = result.rows[0];
  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
  };

  return next();
}
