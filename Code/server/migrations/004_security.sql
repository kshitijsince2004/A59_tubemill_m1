-- Phase 5: security (m1_app + RLS), shift handover, BC writeback log

CREATE TABLE IF NOT EXISTS demo.bc_writeback_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid REFERENCES txn.prod_tm_run(id),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'LOGGED',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS txn.tm_shift_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  mill_code text NOT NULL,
  shift_code text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  carried_run_ids uuid[] DEFAULT '{}',
  carried_stoppage_ids uuid[] DEFAULT '{}',
  prev_shift_id uuid
);

-- App role without BYPASSRLS (H-2 lite). Migrate/seed continue as tubemill owner.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'm1_app') THEN
    CREATE ROLE m1_app LOGIN PASSWORD 'm1_app' NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA master, txn, plc, demo TO m1_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA master, txn, plc, demo TO m1_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA master, txn, plc, demo
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO m1_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA master, txn, plc, demo TO m1_app;

-- RLS helper: tenant from session setting app.tenant_id
ALTER TABLE txn.prod_tm_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE txn.prod_tm_run FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON txn.prod_tm_run;
CREATE POLICY tenant_isolation ON txn.prod_tm_run
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE txn.tm_setup ENABLE ROW LEVEL SECURITY;
ALTER TABLE txn.tm_setup FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON txn.tm_setup;
CREATE POLICY tenant_isolation ON txn.tm_setup
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE txn.prod_tm_coil_input ENABLE ROW LEVEL SECURITY;
ALTER TABLE txn.prod_tm_coil_input FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON txn.prod_tm_coil_input;
CREATE POLICY tenant_isolation ON txn.prod_tm_coil_input
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE txn.prod_tm_bundle ENABLE ROW LEVEL SECURITY;
ALTER TABLE txn.prod_tm_bundle FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON txn.prod_tm_bundle;
CREATE POLICY tenant_isolation ON txn.prod_tm_bundle
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE txn.stoppage_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE txn.stoppage_entry FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON txn.stoppage_entry;
CREATE POLICY tenant_isolation ON txn.stoppage_entry
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE txn.tm_exception ENABLE ROW LEVEL SECURITY;
ALTER TABLE txn.tm_exception FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON txn.tm_exception;
CREATE POLICY tenant_isolation ON txn.tm_exception
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE master.tm_param_chart ENABLE ROW LEVEL SECURITY;
ALTER TABLE master.tm_param_chart FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON master.tm_param_chart;
CREATE POLICY tenant_isolation ON master.tm_param_chart
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE plc.sample ENABLE ROW LEVEL SECURITY;
ALTER TABLE plc.sample FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON plc.sample;
CREATE POLICY tenant_isolation ON plc.sample
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

-- Owner role (tubemill) bypasses RLS by default as table owner; m1_app does not.
