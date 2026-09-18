-- Phase-complete: arcweld, edgemill, defects, hold, override audit, RLS completion

-- Hold flag on run
ALTER TABLE txn.prod_tm_run
  ADD COLUMN IF NOT EXISTS hold_status text NOT NULL DEFAULT 'NONE';
-- NONE | HELD

ALTER TABLE txn.prod_tm_run
  ADD COLUMN IF NOT EXISTS remarks_log jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Arc-weld current log (GLI-FT-TM-11)
CREATE TABLE IF NOT EXISTS txn.tm_arcweld_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  coil_input_id uuid REFERENCES txn.prod_tm_coil_input(id) ON DELETE CASCADE,
  run_id uuid REFERENCES txn.prod_tm_run(id) ON DELETE CASCADE,
  current_amp numeric(8,1),
  thk_mm numeric(6,3),
  grade_code text,
  operator_ref text,
  remark text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_tm_arcweld_coil ON txn.tm_arcweld_log(tenant_id, coil_input_id);
CREATE INDEX IF NOT EXISTS ix_tm_arcweld_run ON txn.tm_arcweld_log(tenant_id, run_id);

-- Edge milling inspection (GLI-FT-TM-12)
CREATE TABLE IF NOT EXISTS txn.prod_tm_edgemill (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid REFERENCES txn.prod_tm_run(id) ON DELETE CASCADE,
  coil_input_id uuid REFERENCES txn.prod_tm_coil_input(id),
  od text,
  thk_mm numeric(6,3),
  grade_code text,
  width_before_mm numeric(7,2),
  width_after_mm numeric(7,2),
  edge_condition text,
  operator_ref text,
  remark text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_tm_edgemill_run ON txn.prod_tm_edgemill(tenant_id, run_id);

-- Coil FKs to arcweld / edgemill
ALTER TABLE txn.prod_tm_coil_input
  ADD COLUMN IF NOT EXISTS arcweld_log_id uuid REFERENCES txn.tm_arcweld_log(id);
ALTER TABLE txn.prod_tm_coil_input
  ADD COLUMN IF NOT EXISTS edgemill_id uuid REFERENCES txn.prod_tm_edgemill(id);

-- Defects
CREATE TABLE IF NOT EXISTS master.defect_code (
  code text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  label text NOT NULL,
  category text
);

CREATE TABLE IF NOT EXISTS txn.tm_defect (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES txn.prod_tm_run(id) ON DELETE CASCADE,
  defect_code text NOT NULL REFERENCES master.defect_code(code),
  quantity_mt numeric(12,3),
  pieces integer,
  remark text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_tm_defect_run ON txn.tm_defect(tenant_id, run_id);

-- Tooling override audit
CREATE TABLE IF NOT EXISTS txn.tm_setup_override_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES txn.prod_tm_run(id) ON DELETE CASCADE,
  setup_id uuid REFERENCES txn.tm_setup(id) ON DELETE SET NULL,
  field_name text NOT NULL,
  chart_value text,
  operator_value text,
  overridden_by text,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_tm_setup_override_run ON txn.tm_setup_override_log(tenant_id, run_id);

-- Bundle needs_review when counted during OOB window
ALTER TABLE txn.prod_tm_bundle
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

-- Exception detail may include speed; add speed_mpm column for query convenience
ALTER TABLE txn.tm_exception
  ADD COLUMN IF NOT EXISTS speed_mpm numeric(7,2);

-- Work coil FK where consumable exists (soft: only when code matches)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tm_setup_work_coil' AND table_schema = 'txn'
  ) THEN
    -- Leave as free text if orphan values exist; add FK only if all non-null values exist in consumable
    IF NOT EXISTS (
      SELECT 1 FROM txn.tm_setup s
      WHERE s.work_coil_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM master.tm_consumable c WHERE c.code = s.work_coil_id)
    ) THEN
      ALTER TABLE txn.tm_setup
        ADD CONSTRAINT fk_tm_setup_work_coil
        FOREIGN KEY (work_coil_id) REFERENCES master.tm_consumable(code);
    END IF;
  END IF;
END $$;

-- RLS helper macro pattern for remaining tables
ALTER TABLE txn.prod_tm_param_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE txn.prod_tm_param_snapshot FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON txn.prod_tm_param_snapshot;
CREATE POLICY tenant_isolation ON txn.prod_tm_param_snapshot
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE master.tm_consumable ENABLE ROW LEVEL SECURITY;
ALTER TABLE master.tm_consumable FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON master.tm_consumable;
CREATE POLICY tenant_isolation ON master.tm_consumable
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE txn.tm_consumable_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE txn.tm_consumable_usage FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON txn.tm_consumable_usage;
CREATE POLICY tenant_isolation ON txn.tm_consumable_usage
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE master.stoppage_code ENABLE ROW LEVEL SECURITY;
ALTER TABLE master.stoppage_code FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON master.stoppage_code;
CREATE POLICY tenant_isolation ON master.stoppage_code
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE master.machine ENABLE ROW LEVEL SECURITY;
ALTER TABLE master.machine FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON master.machine;
CREATE POLICY tenant_isolation ON master.machine
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE master.grade ENABLE ROW LEVEL SECURITY;
ALTER TABLE master.grade FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON master.grade;
CREATE POLICY tenant_isolation ON master.grade
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE master.customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE master.customer FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON master.customer;
CREATE POLICY tenant_isolation ON master.customer
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE master.defect_code ENABLE ROW LEVEL SECURITY;
ALTER TABLE master.defect_code FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON master.defect_code;
CREATE POLICY tenant_isolation ON master.defect_code
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE txn.tm_shift_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE txn.tm_shift_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON txn.tm_shift_log;
CREATE POLICY tenant_isolation ON txn.tm_shift_log
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE plc.tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE plc.tag FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON plc.tag;
CREATE POLICY tenant_isolation ON plc.tag
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE txn.tm_arcweld_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE txn.tm_arcweld_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON txn.tm_arcweld_log;
CREATE POLICY tenant_isolation ON txn.tm_arcweld_log
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE txn.prod_tm_edgemill ENABLE ROW LEVEL SECURITY;
ALTER TABLE txn.prod_tm_edgemill FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON txn.prod_tm_edgemill;
CREATE POLICY tenant_isolation ON txn.prod_tm_edgemill
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE txn.tm_defect ENABLE ROW LEVEL SECURITY;
ALTER TABLE txn.tm_defect FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON txn.tm_defect;
CREATE POLICY tenant_isolation ON txn.tm_defect
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE txn.tm_setup_override_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE txn.tm_setup_override_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON txn.tm_setup_override_log;
CREATE POLICY tenant_isolation ON txn.tm_setup_override_log
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

-- Ensure m1_app grants cover ops + new tables
GRANT USAGE ON SCHEMA master, txn, plc, ops TO m1_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA master, txn, plc, ops TO m1_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA master, txn, plc, ops
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO m1_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA master, txn, plc, ops TO m1_app;
