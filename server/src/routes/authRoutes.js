import bcrypt from 'bcrypt';
import express from 'express';
import jwt from 'jsonwebtoken';
import {
  AUTH_COOKIE_NAME,
  BCRYPT_COST,
  getAuthConfig,
  getAuthCookieOptions,
  getClearAuthCookieOptions,
  JWT_ALGORITHM,
  JWT_EXPIRES_IN,
} from '../config/auth.js';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { createAuthRateLimiter } from '../middleware/security.js';
import {
  MAX_BCRYPT_PASSWORD_BYTES,
  validateLoginInput,
  validateRegistrationInput,
} from '../validators/authValidator.js';

let dummyPasswordHashPromise = null;

function getDummyPasswordHash() {
  if (!dummyPasswordHashPromise) {
    dummyPasswordHashPromise = bcrypt.hash('sweety-dummy-timing-guard', BCRYPT_COST);
  }
  return dummyPasswordHashPromise;
}

function sendInvalidCredentials(res) {
  return res.status(401).json({
    error: {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    },
  });
}

export function createAuthRouter({ authRateLimitMax } = {}) {
  const router = express.Router();
  const authLimiter = createAuthRateLimiter(authRateLimitMax);

  router.post('/register', authLimiter, async (req, res) => {
    const { data, error } = validateRegistrationInput(req.body);
    if (error) {
      return res.status(400).json({ error });
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_COST);

    let result;
    try {
      result = await query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, name, email`,
        [data.name, data.email, passwordHash]
      );
    } catch (dbError) {
      if (dbError?.code === '23505' && dbError?.constraint === 'uq_users_email') {
        return res.status(409).json({
          error: {
            code: 'EMAIL_EXISTS',
            message: 'An account with this email already exists.',
          },
        });
      }
      throw dbError;
    }

    const user = result.rows[0];
    return res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  });

  router.post('/login', authLimiter, async (req, res) => {
    const { data, error } = validateLoginInput(req.body);
    if (error) {
      return res.status(400).json({ error });
    }

    if (Buffer.byteLength(data.password, 'utf8') > MAX_BCRYPT_PASSWORD_BYTES) {
      await bcrypt.compare('oversized-password-guard', await getDummyPasswordHash());
      return sendInvalidCredentials(res);
    }

    const result = await query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [data.email]
    );

    if (result.rows.length === 0) {
      await bcrypt.compare(data.password, await getDummyPasswordHash());
      return sendInvalidCredentials(res);
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(data.password, user.password_hash);
    if (!passwordMatches) {
      return sendInvalidCredentials(res);
    }

    const { jwtSecret } = getAuthConfig();
    const token = jwt.sign({}, jwtSecret, {
      algorithm: JWT_ALGORITHM,
      expiresIn: JWT_EXPIRES_IN,
      subject: String(user.id),
    });

    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
    return res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME, getClearAuthCookieOptions());
    return res.status(204).end();
  });

  router.get('/me', requireAuth, (req, res) => {
    return res.status(200).json({
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    });
  });

  return router;
}
