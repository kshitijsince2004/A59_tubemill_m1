-- Draw Bench production clock (Start / Running / End) — mirrors STP pattern

ALTER TABLE txn.prod_db_lot
  ADD COLUMN IF NOT EXISTS production_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS production_ended_at timestamptz;

CREATE INDEX IF NOT EXISTS ix_prod_db_lot_clock
  ON txn.prod_db_lot (tenant_id, production_started_at)
  WHERE production_started_at IS NOT NULL AND production_ended_at IS NULL;
