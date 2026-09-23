-- STP process stage clock (ANN-style monitoring)

CREATE TABLE IF NOT EXISTS txn.stp_process_stage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lot_id uuid NOT NULL REFERENCES txn.prod_stp_lot(id) ON DELETE CASCADE,
  stage_code text NOT NULL,
  sort_ord integer NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  started_at timestamptz,
  ended_at timestamptz,
  duration_min numeric(12,3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lot_id, stage_code)
);

CREATE INDEX IF NOT EXISTS ix_stp_process_stage_lot
  ON txn.stp_process_stage (tenant_id, lot_id, sort_ord);
