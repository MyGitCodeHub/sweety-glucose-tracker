import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app, { createApp } from '../src/app.js';
import {
  AUTH_COOKIE_NAME,
  getAuthConfig,
  getAuthCookieOptions,
  getClearAuthCookieOptions,
  JWT_ALGORITHM,
} from '../src/config/auth.js';
import { query, resolveDatabaseConfig } from '../src/db/pool.js';
import {
  DEFAULT_AUTH_RATE_LIMIT_MAX,
  resolveAuthRateLimitMax,
  TEST_AUTH_RATE_LIMIT_MAX,
} from '../src/middleware/security.js';
import { closeTestDb, resetTestDatabase, verifyTestDatabaseIdentity } from './helpers/db.js';

const TRUSTED_ORIGIN = process.env.APP_ORIGIN;

function extractCookieValue(setCookieHeaders, cookieName) {
  if (!Array.isArray(setCookieHeaders)) {
    return null;
  }

  const prefix = `${cookieName}=`;
  const matchingHeader = setCookieHeaders.find((header) => header.startsWith(prefix));
  if (!matchingHeader) {
    return null;
  }

  return matchingHeader;
}

describe('Module 03 — Authentication, security, and test DB isolation', () => {
  beforeAll(async () => {
    await verifyTestDatabaseIdentity();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('POST /api/auth/register', () => {
    it('registers a user, trims name, normalizes email, hashes password with bcrypt, and does not auto-login', async () => {
      const password = 'ValidPassword123!';
      const res = await request(app)
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: '  Alice Patel  ',
          email: '  Alice.Patel@Example.COM ',
          password,
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(Number),
        name: 'Alice Patel',
        email: 'alice.patel@example.com',
      });
      expect(res.body.password_hash).toBeUndefined();
      expect(res.body.passwordHash).toBeUndefined();
      expect(res.body.token).toBeUndefined();
      expect(res.headers['set-cookie']).toBeUndefined();

      const dbResult = await query(
        'SELECT id, name, email, password_hash FROM users WHERE email = $1',
        ['alice.patel@example.com']
      );
      expect(dbResult.rows).toHaveLength(1);
      const storedUser = dbResult.rows[0];
      expect(storedUser.password_hash).toMatch(/^\$2[aby]\$12\$/);
      await expect(bcrypt.compare(password, storedUser.password_hash)).resolves.toBe(true);
    });

    it('rejects missing or blank names', async () => {
      for (const badName of [undefined, '', '   ']) {
        const res = await request(app)
          .post('/api/auth/register')
          .set('Origin', TRUSTED_ORIGIN)
          .send({
            name: badName,
            email: 'valid@example.com',
            password: 'ValidPassword123!',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('NAME_REQUIRED');
      }
    });

    it('rejects invalid email formats', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: 'Test User',
          email: 'not-an-email',
          password: 'ValidPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_EMAIL');
    });

    it('rejects missing and whitespace-only passwords', async () => {
      for (const badPassword of [undefined, '', '        ']) {
        const res = await request(app)
          .post('/api/auth/register')
          .set('Origin', TRUSTED_ORIGIN)
          .send({
            name: 'Test User',
            email: 'user@example.com',
            password: badPassword,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('PASSWORD_REQUIRED');
      }
    });

    it('rejects passwords shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: 'Test User',
          email: 'short@example.com',
          password: 'abc1234',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PASSWORD_TOO_SHORT');
    });

    it('rejects passwords exceeding 72 UTF-8 bytes including multi-byte characters', async () => {
      const asciiTooLong = 'a'.repeat(73);
      const utf8TooLong = 'é'.repeat(37); // 37 chars, 74 UTF-8 bytes

      for (const password of [asciiTooLong, utf8TooLong]) {
        const res = await request(app)
          .post('/api/auth/register')
          .set('Origin', TRUSTED_ORIGIN)
          .send({
            name: 'Test User',
            email: 'long@example.com',
            password,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('PASSWORD_TOO_LONG');
      }
    });

    it('preserves leading and trailing spaces in valid passwords without trimming', async () => {
      const paddedPassword = '  ValidPass123  ';
      const registerRes = await request(app)
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: 'Padded Pass User',
          email: 'padded@example.com',
          password: paddedPassword,
        });
      expect(registerRes.status).toBe(201);

      const trimmedLoginRes = await request(app)
        .post('/api/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          email: 'padded@example.com',
          password: paddedPassword.trim(),
        });
      expect(trimmedLoginRes.status).toBe(401);

      const exactLoginRes = await request(app)
        .post('/api/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          email: 'padded@example.com',
          password: paddedPassword,
        });
      expect(exactLoginRes.status).toBe(200);
    });

    it('rejects duplicate emails including capitalization differences with HTTP 409', async () => {
      const first = await request(app)
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: 'First User',
          email: 'duplicate@example.com',
          password: 'ValidPassword123!',
        });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: 'Second User',
          email: 'Duplicate@Example.COM',
          password: 'AnotherPassword123!',
        });

      expect(second.status).toBe(409);
      expect(second.body).toEqual({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists.',
        },
      });
    });

    it('handles concurrent duplicate registrations with one 201, one 409 EMAIL_EXISTS, and one row', async () => {
      const [firstRes, secondRes] = await Promise.all([
        request(app)
          .post('/api/auth/register')
          .set('Origin', TRUSTED_ORIGIN)
          .send({
            name: 'Concurrent One',
            email: 'concurrent@example.com',
            password: 'ValidPassword123!',
          }),
        request(app)
          .post('/api/auth/register')
          .set('Origin', TRUSTED_ORIGIN)
          .send({
            name: 'Concurrent Two',
            email: 'Concurrent@Example.COM',
            password: 'ValidPassword123!',
          }),
      ]);

      const responses = [firstRes, secondRes];
      const created = responses.find((res) => res.status === 201);
      const conflicted = responses.find((res) => res.status === 409);

      expect(created).toBeDefined();
      expect(conflicted).toBeDefined();
      expect(created.body.email).toBe('concurrent@example.com');
      expect(conflicted.body).toEqual({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists.',
        },
      });

      const dbResult = await query('SELECT id FROM users WHERE email = $1', [
        'concurrent@example.com',
      ]);
      expect(dbResult.rows).toHaveLength(1);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials and sets HttpOnly SameSite=Lax cookie without exposing secrets', async () => {
      await request(app)
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: 'Login User',
          email: 'login@example.com',
          password: 'CorrectPassword1!',
        });

      const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          email: '  LOGIN@example.com ',
          password: 'CorrectPassword1!',
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: expect.any(Number),
        name: 'Login User',
        email: 'login@example.com',
      });
      expect(res.body.password_hash).toBeUndefined();
      expect(res.body.token).toBeUndefined();

      const cookieHeader = extractCookieValue(res.headers['set-cookie'], AUTH_COOKIE_NAME);
      expect(cookieHeader).toBeTruthy();
      expect(cookieHeader).toContain('HttpOnly');
      expect(cookieHeader).toContain('SameSite=Lax');
      expect(cookieHeader).toContain('Path=/');
    });

    it('returns identical generic 401 responses for incorrect password and nonexistent email', async () => {
      await request(app)
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: 'Existing User',
          email: 'exists@example.com',
          password: 'CorrectPassword1!',
        });

      const wrongPassRes = await request(app)
        .post('/api/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          email: 'exists@example.com',
          password: 'WrongPassword1!',
        });

      const missingUserRes = await request(app)
        .post('/api/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          email: 'missing@example.com',
          password: 'WrongPassword1!',
        });

      expect(wrongPassRes.status).toBe(401);
      expect(missingUserRes.status).toBe(401);
      expect(wrongPassRes.body).toEqual({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
      });
      expect(missingUserRes.body).toEqual(wrongPassRes.body);
    });

    it('rejects login passwords exceeding 72 UTF-8 bytes including multibyte input without issuing a cookie', async () => {
      const asciiTooLong = 'a'.repeat(73);
      const multibyteTooLong = 'é'.repeat(37); // 37 chars, 74 UTF-8 bytes

      for (const oversizedPassword of [asciiTooLong, multibyteTooLong]) {
        const res = await request(app)
          .post('/api/auth/login')
          .set('Origin', TRUSTED_ORIGIN)
          .send({
            email: 'anyuser@example.com',
            password: oversizedPassword,
          });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.',
          },
        });
        expect(res.headers['set-cookie']).toBeUndefined();
      }
    });

    it('prevents bcrypt 72-byte truncation from authenticating a 72-byte password plus extra bytes', async () => {
      const exact72Password = 'B'.repeat(72);
      expect(Buffer.byteLength(exact72Password, 'utf8')).toBe(72);

      const registerRes = await request(app)
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: 'Boundary User',
          email: 'boundary72@example.com',
          password: exact72Password,
        });
      expect(registerRes.status).toBe(201);

      const validLoginRes = await request(app)
        .post('/api/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          email: 'boundary72@example.com',
          password: exact72Password,
        });
      expect(validLoginRes.status).toBe(200);
      expect(extractCookieValue(validLoginRes.headers['set-cookie'], AUTH_COOKIE_NAME)).toBeTruthy();

      const extendedLoginRes = await request(app)
        .post('/api/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          email: 'boundary72@example.com',
          password: `${exact72Password}extra`,
        });
      expect(extendedLoginRes.status).toBe(401);
      expect(extendedLoginRes.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(extendedLoginRes.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('GET /api/auth/me & requireAuth', () => {
    it('returns the authenticated user identity without password_hash', async () => {
      const agent = request.agent(app);

      const registerRes = await agent
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: 'Me User',
          email: 'me@example.com',
          password: 'ValidPassword123!',
        });

      await agent
        .post('/api/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          email: 'me@example.com',
          password: 'ValidPassword123!',
        });

      const meRes = await agent.get('/api/auth/me');
      expect(meRes.status).toBe(200);
      expect(meRes.body).toEqual({
        id: registerRes.body.id,
        name: 'Me User',
        email: 'me@example.com',
      });
      expect(meRes.body.password_hash).toBeUndefined();
    });

    it('rejects requests without an authentication cookie', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects malformed, tampered, and wrong-secret JWTs', async () => {
      const { jwtSecret } = getAuthConfig();
      const validToken = jwt.sign({}, jwtSecret, {
        algorithm: JWT_ALGORITHM,
        expiresIn: '1h',
        subject: '1',
      });
      const tamperedToken = `${validToken.slice(0, -4)}xxxx`;
      const wrongSecretToken = jwt.sign({}, 'different-secret-that-is-at-least-32-bytes', {
        algorithm: JWT_ALGORITHM,
        expiresIn: '1h',
        subject: '1',
      });

      for (const token of ['not-a-jwt', tamperedToken, wrongSecretToken]) {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Cookie', [`${AUTH_COOKIE_NAME}=${token}`]);

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('rejects JWTs signed with an unsupported algorithm such as HS512', async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: 'Alg User',
          email: 'algcheck@example.com',
          password: 'ValidPassword123!',
        });
      expect(registerRes.status).toBe(201);

      const { jwtSecret } = getAuthConfig();
      const hs512Token = jwt.sign({}, jwtSecret, {
        algorithm: 'HS512',
        expiresIn: '1h',
        subject: String(registerRes.body.id),
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=${hs512Token}`]);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects expired JWTs and JWTs missing an exp claim', async () => {
      const { jwtSecret } = getAuthConfig();
      const registerRes = await request(app)
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: 'Exp User',
          email: 'exp@example.com',
          password: 'ValidPassword123!',
        });
      const userId = String(registerRes.body.id);

      const expiredToken = jwt.sign({}, jwtSecret, {
        algorithm: JWT_ALGORITHM,
        expiresIn: -10,
        subject: userId,
      });

      const noExpToken = jwt.sign({}, jwtSecret, {
        algorithm: JWT_ALGORITHM,
        subject: userId,
      });

      for (const token of [expiredToken, noExpToken]) {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Cookie', [`${AUTH_COOKIE_NAME}=${token}`]);

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('rejects invalid or out-of-range JWT subjects without causing HTTP 500', async () => {
      const { jwtSecret } = getAuthConfig();
      const badSubjects = ['99999999999', '0', '-5', '01', 'abc', '1.5'];

      for (const sub of badSubjects) {
        const token = jwt.sign({}, jwtSecret, {
          algorithm: JWT_ALGORITHM,
          expiresIn: '1h',
          subject: sub,
        });

        const res = await request(app)
          .get('/api/auth/me')
          .set('Cookie', [`${AUTH_COOKIE_NAME}=${token}`]);

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('rejects a valid JWT when the user no longer exists in the database', async () => {
      const agent = request.agent(app);
      const registerRes = await agent
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: 'Deleted User',
          email: 'deleted@example.com',
          password: 'ValidPassword123!',
        });

      await agent
        .post('/api/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          email: 'deleted@example.com',
          password: 'ValidPassword123!',
        });

      await query('DELETE FROM users WHERE id = $1', [registerRes.body.id]);

      const meRes = await agent.get('/api/auth/me');
      expect(meRes.status).toBe(401);
      expect(meRes.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears the cookie, rejects subsequent /me requests, and handles repeated logout safely', async () => {
      const agent = request.agent(app);

      await agent
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: 'Logout User',
          email: 'logout@example.com',
          password: 'ValidPassword123!',
        });

      await agent
        .post('/api/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          email: 'logout@example.com',
          password: 'ValidPassword123!',
        });

      const logoutRes = await agent
        .post('/api/auth/logout')
        .set('Origin', TRUSTED_ORIGIN);

      expect(logoutRes.status).toBe(204);
      expect(logoutRes.text).toBe('');
      const clearedCookie = extractCookieValue(logoutRes.headers['set-cookie'], AUTH_COOKIE_NAME);
      expect(clearedCookie).toBeTruthy();
      expect(clearedCookie).toContain(`${AUTH_COOKIE_NAME}=;`);
      expect(clearedCookie).toContain('HttpOnly');
      expect(clearedCookie).toContain('SameSite=Lax');
      expect(clearedCookie).toContain('Path=/');

      const afterLogoutMe = await agent.get('/api/auth/me');
      expect(afterLogoutMe.status).toBe(401);

      const secondLogout = await agent
        .post('/api/auth/logout')
        .set('Origin', TRUSTED_ORIGIN);
      expect(secondLogout.status).toBe(204);
    });
  });

  describe('Security, CSRF Origin, rate limiting, and test DB isolation', () => {
    it('rejects missing, untrusted, same-host wrong-port, and path-bearing Origin headers on mutations', async () => {
      const missingOriginRes = await request(app)
        .post('/api/auth/logout');
      expect(missingOriginRes.status).toBe(403);
      expect(missingOriginRes.body.error.code).toBe('FORBIDDEN_ORIGIN');

      const badOrigins = [
        'https://evil.example',
        'http://localhost:3001',
        `${TRUSTED_ORIGIN}/dashboard`,
        `${TRUSTED_ORIGIN}/`,
        'http://user:pass@localhost:5173',
        'not-a-url',
      ];

      for (const badOrigin of badOrigins) {
        const res = await request(app)
          .post('/api/auth/login')
          .set('Origin', badOrigin)
          .send({
            email: 'someone@example.com',
            password: 'ValidPassword123!',
          });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN_ORIGIN');
      }
    });

    it('keeps GET /api/health functional without Origin or cookie and applies Helmet headers', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('enforces authentication rate limiting and returns HTTP 429 JSON error', async () => {
      const rateLimitedApp = createApp({ authRateLimitMax: 3 });

      for (let i = 0; i < 3; i += 1) {
        const res = await request(rateLimitedApp)
          .post('/api/auth/login')
          .set('Origin', TRUSTED_ORIGIN)
          .send({
            email: 'nobody@example.com',
            password: 'WrongPassword1!',
          });
        expect(res.status).toBe(401);
      }

      const blockedRes = await request(rateLimitedApp)
        .post('/api/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          email: 'nobody@example.com',
          password: 'WrongPassword1!',
        });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body).toEqual({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many authentication requests. Please try again later.',
        },
      });
    });

    it('fails closed if TEST_DATABASE_URL is missing or matches DATABASE_URL in test mode', () => {
      const originalTestUrl = process.env.TEST_DATABASE_URL;
      const originalDbUrl = process.env.DATABASE_URL;

      try {
        delete process.env.TEST_DATABASE_URL;
        expect(() => resolveDatabaseConfig()).toThrow(/TEST_DATABASE_URL must be configured/);

        if (originalDbUrl) {
          process.env.TEST_DATABASE_URL = originalDbUrl;
          expect(() => resolveDatabaseConfig()).toThrow(/distinct from DATABASE_URL/);
        }
      } finally {
        if (originalTestUrl !== undefined) {
          process.env.TEST_DATABASE_URL = originalTestUrl;
        } else {
          delete process.env.TEST_DATABASE_URL;
        }
        if (originalDbUrl !== undefined) {
          process.env.DATABASE_URL = originalDbUrl;
        } else {
          delete process.env.DATABASE_URL;
        }
      }
    });
  });
});

describe('Module 03 — Configuration unit checks (database-independent)', () => {
  it('sets Secure cookie attributes in production and preserves local HTTP defaults in development', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'production';
      expect(getAuthCookieOptions()).toEqual({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
        maxAge: 8 * 60 * 60 * 1000,
      });
      expect(getClearAuthCookieOptions()).toEqual({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
      });

      process.env.NODE_ENV = 'development';
      expect(getAuthCookieOptions()).toEqual({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
        maxAge: 8 * 60 * 60 * 1000,
      });
      expect(getClearAuthCookieOptions()).toEqual({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
      });
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('ignores rate-limit overrides outside test mode and ignores invalid overrides in test mode', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'development';
      expect(resolveAuthRateLimitMax(3)).toBe(DEFAULT_AUTH_RATE_LIMIT_MAX);
      expect(resolveAuthRateLimitMax(500)).toBe(DEFAULT_AUTH_RATE_LIMIT_MAX);

      process.env.NODE_ENV = 'production';
      expect(resolveAuthRateLimitMax(3)).toBe(DEFAULT_AUTH_RATE_LIMIT_MAX);
      expect(resolveAuthRateLimitMax(500)).toBe(DEFAULT_AUTH_RATE_LIMIT_MAX);

      process.env.NODE_ENV = 'test';
      expect(resolveAuthRateLimitMax(0)).toBe(TEST_AUTH_RATE_LIMIT_MAX);
      expect(resolveAuthRateLimitMax(-5)).toBe(TEST_AUTH_RATE_LIMIT_MAX);
      expect(resolveAuthRateLimitMax(1.5)).toBe(TEST_AUTH_RATE_LIMIT_MAX);
      expect(resolveAuthRateLimitMax(3)).toBe(3);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
