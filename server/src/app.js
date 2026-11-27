import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { requireTrustedOrigin } from './middleware/security.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createReadingRouter } from './routes/readingRoutes.js';
import { createReportRouter } from './routes/reportRoutes.js';

export function createApp({ authRateLimitMax } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());

  // Prevent browsers and proxies from caching sensitive /api responses without affecting static assets.
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // Restrict JSON payload size to protect against oversized request bodies.
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api', requireTrustedOrigin);
  app.use('/api/auth', createAuthRouter({ authRateLimitMax }));
  app.use('/api/readings', createReadingRouter());
  app.use('/api/reports', createReportRouter());

  // Consistent JSON response for unmatched routes.
  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
    });
  });

  // Global error handler: map known body-parser errors and hide internal stack traces.
  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON.',
        },
      });
    }

    if (err?.type === 'entity.too.large') {
      return res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request body exceeds the allowed size limit.',
        },
      });
    }

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
  });

  return app;
}

const app = createApp();
export default app;
