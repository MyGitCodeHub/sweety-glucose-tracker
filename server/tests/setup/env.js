import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');

const callerTestDbUrl = process.env.TEST_DATABASE_URL;
const callerDbUrl = process.env.DATABASE_URL;
const callerAppOrigin = process.env.APP_ORIGIN;

if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

// Always force isolated test mode and a dedicated synthetic test JWT secret.
process.env.NODE_ENV = 'test';
if (callerTestDbUrl) {
  process.env.TEST_DATABASE_URL = callerTestDbUrl;
}
if (callerDbUrl) {
  process.env.DATABASE_URL = callerDbUrl;
}
process.env.APP_ORIGIN = callerAppOrigin || process.env.APP_ORIGIN || 'http://localhost:5173';
process.env.JWT_SECRET = 'sweety-test-only-jwt-signing-secret-0123456789';
