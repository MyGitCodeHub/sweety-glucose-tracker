import pg from 'pg';

const { Pool, types } = pg;

// Preserve PostgreSQL DATE values (OID 1082) as exact YYYY-MM-DD strings.
const DATE_OID = types.builtins?.DATE ?? 1082;
types.setTypeParser(DATE_OID, (value) => value);

const SAFE_PG_ERROR_MESSAGES = {
  ECONNREFUSED: 'Database connection was refused.',
  ENOTFOUND: 'Database host could not be resolved.',
  ETIMEDOUT: 'Database connection timed out.',
  '28P01': 'Database authentication failed.',
  '28000': 'Database authorization failed.',
  '3D000': 'Target database does not exist.',
  '42501': 'Database role lacks required permissions.',
  '42P01': 'Required database table does not exist.',
};

let pool = null;
let activeConfig = null;

export class DatabaseConfigurationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DatabaseConfigurationError';
    this.code = code;
  }
}

export function sanitizeDatabaseError(error) {
  if (!error) {
    return 'Unknown database error (code: DB_ERROR).';
  }

  if (error instanceof DatabaseConfigurationError) {
    return `${error.message} (code: ${error.code})`;
  }

  const code = typeof error.code === 'string' && error.code.length > 0 ? error.code : 'DB_ERROR';
  const mappedMessage = SAFE_PG_ERROR_MESSAGES[code];
  if (mappedMessage) {
    return `${mappedMessage} (code: ${code})`;
  }

  return `Database operation failed (code: ${code}).`;
}

export function parseConnectionTarget(rawUrl, envVarName) {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    throw new DatabaseConfigurationError(
      'DB_CONFIG_MISSING',
      `${envVarName} must be configured.`
    );
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new DatabaseConfigurationError(
      'DB_CONFIG_INVALID',
      `${envVarName} is not a valid PostgreSQL connection URL.`
    );
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new DatabaseConfigurationError(
      'DB_CONFIG_INVALID',
      `${envVarName} must use the postgres:// or postgresql:// scheme.`
    );
  }

  const databaseName = parsed.pathname.replace(/^\/+/, '');
  if (!databaseName) {
    throw new DatabaseConfigurationError(
      'DB_CONFIG_INVALID',
      `${envVarName} must include a target database name.`
    );
  }

  return {
    host: parsed.hostname.toLowerCase(),
    port: parsed.port || '5432',
    databaseName,
  };
}

export function targetsMatch(firstTarget, secondTarget) {
  return (
    firstTarget.host === secondTarget.host &&
    firstTarget.port === secondTarget.port &&
    firstTarget.databaseName === secondTarget.databaseName
  );
}

export function resolveDatabaseConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isTest = nodeEnv === 'test';

  if (isTest) {
    const testUrl = process.env.TEST_DATABASE_URL;
    const testTarget = parseConnectionTarget(testUrl, 'TEST_DATABASE_URL');

    const devUrl = process.env.DATABASE_URL;
    let devTarget = null;
    if (typeof devUrl === 'string' && devUrl.trim().length > 0) {
      devTarget = parseConnectionTarget(devUrl, 'DATABASE_URL');
      if (testUrl === devUrl || targetsMatch(testTarget, devTarget)) {
        throw new DatabaseConfigurationError(
          'TEST_DB_ISOLATION_ERROR',
          'TEST_DATABASE_URL must point to a dedicated database distinct from DATABASE_URL.'
        );
      }
    }

    return {
      connectionString: testUrl,
      envVarName: 'TEST_DATABASE_URL',
      isTest: true,
      target: testTarget,
      devTarget,
    };
  }

  const devUrl = process.env.DATABASE_URL;
  const devTarget = parseConnectionTarget(devUrl, 'DATABASE_URL');

  return {
    connectionString: devUrl,
    envVarName: 'DATABASE_URL',
    isTest: false,
    target: devTarget,
    devTarget: null,
  };
}

export function getPool() {
  if (pool) {
    return pool;
  }

  const config = resolveDatabaseConfig();
  const createdPool = new Pool({
    connectionString: config.connectionString,
  });

  createdPool.on('error', (error) => {
    console.error(`PostgreSQL pool error: ${sanitizeDatabaseError(error)}`);
  });

  pool = createdPool;
  activeConfig = config;
  return pool;
}

export async function query(text, params = []) {
  return getPool().query(text, params);
}

export async function withTransaction(callback) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(`PostgreSQL rollback error: ${sanitizeDatabaseError(rollbackError)}`);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyDatabaseConnection(queryable = null) {
  const activePool = getPool();
  const targetClient = queryable ?? activePool;
  const result = await targetClient.query(
    'SELECT current_database() AS database_name, current_user AS role_name'
  );
  const connectedDatabase = result.rows[0]?.database_name;
  const connectedRole = result.rows[0]?.role_name;

  if (!connectedDatabase || connectedDatabase !== activeConfig.target.databaseName) {
    throw new DatabaseConfigurationError(
      'DB_IDENTITY_MISMATCH',
      'Connected PostgreSQL database does not match the configured target database.'
    );
  }

  if (
    activeConfig.isTest &&
    activeConfig.devTarget &&
    connectedDatabase === activeConfig.devTarget.databaseName
  ) {
    throw new DatabaseConfigurationError(
      'TEST_DB_ISOLATION_ERROR',
      'Test mode connected to the development database; aborting.'
    );
  }

  return { databaseName: connectedDatabase, roleName: connectedRole };
}

export async function assertDedicatedTestDatabase(queryable = null) {
  if ((process.env.NODE_ENV || 'development') !== 'test') {
    throw new DatabaseConfigurationError(
      'TEST_DB_ISOLATION_ERROR',
      'Destructive test operations are allowed only when NODE_ENV=test.'
    );
  }

  const { databaseName, roleName } = await verifyDatabaseConnection(queryable);
  if (databaseName === 'sweety_dev') {
    throw new DatabaseConfigurationError(
      'TEST_DB_ISOLATION_ERROR',
      'Refusing destructive test operation against development database.'
    );
  }

  return { databaseName, roleName };
}

export async function closePool() {
  if (!pool) {
    return;
  }

  const poolToClose = pool;
  pool = null;
  activeConfig = null;
  await poolToClose.end();
}
