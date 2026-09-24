-- Crew session engine: roster soft-delete + shift_log + machine_shift_session + session_crew

ALTER TABLE master.machine_crew_roster
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS ix_machine_crew_active
  ON master.machine_crew_roster (tenant_id, machine_code)
  WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_crew_active_name
  ON master.machine_crew_roster (tenant_id, machine_code, lower(person_name))
  WHERE is_active = true;

-- Universal shift log anchor (TM tm_shift_log remains for mill handover until a later merge)
CREATE TABLE IF NOT EXISTS txn.shift_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  machine_code text NOT NULL REFERENCES master.machine(machine_code),
  shift_code text NOT NULL DEFAULT 'A',
  prod_date date NOT NULL DEFAULT (CURRENT_DATE),
  status text NOT NULL DEFAULT 'OPEN',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_shift_log_status CHECK (status IN ('OPEN', 'CLOSED'))
);

CREATE INDEX IF NOT EXISTS ix_shift_log_machine_date
  ON txn.shift_log (tenant_id, machine_code, prod_date, shift_code);

CREATE UNIQUE INDEX IF NOT EXISTS uq_shift_log_open
  ON txn.shift_log (tenant_id, machine_code, prod_date, shift_code)
  WHERE status = 'OPEN';

CREATE TABLE IF NOT EXISTS txn.machine_shift_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  machine_code text NOT NULL REFERENCES master.machine(machine_code),
  shift_code text NOT NULL DEFAULT 'A',
  prod_date date NOT NULL DEFAULT (CURRENT_DATE),
  operator_user_id text NOT NULL,
  shift_log_id uuid NOT NULL REFERENCES txn.shift_log(id),
  status text NOT NULL DEFAULT 'ACTIVE',
  started_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_machine_shift_session_status CHECK (status IN ('ACTIVE', 'CLOSED'))
);

CREATE INDEX IF NOT EXISTS ix_machine_shift_session_log
  ON txn.machine_shift_session (tenant_id, shift_log_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_shift_session_active
  ON txn.machine_shift_session (tenant_id, machine_code)
  WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS txn.session_crew (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES txn.machine_shift_session(id) ON DELETE CASCADE,
  crew_id uuid NOT NULL REFERENCES master.machine_crew_roster(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_session_crew UNIQUE (session_id, crew_id)
);

CREATE INDEX IF NOT EXISTS ix_session_crew_session
  ON txn.session_crew (tenant_id, session_id);

DO $$
BEGIN
  BEGIN
    ALTER TABLE master.machine_crew_roster ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE txn.shift_log ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE txn.machine_shift_session ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE txn.session_crew ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
