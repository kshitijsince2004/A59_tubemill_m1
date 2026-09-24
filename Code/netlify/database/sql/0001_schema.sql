-- Fresh-schema migration for Netlify Database (no m1_app role, no demo→ops rename).
-- Consolidates server/migrations 001–006 into a single bootstrap for managed Postgres.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS master;
CREATE SCHEMA IF NOT EXISTS txn;
CREATE SCHEMA IF NOT EXISTS plc;
CREATE SCHEMA IF NOT EXISTS ops;

CREATE TABLE IF NOT EXISTS master.machine (
  machine_code text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  label text NOT NULL,
  saw_type text,
  cutter_dia_min numeric(6,1),
  cutter_dia_max numeric(6,1)
);

CREATE TABLE IF NOT EXISTS master.grade (
  code text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  label text NOT NULL,
  density_kg_m3 numeric(8,2) DEFAULT 7850
);

CREATE TABLE IF NOT EXISTS master.customer (
  code text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS master.tm_param_chart (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  size_key text NOT NULL,
  thk_mm numeric(6,3) NOT NULL,
  grade_code text NOT NULL REFERENCES master.grade(code),
  power_kw_min numeric(7,2),
  power_kw_max numeric(7,2),
  speed_min_mpm numeric(7,2),
  speed_max_mpm numeric(7,2),
  id_tool text,
  od_tool text,
  boggie text,
  impeder text,
  ferrite_rod text,
  ss_rod text,
  work_coil_id text,
  fin_pass_dims jsonb,
  seam_guide text,
  weld_dia_mm numeric(6,2),
  v_length_norm text,
  effective_from date,
  version integer NOT NULL DEFAULT 1,
  is_active boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS ix_tm_param_chart_key
  ON master.tm_param_chart(tenant_id, size_key, thk_mm, grade_code, is_active);

CREATE TABLE IF NOT EXISTS master.stoppage_code (
  code text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  label text NOT NULL,
  category text NOT NULL,
  is_planned boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS master.tm_consumable (
  code text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  kind text NOT NULL,
  spec jsonb,
  replace_threshold_mt numeric(12,3),
  replace_threshold_uses integer,
  status text NOT NULL DEFAULT 'ACTIVE',
  cumulative_tonnage_mt numeric(12,3) DEFAULT 0,
  cumulative_uses integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS master.defect_code (
  code text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  label text NOT NULL,
  category text
);

CREATE TABLE IF NOT EXISTS txn.prod_tm_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_no text NOT NULL,
  mill_code text NOT NULL REFERENCES master.machine(machine_code),
  work_order_no text,
  bc_batch_number text,
  customer_code text REFERENCES master.customer(code),
  grade_code text REFERENCES master.grade(code),
  size jsonb NOT NULL,
  size_key text NOT NULL,
  source_tag text NOT NULL DEFAULT 'PLAN',
  setup_id uuid,
  run_state text NOT NULL DEFAULT 'SETUP',
  first_off_status text NOT NULL DEFAULT 'PENDING',
  first_off_by text,
  first_off_at timestamptz,
  shift_open_ref text,
  shift_close_ref text,
  time_from timestamptz,
  time_to timestamptz,
  gross_runtime_s integer,
  net_runtime_s integer,
  raw_material_mt numeric(12,3) DEFAULT 0,
  total_prime_mt numeric(12,3) DEFAULT 0,
  total_pq2_mt numeric(12,3) DEFAULT 0,
  total_cq_mt numeric(12,3) DEFAULT 0,
  total_open_mt numeric(12,3) DEFAULT 0,
  total_scrap_mt numeric(12,3) DEFAULT 0,
  yield_pct numeric(6,3),
  status text NOT NULL DEFAULT 'DRAFT',
  crew_ref uuid,
  remarks text,
  hold_status text NOT NULL DEFAULT 'NONE',
  remarks_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_prod_tm_run_no ON txn.prod_tm_run(tenant_id, run_no);
CREATE INDEX IF NOT EXISTS ix_prod_tm_run_mill_state ON txn.prod_tm_run(tenant_id, mill_code, run_state);

CREATE TABLE IF NOT EXISTS txn.tm_setup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES txn.prod_tm_run(id) ON DELETE CASCADE,
  setup_type text NOT NULL,
  reason text,
  id_tool text,
  od_tool text,
  boggie_size text,
  impeder_size text,
  ferrite_rod text,
  ss_rod text,
  work_coil_id text,
  fin_blade text,
  seam_guide text,
  v_length_mm numeric(6,2),
  v_gap_mm numeric(6,2),
  wc_to_wr_distance_mm numeric(6,1),
  weld_dia_mm numeric(6,2),
  argon_used boolean,
  first_off_result text,
  approved_by text,
  approved_at timestamptz,
  is_4m_change boolean DEFAULT false,
  m4_category text,
  validation_ref text,
  customer_approval boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_tm_setup_run ON txn.tm_setup(tenant_id, run_id);

ALTER TABLE txn.prod_tm_run
  DROP CONSTRAINT IF EXISTS fk_prod_tm_run_setup;
ALTER TABLE txn.prod_tm_run
  ADD CONSTRAINT fk_prod_tm_run_setup FOREIGN KEY (setup_id) REFERENCES txn.tm_setup(id);

CREATE TABLE IF NOT EXISTS txn.prod_tm_coil_input (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES txn.prod_tm_run(id) ON DELETE CASCADE,
  coil_tag text NOT NULL,
  grade_code text REFERENCES master.grade(code),
  width_mm numeric(7,2),
  thk_mm numeric(6,3),
  swg text,
  source text,
  input_weight_kg numeric(10,2),
  splice_seq integer,
  joint_marker boolean DEFAULT false,
  arcweld_log_id uuid,
  edgemill_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_tm_coil_input_run ON txn.prod_tm_coil_input(tenant_id, run_id);

CREATE TABLE IF NOT EXISTS txn.prod_tm_bundle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES txn.prod_tm_run(id) ON DELETE CASCADE,
  bundle_no integer NOT NULL,
  tag_no text,
  pieces integer NOT NULL DEFAULT 0,
  length_mm numeric(9,1),
  weight_kg numeric(10,2),
  weight_source text NOT NULL DEFAULT 'DERIVED',
  quality_class text NOT NULL,
  pq2_reason text,
  needs_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_tm_bundle ON txn.prod_tm_bundle(tenant_id, run_id, bundle_no);

CREATE TABLE IF NOT EXISTS txn.prod_tm_param_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES txn.prod_tm_run(id) ON DELETE CASCADE,
  ts_hour timestamptz NOT NULL,
  line_speed_mpm numeric(7,2),
  weld_power_kw numeric(7,2),
  weld_current_amp numeric(8,1),
  coolant_pressure_kg numeric(5,2),
  coolant_oil_pct numeric(4,1),
  wiper_change boolean,
  argon_used boolean,
  in_band boolean,
  remarks text,
  sign_ref text,
  source text NOT NULL DEFAULT 'AUTO'
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_tm_param_snapshot
  ON txn.prod_tm_param_snapshot(tenant_id, run_id, ts_hour);

CREATE TABLE IF NOT EXISTS txn.stoppage_entry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid REFERENCES txn.prod_tm_run(id) ON DELETE CASCADE,
  mill_code text,
  stoppage_code text REFERENCES master.stoppage_code(code),
  category text,
  from_time timestamptz NOT NULL,
  to_time timestamptz,
  duration_min numeric(8,2),
  reason text,
  remark text,
  is_planned boolean DEFAULT false,
  is_open boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_stoppage_run ON txn.stoppage_entry(tenant_id, run_id);

CREATE TABLE IF NOT EXISTS plc.tag (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  mill_code text NOT NULL,
  controller text,
  signal text NOT NULL,
  unit text,
  subnet text,
  driver text
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_plc_tag_mill_signal
  ON plc.tag(tenant_id, mill_code, signal);

CREATE TABLE IF NOT EXISTS plc.sample (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL REFERENCES plc.tag(id),
  tenant_id uuid NOT NULL,
  run_id uuid,
  ts timestamptz NOT NULL DEFAULT now(),
  value double precision NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_plc_sample_tag_ts ON plc.sample(tag_id, ts DESC);
CREATE INDEX IF NOT EXISTS ix_plc_sample_run_ts ON plc.sample(run_id, ts DESC);

CREATE TABLE IF NOT EXISTS plc.collector_health (
  mill_code text NOT NULL,
  tag_id uuid,
  last_sample_at timestamptz,
  backlog integer DEFAULT 0,
  heartbeat_at timestamptz,
  PRIMARY KEY (mill_code)
);

CREATE TABLE IF NOT EXISTS txn.idempotency_key (
  key text NOT NULL,
  scope text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key)
);

CREATE TABLE IF NOT EXISTS txn.tm_exception (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES txn.prod_tm_run(id) ON DELETE CASCADE,
  mill_code text NOT NULL,
  kind text NOT NULL DEFAULT 'OUT_OF_BAND',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  is_open boolean NOT NULL DEFAULT true,
  power_kw numeric(7,2),
  speed_mpm numeric(7,2),
  detail jsonb
);

CREATE INDEX IF NOT EXISTS ix_tm_exception_run_open
  ON txn.tm_exception(tenant_id, run_id, is_open);

CREATE TABLE IF NOT EXISTS txn.tm_consumable_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  consumable_code text NOT NULL REFERENCES master.tm_consumable(code),
  run_id uuid REFERENCES txn.prod_tm_run(id),
  cumulative_tonnage_mt numeric(12,3),
  cumulative_uses integer,
  delta_tonnage_mt numeric(12,3),
  visual_inspection text,
  action text,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_tm_consumable_usage_code
  ON txn.tm_consumable_usage(tenant_id, consumable_code);

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

ALTER TABLE txn.prod_tm_coil_input
  DROP CONSTRAINT IF EXISTS prod_tm_coil_input_arcweld_log_id_fkey;
ALTER TABLE txn.prod_tm_coil_input
  DROP CONSTRAINT IF EXISTS prod_tm_coil_input_edgemill_id_fkey;
ALTER TABLE txn.prod_tm_coil_input
  ADD CONSTRAINT prod_tm_coil_input_arcweld_log_id_fkey
  FOREIGN KEY (arcweld_log_id) REFERENCES txn.tm_arcweld_log(id);
ALTER TABLE txn.prod_tm_coil_input
  ADD CONSTRAINT prod_tm_coil_input_edgemill_id_fkey
  FOREIGN KEY (edgemill_id) REFERENCES txn.prod_tm_edgemill(id);

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

CREATE TABLE IF NOT EXISTS ops.queue_card (
  id text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  mill_code text NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  work_order_no text NOT NULL,
  bc_batch_number text NOT NULL,
  customer_code text NOT NULL,
  grade_code text NOT NULL,
  size_key text NOT NULL,
  size jsonb NOT NULL,
  qty_pieces integer,
  run_id uuid REFERENCES txn.prod_tm_run(id)
);

CREATE TABLE IF NOT EXISTS ops.bc_writeback_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid REFERENCES txn.prod_tm_run(id),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'LOGGED',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Soft FK for work_coil when consumable exists (applied after seed in practice)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tm_setup_work_coil' AND table_schema = 'txn'
  ) THEN
    ALTER TABLE txn.tm_setup
      ADD CONSTRAINT fk_tm_setup_work_coil
      FOREIGN KEY (work_coil_id) REFERENCES master.tm_consumable(code);
  END IF;
EXCEPTION
  WHEN others THEN
    NULL; -- leave as free text if orphan values would block
END $$;

-- Row-level security (FORCE) — app must set app.tenant_id inside a transaction
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'txn.prod_tm_run',
    'txn.tm_setup',
    'txn.prod_tm_coil_input',
    'txn.prod_tm_bundle',
    'txn.stoppage_entry',
    'txn.tm_exception',
    'txn.prod_tm_param_snapshot',
    'txn.tm_consumable_usage',
    'txn.tm_shift_log',
    'txn.tm_arcweld_log',
    'txn.prod_tm_edgemill',
    'txn.tm_defect',
    'txn.tm_setup_override_log',
    'master.tm_param_chart',
    'master.tm_consumable',
    'master.stoppage_code',
    'master.machine',
    'master.grade',
    'master.customer',
    'master.defect_code',
    'plc.sample',
    'plc.tag',
    'ops.queue_card',
    'ops.bc_writeback_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %s', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %s
         USING (tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))
         WITH CHECK (tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))',
      t
    );
  END LOOP;
END $$;
