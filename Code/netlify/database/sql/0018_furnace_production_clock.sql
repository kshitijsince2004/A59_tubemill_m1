-- Furnace production clock: explicit Start / End for board machine status
ALTER TABLE txn.prod_ann_run
  ADD COLUMN IF NOT EXISTS production_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS production_ended_at timestamptz;
