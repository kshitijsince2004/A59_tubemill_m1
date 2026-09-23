-- Draw Bench parity: Table-C bands, paint/swage masters, inspection enrichment, lot fields

ALTER TABLE master.db_bench_capability ADD COLUMN IF NOT EXISTS mh_od_min_mm numeric(8,2);
ALTER TABLE master.db_bench_capability ADD COLUMN IF NOT EXISTS mh_od_max_mm numeric(8,2);
ALTER TABLE master.db_bench_capability ADD COLUMN IF NOT EXISTS mh_thk_min_mm numeric(8,2);
ALTER TABLE master.db_bench_capability ADD COLUMN IF NOT EXISTS mh_thk_max_mm numeric(8,2);
ALTER TABLE master.db_bench_capability ADD COLUMN IF NOT EXISTS fin_od_min_mm numeric(8,2);
ALTER TABLE master.db_bench_capability ADD COLUMN IF NOT EXISTS fin_od_max_mm numeric(8,2);
ALTER TABLE master.db_bench_capability ADD COLUMN IF NOT EXISTS fin_thk_min_mm numeric(8,2);
ALTER TABLE master.db_bench_capability ADD COLUMN IF NOT EXISTS fin_thk_max_mm numeric(8,2);

-- Backfill OD band into MH/finished when expanded cols are null
UPDATE master.db_bench_capability
SET mh_od_min_mm = COALESCE(mh_od_min_mm, od_min_mm),
    mh_od_max_mm = COALESCE(mh_od_max_mm, od_max_mm),
    fin_od_min_mm = COALESCE(fin_od_min_mm, od_min_mm),
    fin_od_max_mm = COALESCE(fin_od_max_mm, od_max_mm)
WHERE mh_od_min_mm IS NULL OR fin_od_min_mm IS NULL;

ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS paint_colour text;
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS swage_end_mm numeric(10,1);
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS input_nos integer;
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS special_control text;

ALTER TABLE txn.db_inspection ADD COLUMN IF NOT EXISTS inspection_type text;
ALTER TABLE txn.db_inspection ADD COLUMN IF NOT EXISTS od_mm numeric(10,3);
ALTER TABLE txn.db_inspection ADD COLUMN IF NOT EXISTS id_mm numeric(10,3);
ALTER TABLE txn.db_inspection ADD COLUMN IF NOT EXISTS thk_mm numeric(10,3);
ALTER TABLE txn.db_inspection ADD COLUMN IF NOT EXISTS len_mm numeric(10,1);
ALTER TABLE txn.db_inspection ADD COLUMN IF NOT EXISTS disposition text;
ALTER TABLE txn.db_inspection ADD COLUMN IF NOT EXISTS special_control text;
ALTER TABLE txn.db_inspection ADD COLUMN IF NOT EXISTS surface text;

CREATE TABLE IF NOT EXISTS master.db_paint_colour (
  grade_code text NOT NULL,
  tenant_id uuid NOT NULL,
  paint_colour text NOT NULL,
  PRIMARY KEY (tenant_id, grade_code)
);

CREATE TABLE IF NOT EXISTS master.db_swage_end_spec (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  tonnage_min numeric(8,1) NOT NULL,
  tonnage_max numeric(8,1) NOT NULL,
  length_nom_mm numeric(10,1),
  length_tol_mm numeric(10,1),
  length_min_mm numeric(10,1),
  length_max_mm numeric(10,1),
  label text
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_db_swage_end_band
  ON master.db_swage_end_spec (tenant_id, tonnage_min, tonnage_max);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'master.db_paint_colour',
    'master.db_swage_end_spec'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %s', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %s USING (tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) WITH CHECK (tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))',
      t
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON master.db_paint_colour, master.db_swage_end_spec TO m1_app;

-- Seed Table-C / B reference rows for default tenant when empty (idempotent upserts)
DO $$
DECLARE
  tid uuid := NULLIF(current_setting('app.tenant_id', true), '')::uuid;
BEGIN
  IF tid IS NULL THEN
    SELECT tenant_id INTO tid FROM master.machine LIMIT 1;
  END IF;
  IF tid IS NULL THEN
    RETURN;
  END IF;

  -- Drop obsolete stub benches not in Table-C workbook
  DELETE FROM master.db_bench_capability
  WHERE tenant_id = tid AND bench_code IN ('DB-25T','DB-60T','DB-100T','DB-150T');
  DELETE FROM master.machine
  WHERE tenant_id = tid AND machine_code IN ('DB-25T','DB-60T','DB-100T','DB-150T');

  -- Ensure workbook bench machines exist
  INSERT INTO master.machine (machine_code, tenant_id, label, process_code)
  VALUES
    ('DB-10T', tid, 'Draw Bench 10T', 'DRW'),
    ('DB-20T', tid, 'Draw Bench 20T', 'DRW'),
    ('DB-40T', tid, 'Draw Bench 40T', 'DRW'),
    ('DB-45T', tid, 'Draw Bench 45T (3 tube)', 'DRW'),
    ('DB-80T', tid, 'Draw Bench 80T', 'DRW'),
    ('DB-120T', tid, 'Draw Bench 120T', 'DRW'),
    ('DB-180T', tid, 'Draw Bench 180T (LDP)', 'DRW'),
    ('DB-250T', tid, 'Draw Bench 250T (LDP)', 'DRW')
  ON CONFLICT (machine_code) DO UPDATE SET label = EXCLUDED.label, process_code = 'DRW';

  INSERT INTO master.db_bench_capability (
    bench_code, tenant_id, tonnage_t, od_min_mm, od_max_mm, label,
    mh_od_min_mm, mh_od_max_mm, mh_thk_min_mm, mh_thk_max_mm,
    fin_od_min_mm, fin_od_max_mm, fin_thk_min_mm, fin_thk_max_mm
  ) VALUES
    ('DB-10T', tid, 10, 11, 38.1, 'Draw Bench 10T', 11, 38.1, 0.89, 2.5, 6.5, 25.4, 0.7, 2.0),
    ('DB-20T', tid, 20, 22.23, 44.45, 'Draw Bench 20T', 22.23, 44.45, 1.4, 5.8, 12.7, 60.3, 0.8, 5.0),
    ('DB-40T', tid, 40, 28.58, 88.9, 'Draw Bench 40T', 28.58, 88.9, 2.0, 6.4, 38.1, 76.2, 1.0, 6.4),
    ('DB-45T', tid, 45, 25.4, 50.8, 'Draw Bench 45T (3 tube)', 25.4, 50.8, 2.0, 3.0, NULL, NULL, 2.0, 3.6),
    ('DB-80T', tid, 80, 38.1, 127, 'Draw Bench 80T', 38.1, 127, 2.0, 7.5, 50.8, 114.3, NULL, NULL),
    ('DB-120T', tid, 120, 63.5, 114.3, 'Draw Bench 120T', 63.5, 114.3, 7.5, 9.5, NULL, NULL, 7.0, 9.0),
    ('DB-180T', tid, 180, 88.9, 168.3, 'Draw Bench 180T (LDP)', 88.9, 168.3, 4, 13, 63.5, 140, 3, 12.7),
    ('DB-250T', tid, 250, 88.9, 219.1, 'Draw Bench 250T (LDP)', 88.9, 219.1, 4, 15, 63.5, 212.0, 3, 14)
  ON CONFLICT (bench_code) DO UPDATE SET
    tonnage_t = EXCLUDED.tonnage_t,
    od_min_mm = EXCLUDED.od_min_mm,
    od_max_mm = EXCLUDED.od_max_mm,
    label = EXCLUDED.label,
    mh_od_min_mm = EXCLUDED.mh_od_min_mm,
    mh_od_max_mm = EXCLUDED.mh_od_max_mm,
    mh_thk_min_mm = EXCLUDED.mh_thk_min_mm,
    mh_thk_max_mm = EXCLUDED.mh_thk_max_mm,
    fin_od_min_mm = EXCLUDED.fin_od_min_mm,
    fin_od_max_mm = EXCLUDED.fin_od_max_mm,
    fin_thk_min_mm = EXCLUDED.fin_thk_min_mm,
    fin_thk_max_mm = EXCLUDED.fin_thk_max_mm;

  INSERT INTO master.db_paint_colour (grade_code, tenant_id, paint_colour) VALUES
    ('1008', tid, 'White'),
    ('1010', tid, 'White'),
    ('1020', tid, 'Yellow'),
    ('1026', tid, 'Smoke grey'),
    ('ST52', tid, 'Pink'),
    ('BSK46', tid, 'Brown'),
    ('CORTON', tid, 'Blue'),
    ('SAE-1541', tid, 'Light blue + white'),
    ('SPL-K3', tid, 'Orange'),
    ('GRADE-50', tid, 'Light pink + white')
  ON CONFLICT (tenant_id, grade_code) DO UPDATE SET paint_colour = EXCLUDED.paint_colour;

  INSERT INTO master.db_swage_end_spec (
    tenant_id, tonnage_min, tonnage_max, length_nom_mm, length_tol_mm, length_min_mm, length_max_mm, label
  )
  SELECT tid, v.tmin, v.tmax, v.nom, v.tol, v.lo, v.hi, v.label
  FROM (VALUES
    (10::numeric, 20::numeric, 80::numeric, 10::numeric, NULL::numeric, NULL::numeric, 'DB-10T & DB-20T'),
    (40::numeric, 80::numeric, 100::numeric, 10::numeric, NULL::numeric, NULL::numeric, 'DB-40T & DB-80T'),
    (120::numeric, 120::numeric, 120::numeric, 10::numeric, NULL::numeric, NULL::numeric, 'DB-120T'),
    (180::numeric, 250::numeric, NULL::numeric, NULL::numeric, 190::numeric, 225::numeric, 'DB-180T & DB-250T (LDP)')
  ) AS v(tmin, tmax, nom, tol, lo, hi, label)
  WHERE NOT EXISTS (
    SELECT 1 FROM master.db_swage_end_spec s
    WHERE s.tenant_id = tid AND s.tonnage_min = v.tmin AND s.tonnage_max = v.tmax
  );
END $$;
