import express from 'express';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getMonthToDateRange, getPreviousMonthRange } from '../utils/dates.js';
import { validateDateQueryParam } from '../validators/readingValidator.js';

const SLOT_ORDER_SQL = `
  CASE time_slot
    WHEN 'morning_fasting' THEN 1
    WHEN 'after_breakfast' THEN 2
    WHEN 'after_lunch' THEN 3
    WHEN 'after_dinner' THEN 4
  END
`;

function formatReadingRow(row) {
  return {
    id: row.id,
    date: row.reading_date,
    slot: row.time_slot,
    value: row.glucose_value,
  };
}

function summarizeDailyRows(rows) {
  if (rows.length === 0) {
    return {
      highest: null,
      lowest: null,
      average: null,
      count: 0,
      readings: [],
    };
  }

  let highest = rows[0].glucose_value;
  let lowest = rows[0].glucose_value;
  let sum = 0;

  for (const row of rows) {
    const value = row.glucose_value;
    if (value > highest) {
      highest = value;
    }
    if (value < lowest) {
      lowest = value;
    }
    sum += value;
  }

  const count = rows.length;
  const average = Math.round((sum * 10) / count) / 10;

  return {
    highest,
    lowest,
    average,
    count,
    readings: rows.map(formatReadingRow),
  };
}

async function fetchAggregateReport(userId, startDate, endDate) {
  const result = await query(
    `SELECT
       MAX(glucose_value) AS highest,
       MIN(glucose_value) AS lowest,
       ROUND(AVG(glucose_value), 1)::float8 AS average,
       COUNT(*)::int AS count
     FROM glucose_readings
     WHERE user_id = $1
       AND reading_date BETWEEN $2 AND $3`,
    [userId, startDate, endDate]
  );

  const row = result.rows[0];
  const count = Number(row.count);

  if (count === 0) {
    return {
      startDate,
      endDate,
      highest: null,
      lowest: null,
      average: null,
      count: 0,
    };
  }

  return {
    startDate,
    endDate,
    highest: Number(row.highest),
    lowest: Number(row.lowest),
    average: Number(row.average),
    count,
  };
}

export function createReportRouter() {
  const router = express.Router();

  router.use(requireAuth);

  router.get('/daily', async (req, res) => {
    const dateResult = validateDateQueryParam(req.query.date);
    if (dateResult.error) {
      return res.status(400).json({ error: dateResult.error });
    }

    const selectedDate = dateResult.date;
    const result = await query(
      `SELECT id, reading_date, time_slot, glucose_value
       FROM glucose_readings
       WHERE user_id = $1 AND reading_date = $2
       ORDER BY reading_date ASC, ${SLOT_ORDER_SQL} ASC, id ASC`,
      [req.user.id, selectedDate]
    );

    const summary = summarizeDailyRows(result.rows);
    return res.status(200).json({
      startDate: selectedDate,
      endDate: selectedDate,
      ...summary,
    });
  });

  router.get('/month-to-date', async (req, res) => {
    const dateResult = validateDateQueryParam(req.query.date);
    if (dateResult.error) {
      return res.status(400).json({ error: dateResult.error });
    }

    const range = getMonthToDateRange(dateResult.date);
    const report = await fetchAggregateReport(req.user.id, range.startDate, range.endDate);
    return res.status(200).json(report);
  });

  router.get('/monthly', async (req, res) => {
    const dateResult = validateDateQueryParam(req.query.date);
    if (dateResult.error) {
      return res.status(400).json({ error: dateResult.error });
    }

    const range = getPreviousMonthRange(dateResult.date);
    if (!range) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE',
          message: 'Please enter a valid calendar date in YYYY-MM-DD format.',
        },
      });
    }

    const report = await fetchAggregateReport(req.user.id, range.startDate, range.endDate);
    return res.status(200).json(report);
  });

  return router;
}
