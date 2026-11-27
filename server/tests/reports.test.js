import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import {
  formatDateOnly,
  getMonthToDateRange,
  getPreviousMonthRange,
  getTodayKolkataDate,
  parseCalendarDate,
} from '../src/utils/dates.js';
import { closeTestDb, resetTestDatabase, verifyTestDatabaseIdentity } from './helpers/db.js';

const TRUSTED_ORIGIN = process.env.APP_ORIGIN;

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

async function createReading(agent, date, slot, value) {
  const res = await agent
    .post('/api/readings')
    .set('Origin', TRUSTED_ORIGIN)
    .send({ date, slot, value });
  expect(res.status).toBe(201);
  return res.body;
}

describe('Module 05 — Report calendar range utilities', () => {
  it('computes month-to-date and previous-month boundaries across rollovers, leap years, years < 100, and rejects year zero', () => {
    expect(getMonthToDateRange('2026-10-15')).toEqual({
      startDate: '2026-10-01',
      endDate: '2026-10-15',
    });

    expect(getPreviousMonthRange('2026-10-15')).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });

    // January -> December year rollover
    expect(getPreviousMonthRange('2026-01-10')).toEqual({
      startDate: '2025-12-01',
      endDate: '2025-12-31',
    });

    // Leap-year and non-leap-year February
    expect(getPreviousMonthRange('2024-03-05')).toEqual({
      startDate: '2024-02-01',
      endDate: '2024-02-29',
    });
    expect(getPreviousMonthRange('2025-03-05')).toEqual({
      startDate: '2025-02-01',
      endDate: '2025-02-28',
    });
    expect(getPreviousMonthRange('1900-03-05')).toEqual({
      startDate: '1900-02-01',
      endDate: '1900-02-28',
    });

    // Years 0001-0099 and year-zero rejection
    expect(getPreviousMonthRange('0004-03-05')).toEqual({
      startDate: '0004-02-01',
      endDate: '0004-02-29',
    });
    expect(getPreviousMonthRange('0050-03-05')).toEqual({
      startDate: '0050-02-01',
      endDate: '0050-02-28',
    });
    expect(getPreviousMonthRange('0001-02-15')).toEqual({
      startDate: '0001-01-01',
      endDate: '0001-01-31',
    });
    expect(getPreviousMonthRange('0001-01-15')).toBeNull();
  });
});

describe('Module 05 — Glucose Reports API integration', () => {
  beforeAll(async () => {
    await verifyTestDatabaseIdentity();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('GET /api/reports/daily', () => {
    it('computes daily statistics and returns readings in canonical slot order without internal fields', async () => {
      const { agent } = await registerAndLogin('Daily Patient', 'daily@example.com');
      const targetDate = '2026-05-15';

      // Insert out of canonical order and include another date that must be excluded.
      await createReading(agent, targetDate, 'after_dinner', 128);
      await createReading(agent, targetDate, 'morning_fasting', 98);
      await createReading(agent, targetDate, 'after_lunch', 146);
      await createReading(agent, '2026-05-14', 'morning_fasting', 500);

      const res = await agent.get(`/api/reports/daily?date=${targetDate}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        startDate: targetDate,
        endDate: targetDate,
        highest: 146,
        lowest: 98,
        average: 124,
        count: 3,
        readings: [
          { id: expect.any(Number), date: targetDate, slot: 'morning_fasting', value: 98 },
          { id: expect.any(Number), date: targetDate, slot: 'after_lunch', value: 146 },
          { id: expect.any(Number), date: targetDate, slot: 'after_dinner', value: 128 },
        ],
      });
      expect(typeof res.body.highest).toBe('number');
      expect(typeof res.body.lowest).toBe('number');
      expect(typeof res.body.average).toBe('number');
      expect(typeof res.body.count).toBe('number');
      expect(res.body.readings[0].user_id).toBeUndefined();
      expect(res.body.readings[0].created_at).toBeUndefined();
      expect(res.body.readings[0].updated_at).toBeUndefined();
    });

    it('handles single-reading stats, half-tenth rounding, and empty daily reports', async () => {
      const { agent } = await registerAndLogin('Daily Edge', 'dailyedge@example.com');

      const emptyRes = await agent.get('/api/reports/daily?date=2026-05-01');
      expect(emptyRes.status).toBe(200);
      expect(emptyRes.body).toEqual({
        startDate: '2026-05-01',
        endDate: '2026-05-01',
        highest: null,
        lowest: null,
        average: null,
        count: 0,
        readings: [],
      });

      await createReading(agent, '2026-05-02', 'morning_fasting', 113);
      const singleRes = await agent.get('/api/reports/daily?date=2026-05-02');
      expect(singleRes.status).toBe(200);
      expect(singleRes.body).toMatchObject({
        startDate: '2026-05-02',
        endDate: '2026-05-02',
        highest: 113,
        lowest: 113,
        average: 113,
        count: 1,
      });

      // 401 / 4 = 100.25 -> rounds half-up to 100.3
      await createReading(agent, '2026-05-03', 'morning_fasting', 100);
      await createReading(agent, '2026-05-03', 'after_breakfast', 100);
      await createReading(agent, '2026-05-03', 'after_lunch', 100);
      await createReading(agent, '2026-05-03', 'after_dinner', 101);

      const roundedRes = await agent.get('/api/reports/daily?date=2026-05-03');
      expect(roundedRes.status).toBe(200);
      expect(roundedRes.body).toMatchObject({
        highest: 101,
        lowest: 100,
        average: 100.3,
        count: 4,
      });
    });

    it('defaults omitted date to Asia/Kolkata today across midnight boundaries', async () => {
      const { agent } = await registerAndLogin('Timezone User', 'tz@example.com');
      const realToday = getTodayKolkataDate();

      await createReading(agent, realToday, 'morning_fasting', 104);
      const realDefaultRes = await agent.get('/api/reports/daily');
      expect(realDefaultRes.status).toBe(200);
      expect(realDefaultRes.body).toMatchObject({
        startDate: realToday,
        endDate: realToday,
        count: 1,
        average: 104,
      });

      // Seed readings on June 15 and June 16, 2026 (prior to current date)
      await createReading(agent, '2026-06-15', 'morning_fasting', 95);
      await createReading(agent, '2026-06-16', 'morning_fasting', 125);

      vi.useFakeTimers({ toFake: ['Date'] });

      // 2026-06-15T18:29:59Z === 2026-06-15 23:59:59 Asia/Kolkata
      vi.setSystemTime(new Date('2026-06-15T18:29:59.000Z'));
      const beforeMidnight = await agent.get('/api/reports/daily');
      expect(beforeMidnight.status).toBe(200);
      expect(beforeMidnight.body).toMatchObject({
        startDate: '2026-06-15',
        endDate: '2026-06-15',
        average: 95,
        count: 1,
      });

      // 2026-06-15T18:30:00Z === 2026-06-16 00:00:00 Asia/Kolkata
      vi.setSystemTime(new Date('2026-06-15T18:30:00.000Z'));
      const atMidnight = await agent.get('/api/reports/daily');
      expect(atMidnight.status).toBe(200);
      expect(atMidnight.body).toMatchObject({
        startDate: '2026-06-16',
        endDate: '2026-06-16',
        average: 125,
        count: 1,
      });

      const mtdAtMidnight = await agent.get('/api/reports/month-to-date');
      expect(mtdAtMidnight.status).toBe(200);
      expect(mtdAtMidnight.body).toEqual({
        startDate: '2026-06-01',
        endDate: '2026-06-16',
        highest: 125,
        lowest: 95,
        average: 110,
        count: 2,
      });
    });
  });

  describe('GET /api/reports/month-to-date', () => {
    it('includes 1st through selected date inclusively, excludes later dates, and weights readings equally', async () => {
      const { agent } = await registerAndLogin('MTD User', 'mtd@example.com');

      // Previous month (excluded)
      await createReading(agent, '2026-04-30', 'morning_fasting', 550);

      // Day 1: 1 reading = 100
      await createReading(agent, '2026-05-01', 'morning_fasting', 100);

      // Day 10 (selectedDate): 3 readings = 140 each.
      // Individual-reading average = (100 + 140 + 140 + 140) / 4 = 130 (NOT daily avg (100+140)/2 = 120).
      await createReading(agent, '2026-05-10', 'morning_fasting', 140);
      await createReading(agent, '2026-05-10', 'after_breakfast', 140);
      await createReading(agent, '2026-05-10', 'after_lunch', 140);

      // Day 11 (after selectedDate, excluded)
      await createReading(agent, '2026-05-11', 'morning_fasting', 45);

      const res = await agent.get('/api/reports/month-to-date?date=2026-05-10');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        startDate: '2026-05-01',
        endDate: '2026-05-10',
        highest: 140,
        lowest: 100,
        average: 130,
        count: 4,
      });
      expect(res.body.readings).toBeUndefined();
    });

    it('rounds PostgreSQL aggregate averages at half-tenth boundaries and returns null stats when empty', async () => {
      const { agent } = await registerAndLogin('MTD Round', 'mtdround@example.com');

      const emptyRes = await agent.get('/api/reports/month-to-date?date=2026-04-15');
      expect(emptyRes.status).toBe(200);
      expect(emptyRes.body).toEqual({
        startDate: '2026-04-01',
        endDate: '2026-04-15',
        highest: null,
        lowest: null,
        average: null,
        count: 0,
      });
      expect(emptyRes.body.readings).toBeUndefined();

      // 401 / 4 = 100.25 -> ROUND(100.25, 1) = 100.3
      await createReading(agent, '2026-04-01', 'morning_fasting', 100);
      await createReading(agent, '2026-04-05', 'morning_fasting', 100);
      await createReading(agent, '2026-04-10', 'morning_fasting', 100);
      await createReading(agent, '2026-04-15', 'morning_fasting', 101);

      const roundedRes = await agent.get('/api/reports/month-to-date?date=2026-04-15');
      expect(roundedRes.status).toBe(200);
      expect(roundedRes.body).toEqual({
        startDate: '2026-04-01',
        endDate: '2026-04-15',
        highest: 101,
        lowest: 100,
        average: 100.3,
        count: 4,
      });
      expect(typeof roundedRes.body.average).toBe('number');
      expect(typeof roundedRes.body.count).toBe('number');
    });
  });

  describe('GET /api/reports/monthly', () => {
    it('covers the entire previous calendar month, handles empty months, and excludes adjacent months', async () => {
      const { agent } = await registerAndLogin('Monthly User', 'monthly@example.com');

      const emptyRes = await agent.get('/api/reports/monthly?date=2026-10-15');
      expect(emptyRes.status).toBe(200);
      expect(emptyRes.body).toEqual({
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        highest: null,
        lowest: null,
        average: null,
        count: 0,
      });
      expect(emptyRes.body.readings).toBeUndefined();

      // Excluded: August and October
      await createReading(agent, '2026-08-31', 'after_dinner', 500);
      await createReading(agent, '2026-10-01', 'morning_fasting', 45);

      // Included: September 1 and September 30 (unequal counts per day)
      await createReading(agent, '2026-09-01', 'morning_fasting', 90);
      await createReading(agent, '2026-09-30', 'morning_fasting', 120);
      await createReading(agent, '2026-09-30', 'after_lunch', 150);

      // Reference date on the 1st and 15th of October both resolve to full September.
      for (const refDate of ['2026-10-01', '2026-10-15']) {
        const res = await agent.get(`/api/reports/monthly?date=${refDate}`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          startDate: '2026-09-01',
          endDate: '2026-09-30',
          highest: 150,
          lowest: 90,
          average: 120,
          count: 3,
        });
        expect(res.body.readings).toBeUndefined();
      }
    });

    it('handles January-to-December year rollover, leap-year February, non-leap February, and year-zero rejection', async () => {
      const { agent } = await registerAndLogin('Calendar Edge', 'caledge@example.com');

      // January 2026 -> December 2025
      await createReading(agent, '2025-11-30', 'morning_fasting', 400);
      await createReading(agent, '2025-12-01', 'morning_fasting', 95);
      await createReading(agent, '2025-12-31', 'after_dinner', 135);
      await createReading(agent, '2026-01-01', 'morning_fasting', 50);

      const janRolloverRes = await agent.get('/api/reports/monthly?date=2026-01-15');
      expect(janRolloverRes.status).toBe(200);
      expect(janRolloverRes.body).toEqual({
        startDate: '2025-12-01',
        endDate: '2025-12-31',
        highest: 135,
        lowest: 95,
        average: 115,
        count: 2,
      });

      // Leap year: March 2024 -> Feb 1..29, 2024
      await createReading(agent, '2024-02-29', 'after_lunch', 162);
      const leapRes = await agent.get('/api/reports/monthly?date=2024-03-10');
      expect(leapRes.status).toBe(200);
      expect(leapRes.body).toEqual({
        startDate: '2024-02-01',
        endDate: '2024-02-29',
        highest: 162,
        lowest: 162,
        average: 162,
        count: 1,
      });

      // Non-leap year: March 2025 -> Feb 1..28, 2025
      await createReading(agent, '2025-02-28', 'morning_fasting', 102);
      const nonLeapRes = await agent.get('/api/reports/monthly?date=2025-03-10');
      expect(nonLeapRes.status).toBe(200);
      expect(nonLeapRes.body).toEqual({
        startDate: '2025-02-01',
        endDate: '2025-02-28',
        highest: 102,
        lowest: 102,
        average: 102,
        count: 1,
      });

      // Year 0001 January has no valid previous calendar year (would be 0000)
      const yearZeroPrevRes = await agent.get('/api/reports/monthly?date=0001-01-15');
      expect(yearZeroPrevRes.status).toBe(400);
      expect(yearZeroPrevRes.body.error.code).toBe('INVALID_DATE');
    });

    it('defaults omitted date to the previous calendar month relative to Asia/Kolkata today', async () => {
      const { agent } = await registerAndLogin('Monthly TZ', 'monthlytz@example.com');

      await createReading(agent, '2026-05-10', 'morning_fasting', 110);
      await createReading(agent, '2026-06-15', 'after_lunch', 130);

      vi.useFakeTimers({ toFake: ['Date'] });

      // 2026-06-30T18:29:59Z === 2026-06-30 23:59:59 Asia/Kolkata -> previous month is May 2026
      vi.setSystemTime(new Date('2026-06-30T18:29:59.000Z'));
      const beforeJulyRes = await agent.get('/api/reports/monthly');
      expect(beforeJulyRes.status).toBe(200);
      expect(beforeJulyRes.body).toEqual({
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        highest: 110,
        lowest: 110,
        average: 110,
        count: 1,
      });

      // 2026-06-30T18:30:00Z === 2026-07-01 00:00:00 Asia/Kolkata -> previous month rolls over to June 2026
      vi.setSystemTime(new Date('2026-06-30T18:30:00.000Z'));
      const atJulyStartRes = await agent.get('/api/reports/monthly');
      expect(atJulyStartRes.status).toBe(200);
      expect(atJulyStartRes.body).toEqual({
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        highest: 130,
        lowest: 130,
        average: 130,
        count: 1,
      });
    });
  });

  describe('Validation, Authentication, and Cross-User Isolation', () => {
    it('rejects invalid, impossible, blank, repeated, and future dates across all three endpoints', async () => {
      const { agent } = await registerAndLogin('Report Val', 'repval@example.com');
      const futureDate = getTomorrowKolkataDate();

      for (const endpoint of ['daily', 'month-to-date', 'monthly']) {
        for (const queryString of [
          'date=',
          'date=2026-02-30',
          'date=2026-05-15T10:00:00Z',
          'date=0000-01-10',
          'date=2026-05-14&date=2026-05-15',
        ]) {
          const res = await agent.get(`/api/reports/${endpoint}?${queryString}`);
          expect(res.status).toBe(400);
          expect(res.body.error.code).toBe('INVALID_DATE');
        }

        const futureRes = await agent.get(`/api/reports/${endpoint}?date=${futureDate}`);
        expect(futureRes.status).toBe(400);
        expect(futureRes.body).toEqual({
          error: {
            code: 'FUTURE_DATE',
            message: 'Date cannot be in the future.',
          },
        });
      }
    });

    it('rejects unauthenticated requests across all three endpoints', async () => {
      for (const endpoint of ['daily', 'month-to-date', 'monthly']) {
        const res = await request(app).get(`/api/reports/${endpoint}?date=2026-05-15`);
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('isolates reports strictly per user and ignores client-supplied userId and user_id params', async () => {
      const { agent: agentA, user: userA } = await registerAndLogin('Rep User A', 'repa@example.com');
      const { agent: agentB } = await registerAndLogin('Rep User B', 'repb@example.com');

      await createReading(agentA, '2026-04-12', 'morning_fasting', 210);
      await createReading(agentA, '2026-05-15', 'after_lunch', 190);
      await createReading(agentB, '2026-05-15', 'morning_fasting', 92);

      // User B passing User A's ID must only see User B's own data / empty previous month.
      const dailyB = await agentB.get(
        `/api/reports/daily?date=2026-05-15&userId=${userA.id}&user_id=${userA.id}`
      );
      expect(dailyB.status).toBe(200);
      expect(dailyB.body).toMatchObject({
        startDate: '2026-05-15',
        endDate: '2026-05-15',
        highest: 92,
        lowest: 92,
        average: 92,
        count: 1,
      });
      expect(dailyB.body.readings).toHaveLength(1);
      expect(dailyB.body.readings[0].value).toBe(92);

      const mtdB = await agentB.get(
        `/api/reports/month-to-date?date=2026-05-15&userId=${userA.id}&user_id=${userA.id}`
      );
      expect(mtdB.status).toBe(200);
      expect(mtdB.body).toEqual({
        startDate: '2026-05-01',
        endDate: '2026-05-15',
        highest: 92,
        lowest: 92,
        average: 92,
        count: 1,
      });

      const monthlyB = await agentB.get(
        `/api/reports/monthly?date=2026-05-15&userId=${userA.id}&user_id=${userA.id}`
      );
      expect(monthlyB.status).toBe(200);
      expect(monthlyB.body).toEqual({
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        highest: null,
        lowest: null,
        average: null,
        count: 0,
      });
    });

    it('sets Cache-Control: no-store on /api responses including reports, readings, auth/me, and errors without affecting non-/api routes', async () => {
      const { agent } = await registerAndLogin('Cache Check', 'cache@example.com');
      await createReading(agent, '2026-05-15', 'morning_fasting', 105);

      const dailyRes = await agent.get('/api/reports/daily?date=2026-05-15');
      expect(dailyRes.status).toBe(200);
      expect(dailyRes.headers['cache-control']).toBe('no-store');

      const mtdRes = await agent.get('/api/reports/month-to-date?date=2026-05-15');
      expect(mtdRes.status).toBe(200);
      expect(mtdRes.headers['cache-control']).toBe('no-store');

      const monthlyRes = await agent.get('/api/reports/monthly?date=2026-05-15');
      expect(monthlyRes.status).toBe(200);
      expect(monthlyRes.headers['cache-control']).toBe('no-store');

      const unauthReportRes = await request(app).get('/api/reports/daily?date=2026-05-15');
      expect(unauthReportRes.status).toBe(401);
      expect(unauthReportRes.headers['cache-control']).toBe('no-store');

      const invalidDateRes = await agent.get('/api/reports/daily?date=2026-02-30');
      expect(invalidDateRes.status).toBe(400);
      expect(invalidDateRes.headers['cache-control']).toBe('no-store');

      const readingsRes = await agent.get('/api/readings?date=2026-05-15');
      expect(readingsRes.status).toBe(200);
      expect(readingsRes.headers['cache-control']).toBe('no-store');

      const meRes = await agent.get('/api/auth/me');
      expect(meRes.status).toBe(200);
      expect(meRes.headers['cache-control']).toBe('no-store');

      const nonApiRes = await request(app).get('/static-asset-check');
      expect(nonApiRes.status).toBe(404);
      expect(nonApiRes.headers['cache-control']).toBeUndefined();
    });
  });
});
