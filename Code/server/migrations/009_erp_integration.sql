-- ERP integration: control schema + additive bc_id/source columns

CREATE SCHEMA IF NOT EXISTS erp;

CREATE TABLE IF NOT EXISTS erp.sync_watermark (
  entity text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  last_cursor text,
  last_run_at timestamptz,
  status text NOT NULL DEFAULT 'IDLE',
  row_count integer NOT NULL DEFAULT 0,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp.raw_landing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity text NOT NULL,
  bc_id text NOT NULL,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_erp_raw_entity ON erp.raw_landing(tenant_id, entity, fetched_at DESC);

CREATE TABLE IF NOT EXISTS erp.writeback_job (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entry_id text NOT NULL,
  api text NOT NULL,
  process_code text,
  source_id uuid,
  payload jsonb NOT NULL,
  bc_response jsonb,
  status text NOT NULL DEFAULT 'STAGED',
  attempts integer NOT NULL DEFAULT 0,
  if_version integer NOT NULL DEFAULT 1,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_wb_entry ON erp.writeback_job(tenant_id, entry_id);
CREATE INDEX IF NOT EXISTS ix_erp_wb_status ON erp.writeback_job(tenant_id, status, created_at);

CREATE TABLE IF NOT EXISTS erp.code_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  kind text NOT NULL,
  zedral_code text NOT NULL,
  bc_code text NOT NULL,
  UNIQUE (tenant_id, kind, zedral_code)
);

CREATE TABLE IF NOT EXISTS erp.item_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  bc_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp.capacity_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  bc_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp.value_entry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  bc_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

-- Released orders mirror for FUR/STP/DRW WO pickers (TM still uses ops.queue_card)
CREATE TABLE IF NOT EXISTS erp.released_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  bc_id text NOT NULL,
  work_order_no text NOT NULL,
  status text NOT NULL DEFAULT 'Released',
  mill_code text,
  customer_code text,
  grade_code text,
  lot_no text,
  size jsonb,
  qty_pieces integer,
  planned_qty numeric(14,3),
  source text NOT NULL DEFAULT 'API',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, work_order_no)
);

CREATE INDEX IF NOT EXISTS ix_erp_rel_order_status ON erp.released_order(tenant_id, status);

-- Additive columns on masters / queue / capture
ALTER TABLE master.machine ADD COLUMN IF NOT EXISTS bc_id text;
ALTER TABLE master.machine ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'MANUAL';

ALTER TABLE master.customer ADD COLUMN IF NOT EXISTS bc_id text;
ALTER TABLE master.customer ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'MANUAL';

ALTER TABLE master.grade ADD COLUMN IF NOT EXISTS bc_id text;
ALTER TABLE master.grade ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'MANUAL';

ALTER TABLE master.stoppage_code ADD COLUMN IF NOT EXISTS bc_id text;
ALTER TABLE master.stoppage_code ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'MANUAL';

ALTER TABLE ops.queue_card ADD COLUMN IF NOT EXISTS bc_id text;
ALTER TABLE ops.queue_card ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'API';
ALTER TABLE ops.queue_card ADD COLUMN IF NOT EXISTS lot_no text;

ALTER TABLE txn.prod_tm_run ADD COLUMN IF NOT EXISTS bc_id text;
ALTER TABLE txn.prod_ann_run ADD COLUMN IF NOT EXISTS bc_id text;
ALTER TABLE txn.prod_stp_lot ADD COLUMN IF NOT EXISTS bc_id text;
ALTER TABLE txn.prod_db_lot ADD COLUMN IF NOT EXISTS bc_id text;

-- RLS
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'erp.sync_watermark',
    'erp.raw_landing',
    'erp.writeback_job',
    'erp.code_map',
    'erp.item_ledger',
    'erp.capacity_ledger',
    'erp.value_entry',
    'erp.released_order'
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

GRANT USAGE ON SCHEMA erp TO m1_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA erp TO m1_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA erp
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO m1_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA erp TO m1_app;

GRANT USAGE ON SCHEMA master, txn, plc, ops, erp TO m1_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA master, txn, plc, ops, erp TO m1_app;
