-- Rename demo schema objects into ops; enable RLS on ops tables.
-- ops schema + ops.migrations ledger are created by migrate.ts before this runs.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'demo' AND table_name = 'queue_card'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'ops' AND table_name = 'queue_card'
  ) THEN
    ALTER TABLE demo.queue_card SET SCHEMA ops;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'demo' AND table_name = 'bc_writeback_log'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'ops' AND table_name = 'bc_writeback_log'
  ) THEN
    ALTER TABLE demo.bc_writeback_log SET SCHEMA ops;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'demo' AND table_name = 'migrations'
  ) THEN
    DROP TABLE demo.migrations;
  END IF;
END $$;

-- Drop empty demo schema if nothing remains
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'demo')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.tables WHERE table_schema = 'demo'
     ) THEN
    DROP SCHEMA demo;
  END IF;
END $$;

GRANT USAGE ON SCHEMA ops TO m1_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ops TO m1_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA ops
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO m1_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ops TO m1_app;

ALTER TABLE ops.queue_card ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.queue_card FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON ops.queue_card;
CREATE POLICY tenant_isolation ON ops.queue_card
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE ops.bc_writeback_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.bc_writeback_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON ops.bc_writeback_log;
CREATE POLICY tenant_isolation ON ops.bc_writeback_log
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));
