-- Plant parity + genealogy + process stoppages (Option C)

-- ---------------------------------------------------------------------------
-- STP bath fields (STP-FT-01A)
-- ---------------------------------------------------------------------------
ALTER TABLE txn.prod_stp_lot ADD COLUMN IF NOT EXISTS descale_time_min numeric(8,2);
ALTER TABLE txn.prod_stp_lot ADD COLUMN IF NOT EXISTS neut_temp_c numeric(7,1);
ALTER TABLE txn.prod_stp_lot ADD COLUMN IF NOT EXISTS dryer_temp_c numeric(7,1);

-- ---------------------------------------------------------------------------
-- Draw Bench flat size / qty parity (DB-FT-01)
-- ---------------------------------------------------------------------------
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS from_od_mm numeric(10,3);
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS from_th_mm numeric(10,3);
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS from_len_mm numeric(10,1);
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS to_od_mm numeric(10,3);
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS to_id_mm numeric(10,3);
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS to_th_mm numeric(10,3);
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS to_len_mm numeric(10,1);
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS final_od_mm numeric(10,3);
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS final_id_mm numeric(10,3);
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS final_th_mm numeric(10,3);
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS final_len_mm numeric(10,1);
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS pass_type text;
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS accepted_mt numeric(12,3);
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS material_lot_id uuid;
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS upstream_handoff_id uuid;

ALTER TABLE txn.prod_ann_run ADD COLUMN IF NOT EXISTS material_lot_id uuid;
ALTER TABLE txn.prod_ann_run ADD COLUMN IF NOT EXISTS upstream_handoff_id uuid;
ALTER TABLE txn.prod_ann_run ADD COLUMN IF NOT EXISTS qty_nos integer;
ALTER TABLE txn.prod_ann_run ADD COLUMN IF NOT EXISTS qty_mt numeric(12,3);

ALTER TABLE txn.prod_stp_lot ADD COLUMN IF NOT EXISTS material_lot_id uuid;
ALTER TABLE txn.prod_stp_lot ADD COLUMN IF NOT EXISTS upstream_handoff_id uuid;

ALTER TABLE txn.prod_db_swage ADD COLUMN IF NOT EXISTS material_lot_id uuid;
ALTER TABLE txn.prod_db_swage ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill qty aliases from existing columns
UPDATE txn.prod_ann_run SET qty_nos = COALESCE(qty_nos, tube_count), qty_mt = COALESCE(qty_mt, total_mt)
WHERE qty_nos IS NULL OR qty_mt IS NULL;

UPDATE txn.prod_db_lot SET pass_type = COALESCE(pass_type, stage) WHERE pass_type IS NULL AND stage IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Genealogy spine
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS txn.material_lot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  work_order_no text,
  lot_tag text NOT NULL,
  coil_tag text,
  customer_code text,
  grade_code text,
  size jsonb,
  status text NOT NULL DEFAULT 'OPEN',
  current_process text,
  origin_process text,
  origin_record_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_material_lot_tag ON txn.material_lot(tenant_id, lot_tag);
CREATE INDEX IF NOT EXISTS ix_material_lot_wo ON txn.material_lot(tenant_id, work_order_no);
CREATE INDEX IF NOT EXISTS ix_material_lot_process ON txn.material_lot(tenant_id, current_process, status);

CREATE TABLE IF NOT EXISTS txn.process_handoff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  material_lot_id uuid NOT NULL REFERENCES txn.material_lot(id) ON DELETE CASCADE,
  from_process text NOT NULL,
  from_record_id uuid,
  to_process text,
  to_record_id uuid,
  handed_at timestamptz NOT NULL DEFAULT now(),
  handed_by text,
  notes text
);

CREATE INDEX IF NOT EXISTS ix_handoff_lot ON txn.process_handoff(tenant_id, material_lot_id, handed_at DESC);
CREATE INDEX IF NOT EXISTS ix_handoff_from ON txn.process_handoff(tenant_id, from_process, from_record_id);

-- ---------------------------------------------------------------------------
-- Process-generic stoppages (keep run_id for TM)
-- ---------------------------------------------------------------------------
ALTER TABLE txn.stoppage_entry ADD COLUMN IF NOT EXISTS process_code text;
ALTER TABLE txn.stoppage_entry ADD COLUMN IF NOT EXISTS source_id uuid;

UPDATE txn.stoppage_entry SET process_code = 'TM' WHERE process_code IS NULL AND run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_stoppage_process_source
  ON txn.stoppage_entry(tenant_id, process_code, source_id)
  WHERE source_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Furnace soaking recipe stub (for toleranceVsSpec)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS master.fur_zone_recipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  grade_code text,
  furnace_code text,
  soaking_spec_c numeric(7,1),
  speed_spec_m_hr numeric(8,2),
  UNIQUE (tenant_id, grade_code, furnace_code)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'txn.material_lot',
    'txn.process_handoff',
    'master.fur_zone_recipe'
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

-- Optional local Docker role; Netlify managed Postgres has no m1_app.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'm1_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA txn, master TO m1_app;
  END IF;
END $$;
