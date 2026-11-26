import express from 'express';
import { query, withTransaction } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  SLOT_LABELS,
  validateDateQueryParam,
  validateReadingId,
  validateReadingPayload,
} from '../validators/readingValidator.js';

const DAILY_LIMIT = 4;

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

function sendDailyLimitConflict(res) {
  return res.status(409).json({
    error: {
      code: 'DAILY_LIMIT',
      message: 'You can add only 4 readings per day.',
    },
  });
}

function sendDuplicateSlotConflict(res, slot) {
  const label = SLOT_LABELS[slot];
  return res.status(409).json({
    error: {
      code: 'DUPLICATE_SLOT',
      message: `You already have ${label === 'Morning (fasting)' ? 'a' : 'an'} ${label} reading for this date.`,
    },
  });
}

function sendReadingNotFound(res) {
  return res.status(404).json({
    error: {
      code: 'READING_NOT_FOUND',
      message: 'Reading not found.',
    },
  });
}

function sendUnauthorized(res) {
  return res.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required.',
    },
  });
}

async function lockAuthenticatedUser(client, userId) {
  const lockResult = await client.query(
    'SELECT id FROM users WHERE id = $1 FOR UPDATE',
    [userId]
  );
  return lockResult.rows.length > 0;
}

async function checkTargetDateCapacityAndSlot(client, { userId, date, slot, excludeId = null }) {
  const countSql = excludeId === null
    ? 'SELECT COUNT(*)::int AS count FROM glucose_readings WHERE user_id = $1 AND reading_date = $2'
    : 'SELECT COUNT(*)::int AS count FROM glucose_readings WHERE user_id = $1 AND reading_date = $2 AND id <> $3';
  const countParams = excludeId === null ? [userId, date] : [userId, date, excludeId];

  const countResult = await client.query(countSql, countParams);
  if (countResult.rows[0].count >= DAILY_LIMIT) {
    return 'DAILY_LIMIT';
  }

  const dupSql = excludeId === null
    ? 'SELECT 1 FROM glucose_readings WHERE user_id = $1 AND reading_date = $2 AND time_slot = $3'
    : 'SELECT 1 FROM glucose_readings WHERE user_id = $1 AND reading_date = $2 AND time_slot = $3 AND id <> $4';
  const dupParams = excludeId === null ? [userId, date, slot] : [userId, date, slot, excludeId];

  const dupResult = await client.query(dupSql, dupParams);
  if (dupResult.rows.length > 0) {
    return 'DUPLICATE_SLOT';
  }

  return null;
}

export function createReadingRouter() {
  const router = express.Router();

  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const dateResult = validateDateQueryParam(req.query.date);
    if (dateResult.error) {
      return res.status(400).json({ error: dateResult.error });
    }

    const result = await query(
      `SELECT id, reading_date, time_slot, glucose_value
       FROM glucose_readings
       WHERE user_id = $1 AND reading_date = $2
       ORDER BY reading_date ASC, ${SLOT_ORDER_SQL} ASC, id ASC`,
      [req.user.id, dateResult.date]
    );

    return res.status(200).json(result.rows.map(formatReadingRow));
  });

  router.post('/', async (req, res) => {
    const { data, error } = validateReadingPayload(req.body);
    if (error) {
      return res.status(400).json({ error });
    }

    let outcome;
    try {
      outcome = await withTransaction(async (client) => {
        const userExists = await lockAuthenticatedUser(client, req.user.id);
        if (!userExists) {
          return { status: 'UNAUTHORIZED' };
        }

        const conflict = await checkTargetDateCapacityAndSlot(client, {
          userId: req.user.id,
          date: data.date,
          slot: data.slot,
        });
        if (conflict) {
          return { status: conflict };
        }

        const insertResult = await client.query(
          `INSERT INTO glucose_readings (user_id, reading_date, time_slot, glucose_value)
           VALUES ($1, $2, $3, $4)
           RETURNING id, reading_date, time_slot, glucose_value`,
          [req.user.id, data.date, data.slot, data.value]
        );

        return { status: 'CREATED', row: insertResult.rows[0] };
      });
    } catch (dbError) {
      // Runs only after withTransaction has rolled back and released its client.
      if (
        dbError?.code === '23505' &&
        dbError?.constraint === 'uq_glucose_readings_user_date_slot'
      ) {
        const countResult = await query(
          'SELECT COUNT(*)::int AS count FROM glucose_readings WHERE user_id = $1 AND reading_date = $2',
          [req.user.id, data.date]
        );
        if (countResult.rows[0].count >= DAILY_LIMIT) {
          return sendDailyLimitConflict(res);
        }
        return sendDuplicateSlotConflict(res, data.slot);
      }
      throw dbError;
    }

    if (outcome.status === 'UNAUTHORIZED') {
      return sendUnauthorized(res);
    }
    if (outcome.status === 'DAILY_LIMIT') {
      return sendDailyLimitConflict(res);
    }
    if (outcome.status === 'DUPLICATE_SLOT') {
      return sendDuplicateSlotConflict(res, data.slot);
    }

    return res.status(201).json(formatReadingRow(outcome.row));
  });

  router.put('/:id', async (req, res) => {
    const idResult = validateReadingId(req.params.id);
    if (idResult.error) {
      return res.status(400).json({ error: idResult.error });
    }

    const { data, error } = validateReadingPayload(req.body);
    if (error) {
      return res.status(400).json({ error });
    }

    let outcome;
    try {
      outcome = await withTransaction(async (client) => {
        const userExists = await lockAuthenticatedUser(client, req.user.id);
        if (!userExists) {
          return { status: 'UNAUTHORIZED' };
        }

        const existingResult = await client.query(
          'SELECT id FROM glucose_readings WHERE id = $1 AND user_id = $2',
          [idResult.id, req.user.id]
        );
        if (existingResult.rows.length === 0) {
          return { status: 'NOT_FOUND' };
        }

        const conflict = await checkTargetDateCapacityAndSlot(client, {
          userId: req.user.id,
          date: data.date,
          slot: data.slot,
          excludeId: idResult.id,
        });
        if (conflict) {
          return { status: conflict };
        }

        const updateResult = await client.query(
          `UPDATE glucose_readings
           SET reading_date = $1,
               time_slot = $2,
               glucose_value = $3,
               updated_at = NOW()
           WHERE id = $4 AND user_id = $5
           RETURNING id, reading_date, time_slot, glucose_value`,
          [data.date, data.slot, data.value, idResult.id, req.user.id]
        );

        if (updateResult.rows.length === 0) {
          return { status: 'NOT_FOUND' };
        }

        return { status: 'UPDATED', row: updateResult.rows[0] };
      });
    } catch (dbError) {
      if (
        dbError?.code === '23505' &&
        dbError?.constraint === 'uq_glucose_readings_user_date_slot'
      ) {
        const countResult = await query(
          `SELECT COUNT(*)::int AS count
           FROM glucose_readings
           WHERE user_id = $1 AND reading_date = $2 AND id <> $3`,
          [req.user.id, data.date, idResult.id]
        );
        if (countResult.rows[0].count >= DAILY_LIMIT) {
          return sendDailyLimitConflict(res);
        }
        return sendDuplicateSlotConflict(res, data.slot);
      }
      throw dbError;
    }

    if (outcome.status === 'UNAUTHORIZED') {
      return sendUnauthorized(res);
    }
    if (outcome.status === 'NOT_FOUND') {
      return sendReadingNotFound(res);
    }
    if (outcome.status === 'DAILY_LIMIT') {
      return sendDailyLimitConflict(res);
    }
    if (outcome.status === 'DUPLICATE_SLOT') {
      return sendDuplicateSlotConflict(res, data.slot);
    }

    return res.status(200).json(formatReadingRow(outcome.row));
  });

  router.delete('/:id', async (req, res) => {
    const idResult = validateReadingId(req.params.id);
    if (idResult.error) {
      return res.status(400).json({ error: idResult.error });
    }

    const outcome = await withTransaction(async (client) => {
      const userExists = await lockAuthenticatedUser(client, req.user.id);
      if (!userExists) {
        return { status: 'UNAUTHORIZED' };
      }

      const deleteResult = await client.query(
        'DELETE FROM glucose_readings WHERE id = $1 AND user_id = $2 RETURNING id',
        [idResult.id, req.user.id]
      );

      if (deleteResult.rowCount === 0) {
        return { status: 'NOT_FOUND' };
      }

      return { status: 'DELETED' };
    });

    if (outcome.status === 'UNAUTHORIZED') {
      return sendUnauthorized(res);
    }
    if (outcome.status === 'NOT_FOUND') {
      return sendReadingNotFound(res);
    }

    return res.status(204).end();
  });

  return router;
}
