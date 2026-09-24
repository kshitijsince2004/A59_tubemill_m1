-- Phase 1: four-process digitization (TM gap-fill + Furnace + STP + Draw Bench)
-- data_source, process registry, masters, capture tables, RLS

-- ---------------------------------------------------------------------------
-- Process registry + machine process_code
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS master.process (
  code text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE master.machine
  ADD COLUMN IF NOT EXISTS process_code text;

-- ---------------------------------------------------------------------------
-- data_source on TM run + TM gap columns
-- ---------------------------------------------------------------------------
ALTER TABLE txn.prod_tm_run
  ADD COLUMN IF NOT EXISTS data_source text NOT NULL DEFAULT 'MANUAL';
-- MANUAL | PLC | SCADA | SENSOR | API

ALTER TABLE txn.prod_tm_run
  ADD COLUMN IF NOT EXISTS prod_date date;

ALTER TABLE txn.tm_setup
  ADD COLUMN IF NOT EXISTS weld_flow_ok boolean,
  ADD COLUMN IF NOT EXISTS ect_calibrated boolean,
  ADD COLUMN IF NOT EXISTS coolant_conc_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS first_off_dims jsonb,
  ADD COLUMN IF NOT EXISTS first_off_form jsonb,
  ADD COLUMN IF NOT EXISTS weld_flow_surface_vangle text,
  ADD COLUMN IF NOT EXISTS fin_pass_dims jsonb;

ALTER TABLE txn.prod_tm_coil_input
  ADD COLUMN IF NOT EXISTS slit_hardness numeric(6,1),
  ADD COLUMN IF NOT EXISTS width_s_mm numeric(7,2),
  ADD COLUMN IF NOT EXISTS width_m_mm numeric(7,2),
  ADD COLUMN IF NOT EXISTS width_e_mm numeric(7,2),
  ADD COLUMN IF NOT EXISTS thk_s_mm numeric(6,3),
  ADD COLUMN IF NOT EXISTS thk_m_mm numeric(6,3),
  ADD COLUMN IF NOT EXISTS thk_e_mm numeric(6,3),
  ADD COLUMN IF NOT EXISTS rejection_remark text,
  ADD COLUMN IF NOT EXISTS work_order_no text;

CREATE TABLE IF NOT EXISTS txn.tm_online_inspection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES txn.prod_tm_run(id) ON DELETE CASCADE,
  lot_coil_ref text,
  od_mm numeric(8,3),
  thk_mm numeric(6,3),
  length_mm numeric(9,1),
  ovality_mm numeric(6,3),
  straightness_mm numeric(6,3),
  weld_bead_ok boolean,
  flattening_ok boolean,
  drifting_ok boolean,
  ut_ect_result text,
  surface_ok boolean,
  gauge_ok boolean,
  qa_class text,
  work_order_no text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE INDEX IF NOT EXISTS ix_tm_online_insp_run ON txn.tm_online_inspection(tenant_id, run_id);

-- ---------------------------------------------------------------------------
-- STP bath / draw masters
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS master.stp_bath_spec (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  bath_code text NOT NULL,
  bath_label text NOT NULL,
  param_key text NOT NULL,
  min_val numeric(12,4),
  max_val numeric(12,4),
  unit text,
  UNIQUE (tenant_id, bath_code, param_key)
);

CREATE TABLE IF NOT EXISTS master.db_tooling (
  die_code text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  supplier text,
  od_required_mm numeric(8,3),
  received_at date,
  status text NOT NULL DEFAULT 'ACTIVE',
  remarks text
);

CREATE TABLE IF NOT EXISTS master.db_bench_capability (
  bench_code text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  tonnage_t numeric(8,1) NOT NULL,
  od_min_mm numeric(8,2),
  od_max_mm numeric(8,2),
  label text NOT NULL
);

CREATE TABLE IF NOT EXISTS master.shift_check_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  process_code text NOT NULL,
  check_key text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, process_code, check_key)
);

-- ---------------------------------------------------------------------------
-- Furnace (ANN)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS txn.prod_ann_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  charge_no text NOT NULL,
  furnace_code text NOT NULL REFERENCES master.machine(machine_code),
  customer_code text REFERENCES master.customer(code),
  grade_code text REFERENCES master.grade(code),
  work_order_no text,
  size jsonb,
  tube_count integer,
  ht_type text,
  zone1_min_c numeric(7,1),
  zone1_max_c numeric(7,1),
  zone2_min_c numeric(7,1),
  zone2_max_c numeric(7,1),
  zone3_min_c numeric(7,1),
  zone3_max_c numeric(7,1),
  zone4_min_c numeric(7,1),
  zone4_max_c numeric(7,1),
  zone5_min_c numeric(7,1),
  zone5_max_c numeric(7,1),
  zone6_min_c numeric(7,1),
  zone6_max_c numeric(7,1),
  line_speed_mhr numeric(8,2),
  total_nos integer,
  total_mt numeric(12,3),
  png_consumption numeric(12,3),
  nh3_consumption numeric(12,3),
  batch_gap_ok boolean,
  disposition text,
  remarks text,
  shift_ref text,
  prod_date date,
  status text NOT NULL DEFAULT 'DRAFT',
  data_source text NOT NULL DEFAULT 'MANUAL',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_prod_ann_charge ON txn.prod_ann_run(tenant_id, charge_no);
CREATE INDEX IF NOT EXISTS ix_prod_ann_wo ON txn.prod_ann_run(tenant_id, work_order_no);
CREATE INDEX IF NOT EXISTS ix_prod_ann_status ON txn.prod_ann_run(tenant_id, status, prod_date);

CREATE TABLE IF NOT EXISTS txn.ann_gas_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES txn.prod_ann_run(id) ON DELETE CASCADE,
  logged_at timestamptz NOT NULL DEFAULT now(),
  gas_type text,
  gas_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  dew_point_c numeric(7,2),
  h2_pct numeric(6,2),
  o2_ppm numeric(10,2),
  changeover_time timestamptz,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_ann_gas_run ON txn.ann_gas_log(tenant_id, run_id);

-- ---------------------------------------------------------------------------
-- STP
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS txn.prod_stp_lot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lot_no text NOT NULL,
  customer_code text REFERENCES master.customer(code),
  grade_code text REFERENCES master.grade(code),
  work_order_no text,
  size jsonb,
  qty_no integer,
  qty_mt numeric(12,3),
  machine_code text REFERENCES master.machine(machine_code),
  degrease_temp_c numeric(7,1),
  degrease_time_min numeric(8,2),
  pickle_time_min numeric(8,2),
  phosphate_temp_c numeric(7,1),
  phosphate_time_min numeric(8,2),
  neutralizer_time_min numeric(8,2),
  lube_temp_c numeric(7,1),
  lube_time_min numeric(8,2),
  dryer_time_min numeric(8,2),
  reactive_oil_time_min numeric(8,2),
  surface_finish text,
  chem_addition text,
  breakdown_remark text,
  crane_state text,
  shift_ref text,
  prod_date date,
  status text NOT NULL DEFAULT 'DRAFT',
  data_source text NOT NULL DEFAULT 'MANUAL',
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_prod_stp_lot ON txn.prod_stp_lot(tenant_id, lot_no);
CREATE INDEX IF NOT EXISTS ix_prod_stp_wo ON txn.prod_stp_lot(tenant_id, work_order_no);
CREATE INDEX IF NOT EXISTS ix_prod_stp_status ON txn.prod_stp_lot(tenant_id, status, prod_date);

CREATE TABLE IF NOT EXISTS txn.stp_bath_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lot_id uuid NOT NULL REFERENCES txn.prod_stp_lot(id) ON DELETE CASCADE,
  sampled_at timestamptz NOT NULL DEFAULT now(),
  degrease_ta numeric(8,3),
  hcl_pct numeric(8,3),
  fe_pct numeric(8,3),
  activation_ph numeric(6,2),
  phos_ta numeric(8,3),
  phos_fa numeric(8,3),
  phos_acc numeric(8,3),
  phos_oxta numeric(8,3),
  neut_ph numeric(6,2),
  lube_con numeric(8,3),
  lube_fa numeric(8,3),
  lube_ph numeric(6,2),
  rinse_ph numeric(6,2),
  oil_water_acid_no numeric(8,3),
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_stp_bath_lot ON txn.stp_bath_analysis(tenant_id, lot_id);

CREATE TABLE IF NOT EXISTS txn.stp_coating (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lot_id uuid REFERENCES txn.prod_stp_lot(id) ON DELETE SET NULL,
  sample_date date NOT NULL DEFAULT CURRENT_DATE,
  coating_gm2 numeric(8,3),
  sample_no integer,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_stp_coating_lot ON txn.stp_coating(tenant_id, lot_id);

CREATE TABLE IF NOT EXISTS txn.stp_bath_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  bath_code text NOT NULL,
  planned_change_date date,
  executed_change_date date,
  planned_freq_days integer,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_stp_bath_hist ON txn.stp_bath_history(tenant_id, bath_code);

-- ---------------------------------------------------------------------------
-- Draw Bench
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS txn.prod_db_lot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lot_no text NOT NULL,
  work_order_no text,
  customer_code text REFERENCES master.customer(code),
  grade_code text REFERENCES master.grade(code),
  size jsonb,
  bench_code text NOT NULL REFERENCES master.machine(machine_code),
  draw_pass text NOT NULL DEFAULT '1ST',
  input_tube_ref text,
  operator_ref text,
  final_size jsonb,
  from_size jsonb,
  to_size jsonb,
  draw_plan_len_mm numeric(10,1),
  stage text,
  accepted_pcs integer,
  rejected_pcs integer,
  drawn_metre numeric(12,3),
  pull_load_t numeric(8,2),
  cycle_time_s numeric(10,2),
  breakdown_remark text,
  tag_no text,
  shift_ref text,
  prod_date date,
  status text NOT NULL DEFAULT 'DRAFT',
  data_source text NOT NULL DEFAULT 'MANUAL',
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_prod_db_lot ON txn.prod_db_lot(tenant_id, lot_no);
CREATE INDEX IF NOT EXISTS ix_prod_db_wo ON txn.prod_db_lot(tenant_id, work_order_no);
CREATE INDEX IF NOT EXISTS ix_prod_db_pass ON txn.prod_db_lot(tenant_id, work_order_no, draw_pass);
CREATE INDEX IF NOT EXISTS ix_prod_db_status ON txn.prod_db_lot(tenant_id, status, prod_date);

CREATE TABLE IF NOT EXISTS txn.db_shift_check (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lot_id uuid REFERENCES txn.prod_db_lot(id) ON DELETE CASCADE,
  bench_code text NOT NULL,
  check_date date NOT NULL DEFAULT CURRENT_DATE,
  shift_ref text,
  clean_ok boolean,
  die_plug_ok boolean,
  lube_ok boolean,
  pressure_ok boolean,
  input_lube_ok boolean,
  draw_speed_set numeric(8,2),
  noise_ok boolean,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE INDEX IF NOT EXISTS ix_db_shift_check ON txn.db_shift_check(tenant_id, bench_code, check_date);

CREATE TABLE IF NOT EXISTS txn.db_inspection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lot_id uuid NOT NULL REFERENCES txn.prod_db_lot(id) ON DELETE CASCADE,
  form_dev_mm numeric(8,3),
  surface_ra numeric(8,3),
  surface_ok boolean,
  first_off_ok boolean,
  last_off_ok boolean,
  refirstoff_ok boolean,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_db_insp_lot ON txn.db_inspection(tenant_id, lot_id);

CREATE TABLE IF NOT EXISTS txn.db_tooling_issue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lot_id uuid NOT NULL REFERENCES txn.prod_db_lot(id) ON DELETE CASCADE,
  issue_size text,
  die_code text REFERENCES master.db_tooling(die_code),
  stage text,
  die_size_mm numeric(8,3),
  actual_od_1stoff_mm numeric(8,3),
  die_condition text,
  plug_stage text,
  plug_size_mm numeric(8,3),
  plug_condition text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_db_tool_issue ON txn.db_tooling_issue(tenant_id, lot_id);

CREATE TABLE IF NOT EXISTS txn.db_tooling_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  die_code text NOT NULL REFERENCES master.db_tooling(die_code),
  lot_id uuid REFERENCES txn.prod_db_lot(id) ON DELETE SET NULL,
  use_date date NOT NULL DEFAULT CURRENT_DATE,
  prev_draw_od_mm numeric(8,3),
  tubes_produced integer,
  input_size jsonb,
  die_polish boolean,
  oversized boolean,
  disposition text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_db_tool_usage ON txn.db_tooling_usage(tenant_id, die_code);

CREATE TABLE IF NOT EXISTS txn.prod_db_swage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lot_no text NOT NULL,
  linked_db_lot_id uuid REFERENCES txn.prod_db_lot(id) ON DELETE SET NULL,
  swg_machine text,
  work_order_no text,
  customer_code text,
  grade_code text,
  size jsonb,
  swg_die text,
  draw_size jsonb,
  tag_len_mm numeric(10,1),
  len_after_die_mm numeric(10,1),
  pieces integer,
  tag_no text,
  shift_ref text,
  prod_date date,
  status text NOT NULL DEFAULT 'DRAFT',
  data_source text NOT NULL DEFAULT 'MANUAL',
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_prod_db_swage ON txn.prod_db_swage(tenant_id, lot_no);
CREATE INDEX IF NOT EXISTS ix_prod_db_swage_wo ON txn.prod_db_swage(tenant_id, work_order_no);

-- ---------------------------------------------------------------------------
-- RLS for new tables
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'master.process',
    'master.stp_bath_spec',
    'master.db_tooling',
    'master.db_bench_capability',
    'master.shift_check_template',
    'txn.tm_online_inspection',
    'txn.prod_ann_run',
    'txn.ann_gas_log',
    'txn.prod_stp_lot',
    'txn.stp_bath_analysis',
    'txn.stp_coating',
    'txn.stp_bath_history',
    'txn.prod_db_lot',
    'txn.db_shift_check',
    'txn.db_inspection',
    'txn.db_tooling_issue',
    'txn.db_tooling_usage',
    'txn.prod_db_swage'
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
    GRANT USAGE ON SCHEMA master, txn, plc, ops TO m1_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA master, txn, plc, ops TO m1_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA master, txn, plc, ops
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO m1_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA master, txn, plc, ops TO m1_app;
  END IF;
END $$;
