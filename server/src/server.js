import app from './app.js';
import { AuthConfigurationError, validateAuthConfig } from './config/auth.js';
import {
  closePool,
  sanitizeDatabaseError,
  verifyDatabaseConnection,
} from './db/pool.js';

const DEFAULT_PORT = 3001;

function resolvePort(rawPort) {
  if (!rawPort) {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return DEFAULT_PORT;
  }

  return parsed;
}

async function startServer() {
  try {
    validateAuthConfig();
    const { databaseName } = await verifyDatabaseConnection();
    const port = resolvePort(process.env.PORT);

    const server = app.listen(port, () => {
      console.log(
        `Sweety server listening on http://localhost:${port} (database: ${databaseName})`
      );
    });

    let shuttingDown = false;
    async function shutdown(signal) {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;

      console.log(`Received ${signal}; shutting down Sweety server...`);
      server.close(async (closeError) => {
        if (closeError) {
          console.error(`HTTP server close error: ${closeError.message}`);
        }

        try {
          await closePool();
        } catch (poolError) {
          console.error(`Database pool close error: ${sanitizeDatabaseError(poolError)}`);
        }

        process.exit(closeError ? 1 : 0);
      });
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      console.error(`Failed to start Sweety server: ${error.message} (code: ${error.code})`);
    } else {
      console.error(`Failed to start Sweety server: ${sanitizeDatabaseError(error)}`);
    }

    try {
      await closePool();
    } catch {
      // Pool was not initialized or failed during teardown.
    }
    process.exit(1);
  }
}

startServer();
