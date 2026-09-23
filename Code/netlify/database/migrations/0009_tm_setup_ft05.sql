-- TM-FT-05 setup sheet gap columns on txn.tm_setup
ALTER TABLE txn.tm_setup
  ADD COLUMN IF NOT EXISTS slit_thk_mm numeric(6,3),
  ADD COLUMN IF NOT EXISTS slit_width_mm numeric(7,2),
  ADD COLUMN IF NOT EXISTS roll_set text,
  ADD COLUMN IF NOT EXISTS coolant_pressure_kg numeric(5,2),
  ADD COLUMN IF NOT EXISTS wiper_used boolean,
  ADD COLUMN IF NOT EXISTS speed_mpm_obs numeric(7,2),
  ADD COLUMN IF NOT EXISTS power_kw_obs numeric(7,2);
