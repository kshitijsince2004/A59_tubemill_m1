-- Furnace production report: PNG/NH3 consumption A/B/C + recipe HT type
ALTER TABLE txn.prod_ann_run
  ADD COLUMN IF NOT EXISTS png_a numeric(12,3),
  ADD COLUMN IF NOT EXISTS png_b numeric(12,3),
  ADD COLUMN IF NOT EXISTS png_c numeric(12,3),
  ADD COLUMN IF NOT EXISTS nh3_a numeric(12,3),
  ADD COLUMN IF NOT EXISTS nh3_b numeric(12,3),
  ADD COLUMN IF NOT EXISTS nh3_c numeric(12,3);

UPDATE txn.prod_ann_run
SET png_a = COALESCE(png_a, png_consumption),
    nh3_a = COALESCE(nh3_a, nh3_consumption)
WHERE png_consumption IS NOT NULL OR nh3_consumption IS NOT NULL;

ALTER TABLE master.fur_zone_recipe
  ADD COLUMN IF NOT EXISTS ht_type text;

UPDATE master.fur_zone_recipe
SET ht_type = COALESCE(ht_type, 'ANNEAL')
WHERE ht_type IS NULL;
