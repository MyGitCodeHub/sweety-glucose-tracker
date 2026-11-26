import bcrypt from 'bcrypt';
import {
  closePool,
  DatabaseConfigurationError,
  parseConnectionTarget,
  sanitizeDatabaseError,
  targetsMatch,
  verifyDatabaseConnection,
  withTransaction,
} from '../src/db/pool.js';

const DEMO_NAME = 'Demo Patient';
const DEMO_EMAIL = 'demo@sweety.example';
const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_BCRYPT_BYTES = 72;
const APP_TIMEZONE = 'Asia/Kolkata';

const ALLOWED_SLOTS = new Set([
  'morning_fasting',
  'after_breakfast',
  'after_lunch',
  'after_dinner',
]);

function validateDemoPassword(rawPassword) {
  if (typeof rawPassword !== 'string' || rawPassword.trim().length === 0) {
    throw new Error('DEMO_PASSWORD must be set in the environment before running seed.');
  }

  if (rawPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `DEMO_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters long.`
    );
  }

  if (Buffer.byteLength(rawPassword, 'utf8') > MAX_BCRYPT_BYTES) {
    throw new Error(
      `DEMO_PASSWORD must not exceed ${MAX_BCRYPT_BYTES} UTF-8 bytes (bcrypt limit).`
    );
  }

  return rawPassword;
}

function assertSeedConfigIsSafe() {
  if ((process.env.NODE_ENV || 'development') === 'test') {
    throw new DatabaseConfigurationError(
      'SEED_TEST_DB_REFUSED',
      'Refusing to run the demo seed script when NODE_ENV=test.'
    );
  }

  const devTarget = parseConnectionTarget(process.env.DATABASE_URL, 'DATABASE_URL');
  if (devTarget.databaseName === 'sweety_test' || devTarget.databaseName.endsWith('_test')) {
    throw new DatabaseConfigurationError(
      'SEED_TEST_DB_REFUSED',
      'Refusing to seed a test database target.'
    );
  }

  const testUrl = process.env.TEST_DATABASE_URL;
  if (typeof testUrl === 'string' && testUrl.trim().length > 0) {
    const testTarget = parseConnectionTarget(testUrl, 'TEST_DATABASE_URL');
    if (process.env.DATABASE_URL === testUrl || targetsMatch(devTarget, testTarget)) {
      throw new DatabaseConfigurationError(
        'SEED_TEST_DB_REFUSED',
        'DATABASE_URL matches TEST_DATABASE_URL; refusing to seed.'
      );
    }
  }
}

function getKolkataTodayParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(now);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number.parseInt(byType.year, 10),
    month: Number.parseInt(byType.month, 10),
    day: Number.parseInt(byType.day, 10),
  };
}

function formatDateOnly(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildSyntheticReadings({ year, month, day }) {
  const todayStr = formatDateOnly(year, month, day);
  const readings = [];

  function addReading(readingYear, readingMonth, readingDay, timeSlot, glucoseValue) {
    const readingDate = formatDateOnly(readingYear, readingMonth, readingDay);
    if (readingDate > todayStr) {
      throw new Error(`Refusing to generate future seed reading for ${readingDate}.`);
    }
    if (!ALLOWED_SLOTS.has(timeSlot)) {
      throw new Error(`Unsupported time slot in seed data: ${timeSlot}`);
    }
    if (!Number.isInteger(glucoseValue) || glucoseValue < 40 || glucoseValue > 600) {
      throw new Error(`Invalid glucose value in seed data: ${glucoseValue}`);
    }
    readings.push({ readingDate, timeSlot, glucoseValue });
  }

  // Current day readings (Daily report + Month-to-date report)
  addReading(year, month, day, 'morning_fasting', 98);
  addReading(year, month, day, 'after_breakfast', 134);
  addReading(year, month, day, 'after_lunch', 146);

  // Earlier dates within the same calendar month (Month-to-date report)
  if (day >= 2) {
    addReading(year, month, 1, 'morning_fasting', 94);
    addReading(year, month, 1, 'after_dinner', 128);
  }
  if (day >= 5) {
    addReading(year, month, day - 2, 'morning_fasting', 101);
    addReading(year, month, day - 2, 'after_breakfast', 138);
    addReading(year, month, day - 2, 'after_lunch', 142);
    addReading(year, month, day - 2, 'after_dinner', 125);
  }
  if (day >= 10) {
    const midDay = Math.floor(day / 2);
    addReading(year, month, midDay, 'morning_fasting', 96);
    addReading(year, month, midDay, 'after_lunch', 150);
  }

  // Previous calendar month readings (Monthly report, handles Jan -> Dec transitions and leap years)
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const lastDayOfPrevMonth = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();

  addReading(prevYear, prevMonth, 1, 'morning_fasting', 92);
  addReading(prevYear, prevMonth, 1, 'after_breakfast', 131);
  addReading(prevYear, prevMonth, 1, 'after_lunch', 144);
  addReading(prevYear, prevMonth, 1, 'after_dinner', 122);

  addReading(prevYear, prevMonth, 10, 'morning_fasting', 99);
  addReading(prevYear, prevMonth, 10, 'after_lunch', 154);
  addReading(prevYear, prevMonth, 10, 'after_dinner', 129);

  addReading(prevYear, prevMonth, 20, 'morning_fasting', 95);
  addReading(prevYear, prevMonth, 20, 'after_breakfast', 140);
  addReading(prevYear, prevMonth, 20, 'after_dinner', 126);

  addReading(prevYear, prevMonth, lastDayOfPrevMonth, 'morning_fasting', 97);
  addReading(prevYear, prevMonth, lastDayOfPrevMonth, 'after_breakfast', 135);
  addReading(prevYear, prevMonth, lastDayOfPrevMonth, 'after_lunch', 148);
  addReading(prevYear, prevMonth, lastDayOfPrevMonth, 'after_dinner', 124);

  return readings;
}

async function runSeed() {
  try {
    assertSeedConfigIsSafe();
    const demoPassword = validateDemoPassword(process.env.DEMO_PASSWORD);

    const { databaseName } = await verifyDatabaseConnection();
    if (databaseName === 'sweety_test' || databaseName.endsWith('_test')) {
      throw new DatabaseConfigurationError(
        'SEED_TEST_DB_REFUSED',
        'Connected database is a test database; refusing to seed.'
      );
    }

    const todayParts = getKolkataTodayParts();
    const syntheticReadings = buildSyntheticReadings(todayParts);

    // Note: If demo@sweety.example already exists, reuse its ID and preserve
    // its existing password hash, name, and readings without modification.
    const summary = await withTransaction(async (client) => {
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [DEMO_EMAIL]
      );

      let userId;
      let userCreated = false;

      if (existingUser.rows.length > 0) {
        userId = existingUser.rows[0].id;
      } else {
        const passwordHash = await bcrypt.hash(demoPassword, BCRYPT_COST);
        const insertedUser = await client.query(
          `INSERT INTO users (name, email, password_hash)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [DEMO_NAME, DEMO_EMAIL, passwordHash]
        );
        userId = insertedUser.rows[0].id;
        userCreated = true;
      }

      let insertedReadings = 0;
      let skippedReadings = 0;

      for (const reading of syntheticReadings) {
        const insertResult = await client.query(
          `INSERT INTO glucose_readings (user_id, reading_date, time_slot, glucose_value)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT ON CONSTRAINT uq_glucose_readings_user_date_slot DO NOTHING
           RETURNING id`,
          [userId, reading.readingDate, reading.timeSlot, reading.glucoseValue]
        );

        if (insertResult.rowCount > 0) {
          insertedReadings += 1;
        } else {
          skippedReadings += 1;
        }
      }

      return { userCreated, insertedReadings, skippedReadings };
    });

    console.log(`Seed complete on database: ${databaseName}`);
    console.log(
      `Demo account (${DEMO_EMAIL}): ${
        summary.userCreated ? 'created' : 'preserved existing account'
      }`
    );
    console.log(
      `Readings inserted: ${summary.insertedReadings}, skipped (already present): ${summary.skippedReadings}`
    );
  } catch (error) {
    if (error instanceof DatabaseConfigurationError || typeof error?.code === 'string') {
      console.error(`Seed aborted: ${sanitizeDatabaseError(error)}`);
    } else {
      console.error(`Seed aborted: ${error.message}`);
    }
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

runSeed();
