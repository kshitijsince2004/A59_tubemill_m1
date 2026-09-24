-- Machine handover engine (A59 port of Zedral machine_handover, final shape)
-- + shift_log_id on open-work parents for carry-forward

-- Optional shift windows (IST defaults A/B/C) if not already present
CREATE TABLE IF NOT EXISTS master.shift (
  shift_code text PRIMARY KEY,
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL
);

INSERT INTO master.shift (shift_code, name, start_time, end_time)
VALUES
  ('A', 'Shift A', '06:00', '14:00'),
  ('B', 'Shift B', '14:00', '22:00'),
  ('C', 'Shift C', '22:00', '06:00')
ON CONFLICT (shift_code) DO UPDATE SET
  name = EXCLUDED.name,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time;

CREATE TABLE IF NOT EXISTS txn.machine_handover (
  handover_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  machine_code text NOT NULL REFERENCES master.machine(machine_code),
  process_code text NOT NULL,
  batch_number text,
  outgoing_shift_code text NOT NULL,
  incoming_shift_code text NOT NULL,
  outgoing_prod_date date NOT NULL,
  incoming_prod_date date NOT NULL,
  outgoing_operator_id uuid REFERENCES security.app_user(user_id),
  incoming_operator_id uuid REFERENCES security.app_user(user_id),
  machine_status text NOT NULL
    CHECK (machine_status IN ('RUNNING', 'IDLE', 'BREAKDOWN', 'MAINTENANCE', 'STOPPAGE')),
  breakdown_code text,
  breakdown_description text,
  downtime_minutes integer,
  maintenance_status text,
  remarks text NOT NULL,
  handover_priority text NOT NULL DEFAULT 'MEDIUM'
    CHECK (handover_priority IN ('LOW', 'MEDIUM', 'HIGH')),
  queue_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  production_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  open_stoppages jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT',
      'PENDING',
      'ACCEPTED',
      'REJECTED',
      'CLARIFICATION_REQUESTED',
      'CANCELLED',
      'AUTO_COMPLETED'
    )),
  clarification_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  created_by_boundary boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_machine_handover_pending
  ON txn.machine_handover (tenant_id, machine_code, status)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS ix_machine_handover_draft
  ON txn.machine_handover (tenant_id, machine_code, status)
  WHERE status = 'DRAFT';

CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_handover_boundary_outgoing
  ON txn.machine_handover (
    tenant_id,
    machine_code,
    outgoing_shift_code,
    ((outgoing_prod_date)::date)
  )
  WHERE created_by_boundary = true;

-- Carry-forward: stamp open work with universal shift_log
ALTER TABLE txn.prod_tm_run
  ADD COLUMN IF NOT EXISTS shift_log_id uuid REFERENCES txn.shift_log(id);

ALTER TABLE txn.prod_ann_run
  ADD COLUMN IF NOT EXISTS shift_log_id uuid REFERENCES txn.shift_log(id);

ALTER TABLE txn.prod_stp_lot
  ADD COLUMN IF NOT EXISTS shift_log_id uuid REFERENCES txn.shift_log(id);

ALTER TABLE txn.prod_db_lot
  ADD COLUMN IF NOT EXISTS shift_log_id uuid REFERENCES txn.shift_log(id);

ALTER TABLE txn.stoppage_entry
  ADD COLUMN IF NOT EXISTS shift_log_id uuid REFERENCES txn.shift_log(id);

CREATE INDEX IF NOT EXISTS ix_prod_tm_run_shift_log
  ON txn.prod_tm_run (tenant_id, shift_log_id)
  WHERE shift_log_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_prod_ann_run_shift_log
  ON txn.prod_ann_run (tenant_id, shift_log_id)
  WHERE shift_log_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_prod_stp_lot_shift_log
  ON txn.prod_stp_lot (tenant_id, shift_log_id)
  WHERE shift_log_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_prod_db_lot_shift_log
  ON txn.prod_db_lot (tenant_id, shift_log_id)
  WHERE shift_log_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_stoppage_entry_shift_log
  ON txn.stoppage_entry (tenant_id, shift_log_id)
  WHERE shift_log_id IS NOT NULL;

DO $$
BEGIN
  BEGIN
    ALTER TABLE txn.machine_handover ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE txn.machine_handover FORCE ROW LEVEL SECURITY;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    DROP POLICY IF EXISTS tenant_isolation ON txn.machine_handover;
    CREATE POLICY tenant_isolation ON txn.machine_handover
      USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
      WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
