-- Multi-furnace board metadata on master.machine (RHF gas / type / order)
ALTER TABLE master.machine
  ADD COLUMN IF NOT EXISTS furnace_type text,
  ADD COLUMN IF NOT EXISTS gas_type text,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_order integer;

UPDATE master.machine SET
  furnace_type = COALESCE(furnace_type, 'RHF'),
  gas_type = CASE machine_code
    WHEN 'RHF-03' THEN 'EXO'
    WHEN 'RHF-04' THEN 'N2-PSA'
    WHEN 'RHF-05' THEN 'N2-PSA'
    ELSE gas_type
  END,
  display_order = CASE machine_code
    WHEN 'RHF-03' THEN 1
    WHEN 'RHF-04' THEN 2
    WHEN 'RHF-05' THEN 3
    ELSE COALESCE(display_order, 100)
  END,
  enabled = COALESCE(enabled, true)
WHERE process_code = 'FUR';
