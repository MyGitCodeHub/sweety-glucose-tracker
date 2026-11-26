import {
  assertDedicatedTestDatabase,
  closePool,
  DatabaseConfigurationError,
  getPool,
} from '../../src/db/pool.js';

const EXPECTED_TEST_DATABASE = 'sweety_test';
const EXPECTED_TEST_ROLE = 'sweety_test_app';

function assertLocalTestTarget(databaseName, roleName) {
  if (databaseName !== EXPECTED_TEST_DATABASE || roleName !== EXPECTED_TEST_ROLE) {
    throw new DatabaseConfigurationError(
      'TEST_DB_ISOLATION_ERROR',
      `Refusing destructive cleanup: expected ${EXPECTED_TEST_DATABASE} as ${EXPECTED_TEST_ROLE}.`
    );
  }
}

export async function verifyTestDatabaseIdentity() {
  const client = await getPool().connect();
  try {
    const { databaseName, roleName } = await assertDedicatedTestDatabase(client);
    assertLocalTestTarget(databaseName, roleName);
    return { databaseName, roleName };
  } finally {
    client.release();
  }
}

export async function resetTestDatabase() {
  const client = await getPool().connect();
  try {
    // Verify identity and execute TRUNCATE on the exact same database connection.
    const { databaseName, roleName } = await assertDedicatedTestDatabase(client);
    assertLocalTestTarget(databaseName, roleName);
    await client.query('TRUNCATE TABLE glucose_readings, users RESTART IDENTITY CASCADE');
  } finally {
    client.release();
  }
}

export async function closeTestDb() {
  await closePool();
}
