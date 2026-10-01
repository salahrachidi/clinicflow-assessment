CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (length(trim(full_name)) >= 2),
  cin text NOT NULL UNIQUE,
  phone text NOT NULL,
  birth_date date NOT NULL CHECK (birth_date <= CURRENT_DATE),
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  appointment_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  reason text NOT NULL CHECK (length(trim(reason)) >= 2),
  notes text,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX patients_full_name_search_idx ON patients (lower(full_name) text_pattern_ops) WHERE deleted_at IS NULL;
CREATE INDEX patients_cin_search_idx ON patients (cin text_pattern_ops) WHERE deleted_at IS NULL;
CREATE INDEX appointments_date_status_idx ON appointments (appointment_date, status);
CREATE INDEX appointments_patient_date_idx ON appointments (patient_id, appointment_date DESC);

ALTER TABLE appointments
  ADD CONSTRAINT appointments_patient_confirmed_window_excl
  EXCLUDE USING gist (
    patient_id WITH =,
    tsrange(
      appointment_date AT TIME ZONE 'UTC',
      (appointment_date AT TIME ZONE 'UTC') + interval '30 minutes',
      '[)'
    ) WITH &&
  ) WHERE (status = 'confirmed');

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, created_at DESC);
