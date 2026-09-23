-- Mirrors server/migrations/013_production_source_mode.sql
-- Production Console: preserve final spreadsheet source vs current input mode.

ALTER TABLE txn.prod_tm_bundle
  ADD COLUMN IF NOT EXISTS final_source text,
  ADD COLUMN IF NOT EXISTS current_input_mode text;

COMMENT ON COLUMN txn.prod_tm_bundle.final_source IS
  'Spreadsheet final source class: PLC | MANUAL | DERIVED | SYSTEM';
COMMENT ON COLUMN txn.prod_tm_bundle.current_input_mode IS
  'Current capture mode: MANUAL (phase-1) | PLC (future collector)';

ALTER TABLE txn.prod_tm_run
  ALTER COLUMN raw_material_mt DROP DEFAULT,
  ALTER COLUMN total_prime_mt DROP DEFAULT,
  ALTER COLUMN total_pq2_mt DROP DEFAULT,
  ALTER COLUMN total_cq_mt DROP DEFAULT,
  ALTER COLUMN total_open_mt DROP DEFAULT,
  ALTER COLUMN total_scrap_mt DROP DEFAULT;
