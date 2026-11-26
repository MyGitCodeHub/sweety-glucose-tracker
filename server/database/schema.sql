-- Sweety — PostgreSQL database schema
-- Safe to run repeatedly without dropping tables or deleting existing data.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_users PRIMARY KEY (id),
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT chk_users_name_nonblank CHECK (length(btrim(name)) > 0),
  CONSTRAINT chk_users_email_normalized CHECK (email = lower(btrim(email)) AND length(email) > 0)
);

CREATE TABLE IF NOT EXISTS glucose_readings (
  id INTEGER GENERATED ALWAYS AS IDENTITY,
  user_id INTEGER NOT NULL,
  reading_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  glucose_value INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_glucose_readings PRIMARY KEY (id),
  CONSTRAINT fk_glucose_readings_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT uq_glucose_readings_user_date_slot UNIQUE (user_id, reading_date, time_slot),
  CONSTRAINT chk_glucose_readings_time_slot CHECK (
    time_slot IN ('morning_fasting', 'after_breakfast', 'after_lunch', 'after_dinner')
  ),
  CONSTRAINT chk_glucose_readings_value CHECK (glucose_value BETWEEN 40 AND 600)
);
