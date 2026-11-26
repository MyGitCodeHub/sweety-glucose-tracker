import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { query } from '../src/db/pool.js';
import {
  formatDateOnly,
  getTodayKolkataDate,
  isFutureKolkataDate,
  isValidCalendarDate,
  parseCalendarDate,
} from '../src/utils/dates.js';
import { closeTestDb, resetTestDatabase, verifyTestDatabaseIdentity } from './helpers/db.js';

const TRUSTED_ORIGIN = process.env.APP_ORIGIN;
const PAST_DATE = '2025-05-15';
const SECOND_PAST_DATE = '2025-05-14';

function getTomorrowKolkataDate() {
  const today = parseCalendarDate(getTodayKolkataDate());
  const nextUtc = new Date(0);
  nextUtc.setUTCFullYear(today.year, today.month - 1, today.day + 1);
  return formatDateOnly(
    nextUtc.getUTCFullYear(),
    nextUtc.getUTCMonth() + 1,
    nextUtc.getUTCDate()
  );
}

async function registerAndLogin(name, email, password = 'ValidPassword123!') {
  const agent = request.agent(app);

  const registerRes = await agent
    .post('/api/auth/register')
    .set('Origin', TRUSTED_ORIGIN)
    .send({ name, email, password });
  expect(registerRes.status).toBe(201);

  const loginRes = await agent
    .post('/api/auth/login')
    .set('Origin', TRUSTED_ORIGIN)
    .send({ email, password });
  expect(loginRes.status).toBe(200);

  return { agent, user: loginRes.body };
}

describe('Module 04 — Calendar date utilities (Asia/Kolkata)', () => {
  it('validates leap days, rejects impossible dates, rejects year zero, and handles years 0001-0099', () => {
    expect(parseCalendarDate('2024-02-29')).toEqual({
      year: 2024,
      month: 2,
      day: 29,
      dateString: '2024-02-29',
    });
    expect(isValidCalendarDate('2024-02-29')).toBe(true);
    expect(isValidCalendarDate('0004-02-29')).toBe(true);
    expect(isValidCalendarDate('0050-01-15')).toBe(true);

    expect(isValidCalendarDate('2025-02-29')).toBe(false);
    expect(isValidCalendarDate('2026-02-29')).toBe(false);
    expect(isValidCalendarDate('1900-02-29')).toBe(false);
    expect(isValidCalendarDate('2026-02-30')).toBe(false);
    expect(isValidCalendarDate('2026-04-31')).toBe(false);
    expect(isValidCalendarDate('0000-01-01')).toBe(false);
    expect(isValidCalendarDate('2026-1-5')).toBe(false);
    expect(isValidCalendarDate('2026-11-26T10:00:00Z')).toBe(false);
  });

  it('evaluates today and future dates accurately across the Asia/Kolkata midnight boundary', () => {
    const beforeKolkataMidnight = new Date('2026-11-26T18:29:59.000Z'); // 23:59:59 IST
    const atKolkataMidnight = new Date('2026-11-26T18:30:00.000Z'); // 00:00:00 IST next day

    expect(getTodayKolkataDate(beforeKolkataMidnight)).toBe('2026-11-26');
    expect(isFutureKolkataDate('2026-11-26', beforeKolkataMidnight)).toBe(false);
    expect(isFutureKolkataDate('2026-11-27', beforeKolkataMidnight)).toBe(true);

    expect(getTodayKolkataDate(atKolkataMidnight)).toBe('2026-11-27');
    expect(isFutureKolkataDate('2026-11-27', atKolkataMidnight)).toBe(false);
    expect(isFutureKolkataDate('2026-11-28', atKolkataMidnight)).toBe(true);
  });
});

describe('Module 04 — Glucose Readings CRUD integration', () => {
  beforeAll(async () => {
    await verifyTestDatabaseIdentity();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('Create and Retrieve', () => {
    it('rejects unauthenticated requests across all reading endpoints', async () => {
      const getRes = await request(app).get('/api/readings');
      expect(getRes.status).toBe(401);
      expect(getRes.body.error.code).toBe('UNAUTHORIZED');

      const postRes = await request(app)
        .post('/api/readings')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: PAST_DATE, slot: 'morning_fasting', value: 100 });
      expect(postRes.status).toBe(401);

      const putRes = await request(app)
        .put('/api/readings/1')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: PAST_DATE, slot: 'morning_fasting', value: 100 });
      expect(putRes.status).toBe(401);

      const deleteRes = await request(app)
        .delete('/api/readings/1')
        .set('Origin', TRUSTED_ORIGIN);
      expect(deleteRes.status).toBe(401);
    });

    it('creates all four slots with boundaries 40 and 600 and retrieves them in canonical slot order', async () => {
      const { agent } = await registerAndLogin('Patient One', 'patient1@example.com');

      const payloads = [
        { date: PAST_DATE, slot: 'after_dinner', value: 600 },
        { date: PAST_DATE, slot: 'after_lunch', value: 145 },
        { date: PAST_DATE, slot: 'morning_fasting', value: 40 },
        { date: PAST_DATE, slot: 'after_breakfast', value: 120 },
      ];

      for (const payload of payloads) {
        const res = await agent
          .post('/api/readings')
          .set('Origin', TRUSTED_ORIGIN)
          .send(payload);

        expect(res.status).toBe(201);
        expect(res.body).toEqual({
          id: expect.any(Number),
          date: payload.date,
          slot: payload.slot,
          value: payload.value,
        });
        expect(res.body.user_id).toBeUndefined();
        expect(res.body.created_at).toBeUndefined();
        expect(res.body.updated_at).toBeUndefined();
      }

      const listRes = await agent.get(`/api/readings?date=${PAST_DATE}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.map((item) => [item.slot, item.value])).toEqual([
        ['morning_fasting', 40],
        ['after_breakfast', 120],
        ['after_lunch', 145],
        ['after_dinner', 600],
      ]);
    });

    it('defaults GET /api/readings to today in Asia/Kolkata, filters by date, and returns [] when empty', async () => {
      const { agent } = await registerAndLogin('Patient Two', 'patient2@example.com');
      const today = getTodayKolkataDate();

      const emptyRes = await agent.get('/api/readings');
      expect(emptyRes.status).toBe(200);
      expect(emptyRes.body).toEqual([]);

      await agent
        .post('/api/readings')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: today, slot: 'morning_fasting', value: 95 });

      await agent
        .post('/api/readings')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: PAST_DATE, slot: 'after_lunch', value: 140 });

      const todayRes = await agent.get('/api/readings');
      expect(todayRes.status).toBe(200);
      expect(todayRes.body).toHaveLength(1);
      expect(todayRes.body[0]).toMatchObject({
        date: today,
        slot: 'morning_fasting',
        value: 95,
      });

      const pastRes = await agent.get(`/api/readings?date=${PAST_DATE}`);
      expect(pastRes.status).toBe(200);
      expect(pastRes.body).toHaveLength(1);
      expect(pastRes.body[0]).toMatchObject({
        date: PAST_DATE,
        slot: 'after_lunch',
        value: 140,
      });
    });
  });

  describe('Validation Rules and Precedence', () => {
    it('rejects missing, null, and blank glucose values with VALUE_REQUIRED', async () => {
      const { agent } = await registerAndLogin('Val User', 'val1@example.com');

      for (const badValue of [undefined, null, '', '   ']) {
        const res = await agent
          .post('/api/readings')
          .set('Origin', TRUSTED_ORIGIN)
          .send({
            date: PAST_DATE,
            slot: 'morning_fasting',
            value: badValue,
          });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
          error: {
            code: 'VALUE_REQUIRED',
            message: 'Please enter a glucose value.',
          },
        });
      }
    });

    it('rejects zero, out-of-range, fractional, numeric string, and invalid JSON types with VALUE_RANGE', async () => {
      const { agent } = await registerAndLogin('Val Range User', 'val2@example.com');

      for (const badValue of [0, 39, 601, -10, 120.5, '120', true, [120], { val: 120 }]) {
        const res = await agent
          .post('/api/readings')
          .set('Origin', TRUSTED_ORIGIN)
          .send({
            date: PAST_DATE,
            slot: 'morning_fasting',
            value: badValue,
          });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
          error: {
            code: 'VALUE_RANGE',
            message: 'Value must be between 40 and 600 mg/dl.',
          },
        });
      }
    });

    it('validates date filters, impossible dates, datetime strings, repeated query params, and future dates', async () => {
      const { agent } = await registerAndLogin('Date User', 'date@example.com');
      const futureDate = getTomorrowKolkataDate();

      for (const queryString of [
        'date=',
        'date=2026-02-30',
        'date=2025-05-15T10:00:00Z',
        `date=${PAST_DATE}&date=${SECOND_PAST_DATE}`,
      ]) {
        const res = await agent.get(`/api/readings?${queryString}`);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_DATE');
      }

      const futureGetRes = await agent.get(`/api/readings?date=${futureDate}`);
      expect(futureGetRes.status).toBe(400);
      expect(futureGetRes.body).toEqual({
        error: {
          code: 'FUTURE_DATE',
          message: 'Date cannot be in the future.',
        },
      });

      for (const badDate of ['2026-02-30', '2025-05-15T00:00:00Z', '0000-01-01']) {
        const res = await agent
          .post('/api/readings')
          .set('Origin', TRUSTED_ORIGIN)
          .send({ date: badDate, slot: 'morning_fasting', value: 110 });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_DATE');
      }

      const futurePostRes = await agent
        .post('/api/readings')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: futureDate, slot: 'morning_fasting', value: 110 });
      expect(futurePostRes.status).toBe(400);
      expect(futurePostRes.body).toEqual({
        error: {
          code: 'FUTURE_DATE',
          message: 'Date cannot be in the future.',
        },
      });
    });

    it('rejects missing and unsupported time slots', async () => {
      const { agent } = await registerAndLogin('Slot User', 'slot@example.com');

      const missingSlotRes = await agent
        .post('/api/readings')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: PAST_DATE, value: 110 });
      expect(missingSlotRes.status).toBe(400);
      expect(missingSlotRes.body.error.code).toBe('SLOT_REQUIRED');

      const invalidSlotRes = await agent
        .post('/api/readings')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: PAST_DATE, slot: 'bedtime', value: 110 });
      expect(invalidSlotRes.status).toBe(400);
      expect(invalidSlotRes.body.error.code).toBe('INVALID_SLOT');
    });

    it('enforces duplicate-slot dynamic message and daily-limit precedence over duplicate-slot', async () => {
      const { agent } = await registerAndLogin('Rule User', 'rules@example.com');

      await agent
        .post('/api/readings')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: PAST_DATE, slot: 'after_dinner', value: 130 });

      const dupRes = await agent
        .post('/api/readings')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: PAST_DATE, slot: 'after_dinner', value: 135 });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body).toEqual({
        error: {
          code: 'DUPLICATE_SLOT',
          message: 'You already have an After dinner reading for this date.',
        },
      });

      for (const slot of ['morning_fasting', 'after_breakfast', 'after_lunch']) {
        const res = await agent
          .post('/api/readings')
          .set('Origin', TRUSTED_ORIGIN)
          .send({ date: PAST_DATE, slot, value: 115 });
        expect(res.status).toBe(201);
      }

      // 5th creation on a full day must return DAILY_LIMIT even when slot also collides.
      const fifthRes = await agent
        .post('/api/readings')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: PAST_DATE, slot: 'after_lunch', value: 150 });

      expect(fifthRes.status).toBe(409);
      expect(fifthRes.body).toEqual({
        error: {
          code: 'DAILY_LIMIT',
          message: 'You can add only 4 readings per day.',
        },
      });
    });
  });

  describe('Update (PUT /api/readings/:id)', () => {
    it('updates value, slot, and date, preserves created_at while updating updated_at, and allows editing on a full day', async () => {
      const { agent } = await registerAndLogin('Edit User', 'edit@example.com');

      const createdIds = {};
      for (const slot of ['morning_fasting', 'after_breakfast', 'after_lunch', 'after_dinner']) {
        const createRes = await agent
          .post('/api/readings')
          .set('Origin', TRUSTED_ORIGIN)
          .send({ date: PAST_DATE, slot, value: 110 });
        expect(createRes.status).toBe(201);
        createdIds[slot] = createRes.body.id;
      }

      const beforeDb = await query(
        'SELECT created_at, updated_at FROM glucose_readings WHERE id = $1',
        [createdIds.after_lunch]
      );

      await new Promise((resolve) => setTimeout(resolve, 15));

      // Editing same slot on a full 4-reading day must succeed.
      const sameSlotEditRes = await agent
        .put(`/api/readings/${createdIds.after_lunch}`)
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: PAST_DATE, slot: 'after_lunch', value: 155 });

      expect(sameSlotEditRes.status).toBe(200);
      expect(sameSlotEditRes.body).toEqual({
        id: createdIds.after_lunch,
        date: PAST_DATE,
        slot: 'after_lunch',
        value: 155,
      });

      const afterDb = await query(
        'SELECT created_at, updated_at FROM glucose_readings WHERE id = $1',
        [createdIds.after_lunch]
      );
      expect(afterDb.rows[0].created_at.getTime()).toBe(beforeDb.rows[0].created_at.getTime());
      expect(afterDb.rows[0].updated_at.getTime()).toBeGreaterThan(
        beforeDb.rows[0].updated_at.getTime()
      );

      // Moving a reading to another date and changing its slot succeeds when destination has capacity.
      const moveRes = await agent
        .put(`/api/readings/${createdIds.after_dinner}`)
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: SECOND_PAST_DATE, slot: 'morning_fasting', value: 98 });

      expect(moveRes.status).toBe(200);
      expect(moveRes.body).toEqual({
        id: createdIds.after_dinner,
        date: SECOND_PAST_DATE,
        slot: 'morning_fasting',
        value: 98,
      });
    });

    it('rejects duplicate-slot edits, moves to a full date, and future-date edits without altering original data', async () => {
      const { agent } = await registerAndLogin('Edit Guard User', 'editguard@example.com');
      const futureDate = getTomorrowKolkataDate();

      for (const slot of ['morning_fasting', 'after_breakfast', 'after_lunch', 'after_dinner']) {
        const res = await agent
          .post('/api/readings')
          .set('Origin', TRUSTED_ORIGIN)
          .send({ date: PAST_DATE, slot, value: 120 });
        expect(res.status).toBe(201);
      }

      const targetRes = await agent
        .post('/api/readings')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: SECOND_PAST_DATE, slot: 'morning_fasting', value: 105 });
      expect(targetRes.status).toBe(201);

      const secondDayOtherRes = await agent
        .post('/api/readings')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: SECOND_PAST_DATE, slot: 'after_lunch', value: 148 });
      expect(secondDayOtherRes.status).toBe(201);

      // Slot collision on same day
      const dupEditRes = await agent
        .put(`/api/readings/${targetRes.body.id}`)
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: SECOND_PAST_DATE, slot: 'after_lunch', value: 160 });
      expect(dupEditRes.status).toBe(409);
      expect(dupEditRes.body.error.code).toBe('DUPLICATE_SLOT');

      // Moving into a full day (PAST_DATE already has 4 readings)
      const fullDayMoveRes = await agent
        .put(`/api/readings/${targetRes.body.id}`)
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: PAST_DATE, slot: 'morning_fasting', value: 160 });
      expect(fullDayMoveRes.status).toBe(409);
      expect(fullDayMoveRes.body.error.code).toBe('DAILY_LIMIT');

      // Future date update
      const futureEditRes = await agent
        .put(`/api/readings/${targetRes.body.id}`)
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: futureDate, slot: 'morning_fasting', value: 160 });
      expect(futureEditRes.status).toBe(400);
      expect(futureEditRes.body.error.code).toBe('FUTURE_DATE');

      // Original record remains completely unchanged
      const listRes = await agent.get(`/api/readings?date=${SECOND_PAST_DATE}`);
      expect(listRes.body[0]).toEqual({
        id: targetRes.body.id,
        date: SECOND_PAST_DATE,
        slot: 'morning_fasting',
        value: 105,
      });
    });

    it('rejects nonexistent IDs with 404 and invalid/out-of-range IDs with 400', async () => {
      const { agent } = await registerAndLogin('Id User', 'idcheck@example.com');

      const missingRes = await agent
        .put('/api/readings/99999')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: PAST_DATE, slot: 'morning_fasting', value: 110 });
      expect(missingRes.status).toBe(404);
      expect(missingRes.body.error.code).toBe('READING_NOT_FOUND');

      for (const badId of ['0', '-1', 'abc', '1.5', '01', '99999999999']) {
        const badRes = await agent
          .put(`/api/readings/${badId}`)
          .set('Origin', TRUSTED_ORIGIN)
          .send({ date: PAST_DATE, slot: 'morning_fasting', value: 110 });
        expect(badRes.status).toBe(400);
        expect(badRes.body.error.code).toBe('INVALID_READING_ID');
      }
    });
  });

  describe('Delete (DELETE /api/readings/:id)', () => {
    it('deletes an owned reading, removes it from retrieval, and returns 404 on missing/repeated delete or 400 on bad ID', async () => {
      const { agent } = await registerAndLogin('Delete User', 'delete@example.com');

      const createRes = await agent
        .post('/api/readings')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: PAST_DATE, slot: 'after_breakfast', value: 132 });
      expect(createRes.status).toBe(201);

      const delRes = await agent
        .delete(`/api/readings/${createRes.body.id}`)
        .set('Origin', TRUSTED_ORIGIN);
      expect(delRes.status).toBe(204);
      expect(delRes.text).toBe('');

      const listRes = await agent.get(`/api/readings?date=${PAST_DATE}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body).toEqual([]);

      const repeatDelRes = await agent
        .delete(`/api/readings/${createRes.body.id}`)
        .set('Origin', TRUSTED_ORIGIN);
      expect(repeatDelRes.status).toBe(404);
      expect(repeatDelRes.body.error.code).toBe('READING_NOT_FOUND');

      const badIdRes = await agent
        .delete('/api/readings/99999999999')
        .set('Origin', TRUSTED_ORIGIN);
      expect(badIdRes.status).toBe(400);
      expect(badIdRes.body.error.code).toBe('INVALID_READING_ID');
    });
  });

  describe('Authorization, Ownership Isolation, and CSRF', () => {
    it('isolates readings strictly per user, ignores client user_id, allows independent daily limits, and enforces Origin', async () => {
      const { agent: agentA, user: userA } = await registerAndLogin('User A', 'usera@example.com');
      const { agent: agentB, user: userB } = await registerAndLogin('User B', 'userb@example.com');

      // Client-supplied user_id / userId must be ignored in favor of req.user.id.
      const createARes = await agentA
        .post('/api/readings')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          user_id: userB.id,
          userId: userB.id,
          date: PAST_DATE,
          slot: 'morning_fasting',
          value: 99,
        });
      expect(createARes.status).toBe(201);

      const dbOwner = await query('SELECT user_id FROM glucose_readings WHERE id = $1', [
        createARes.body.id,
      ]);
      expect(dbOwner.rows[0].user_id).toBe(userA.id);

      // User B cannot retrieve, update, or delete User A's reading.
      const listB = await agentB.get(`/api/readings?date=${PAST_DATE}`);
      expect(listB.status).toBe(200);
      expect(listB.body).toEqual([]);

      const foreignUpdate = await agentB
        .put(`/api/readings/${createARes.body.id}`)
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: PAST_DATE, slot: 'morning_fasting', value: 180 });
      expect(foreignUpdate.status).toBe(404);
      expect(foreignUpdate.body.error.code).toBe('READING_NOT_FOUND');

      const foreignDelete = await agentB
        .delete(`/api/readings/${createARes.body.id}`)
        .set('Origin', TRUSTED_ORIGIN);
      expect(foreignDelete.status).toBe(404);
      expect(foreignDelete.body.error.code).toBe('READING_NOT_FOUND');

      // User B has independent slots and daily capacity on the exact same date.
      for (const slot of ['morning_fasting', 'after_breakfast', 'after_lunch', 'after_dinner']) {
        const resB = await agentB
          .post('/api/readings')
          .set('Origin', TRUSTED_ORIGIN)
          .send({ date: PAST_DATE, slot, value: 112 });
        expect(resB.status).toBe(201);
      }

      // Missing or untrusted Origin rejected on reading mutations.
      const missingOriginPost = await agentA
        .post('/api/readings')
        .send({ date: PAST_DATE, slot: 'after_lunch', value: 120 });
      expect(missingOriginPost.status).toBe(403);
      expect(missingOriginPost.body.error.code).toBe('FORBIDDEN_ORIGIN');

      const untrustedOriginPut = await agentA
        .put(`/api/readings/${createARes.body.id}`)
        .set('Origin', 'https://evil.example')
        .send({ date: PAST_DATE, slot: 'morning_fasting', value: 120 });
      expect(untrustedOriginPut.status).toBe(403);
      expect(untrustedOriginPut.body.error.code).toBe('FORBIDDEN_ORIGIN');

      const untrustedOriginDelete = await agentA
        .delete(`/api/readings/${createARes.body.id}`)
        .set('Origin', `${TRUSTED_ORIGIN}/extra`);
      expect(untrustedOriginDelete.status).toBe(403);
      expect(untrustedOriginDelete.body.error.code).toBe('FORBIDDEN_ORIGIN');
    });
  });

  describe('Concurrency and Transaction Serialization', () => {
    it('Scenario A: simultaneous creation of the same slot yields one 201, one 409 DUPLICATE_SLOT, and 1 row', async () => {
      const { agent, user } = await registerAndLogin('Conc A', 'conca@example.com');

      const [res1, res2] = await Promise.all([
        agent
          .post('/api/readings')
          .set('Origin', TRUSTED_ORIGIN)
          .send({ date: PAST_DATE, slot: 'morning_fasting', value: 102 }),
        agent
          .post('/api/readings')
          .set('Origin', TRUSTED_ORIGIN)
          .send({ date: PAST_DATE, slot: 'morning_fasting', value: 108 }),
      ]);

      const responses = [res1, res2];
      const created = responses.find((res) => res.status === 201);
      const conflicted = responses.find((res) => res.status === 409);

      expect(created).toBeDefined();
      expect(conflicted).toBeDefined();
      expect(conflicted.body).toEqual({
        error: {
          code: 'DUPLICATE_SLOT',
          message: 'You already have a Morning (fasting) reading for this date.',
        },
      });

      const dbRows = await query(
        'SELECT id FROM glucose_readings WHERE user_id = $1 AND reading_date = $2',
        [user.id, PAST_DATE]
      );
      expect(dbRows.rows).toHaveLength(1);
    });

    it('Scenario B: two simultaneous creations for the 4th remaining slot yield one 201, one 409 DAILY_LIMIT, and 4 rows', async () => {
      const { agent, user } = await registerAndLogin('Conc B', 'concb@example.com');

      for (const slot of ['morning_fasting', 'after_breakfast', 'after_lunch']) {
        const res = await agent
          .post('/api/readings')
          .set('Origin', TRUSTED_ORIGIN)
          .send({ date: PAST_DATE, slot, value: 115 });
        expect(res.status).toBe(201);
      }

      const [res1, res2] = await Promise.all([
        agent
          .post('/api/readings')
          .set('Origin', TRUSTED_ORIGIN)
          .send({ date: PAST_DATE, slot: 'after_dinner', value: 130 }),
        agent
          .post('/api/readings')
          .set('Origin', TRUSTED_ORIGIN)
          .send({ date: PAST_DATE, slot: 'after_dinner', value: 136 }),
      ]);

      const responses = [res1, res2];
      const created = responses.find((res) => res.status === 201);
      const conflicted = responses.find((res) => res.status === 409);

      expect(created).toBeDefined();
      expect(conflicted).toBeDefined();
      expect(conflicted.body).toEqual({
        error: {
          code: 'DAILY_LIMIT',
          message: 'You can add only 4 readings per day.',
        },
      });

      const dbRows = await query(
        'SELECT id FROM glucose_readings WHERE user_id = $1 AND reading_date = $2',
        [user.id, PAST_DATE]
      );
      expect(dbRows.rows).toHaveLength(4);
    });

    it('Scenario C: concurrent creation and move into the final available slot yield one success and one 409 DAILY_LIMIT', async () => {
      const { agent, user } = await registerAndLogin('Conc C', 'concc@example.com');

      for (const slot of ['morning_fasting', 'after_breakfast', 'after_lunch']) {
        const res = await agent
          .post('/api/readings')
          .set('Origin', TRUSTED_ORIGIN)
          .send({ date: PAST_DATE, slot, value: 118 });
        expect(res.status).toBe(201);
      }

      const moveSourceRes = await agent
        .post('/api/readings')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ date: SECOND_PAST_DATE, slot: 'morning_fasting', value: 94 });
      expect(moveSourceRes.status).toBe(201);

      const [createRes, moveRes] = await Promise.all([
        agent
          .post('/api/readings')
          .set('Origin', TRUSTED_ORIGIN)
          .send({ date: PAST_DATE, slot: 'after_dinner', value: 140 }),
        agent
          .put(`/api/readings/${moveSourceRes.body.id}`)
          .set('Origin', TRUSTED_ORIGIN)
          .send({ date: PAST_DATE, slot: 'after_dinner', value: 142 }),
      ]);

      const outcomes = [createRes, moveRes];
      const winner = outcomes.find((res) => res.status === 201 || res.status === 200);
      const loser = outcomes.find((res) => res.status === 409);

      expect(winner).toBeDefined();
      expect(loser).toBeDefined();
      expect(loser.body).toEqual({
        error: {
          code: 'DAILY_LIMIT',
          message: 'You can add only 4 readings per day.',
        },
      });

      const destRows = await query(
        'SELECT id FROM glucose_readings WHERE user_id = $1 AND reading_date = $2',
        [user.id, PAST_DATE]
      );
      expect(destRows.rows).toHaveLength(4);
    });
  });
});
