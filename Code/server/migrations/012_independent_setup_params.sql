-- Independent machine-scoped Parameters (TM-04) and Setup (TM-05).
-- No run_id / work-order FK — mill_code (+ hour / sheet) is the lifecycle key.

-- ---------------------------------------------------------------------------
-- Parameters — txn.tm_param_reading (AUTO + MANUAL only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS txn.tm_param_reading (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  mill_code text NOT NULL DEFAULT 'A-59',
  prod_date date,
  shift_ref text,
  ts_hour timestamptz NOT NULL,
  -- AUTO
  line_speed_mpm numeric(7,2),
  weld_power_kw numeric(7,2),
  weld_current_amp numeric(8,1),
  in_band boolean,
  -- MANUAL
  coolant_oil_pct numeric(4,1),
  coolant_pressure_kg numeric(5,2),
  wiper_change boolean,
  argon_used boolean,
  remarks text,
  sign_ref text,
  source text NOT NULL DEFAULT 'AUTO',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_tm_param_reading_mill_hour
  ON txn.tm_param_reading(tenant_id, mill_code, ts_hour);

CREATE INDEX IF NOT EXISTS ix_tm_param_reading_mill
  ON txn.tm_param_reading(tenant_id, mill_code, ts_hour DESC);

ALTER TABLE txn.tm_param_reading ENABLE ROW LEVEL SECURITY;
ALTER TABLE txn.tm_param_reading FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON txn.tm_param_reading;
CREATE POLICY tenant_isolation ON txn.tm_param_reading
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

-- ---------------------------------------------------------------------------
-- Setup — txn.tm_mill_setup (independent TM-05 sheets)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS txn.tm_mill_setup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  mill_code text NOT NULL DEFAULT 'A-59',
  setup_type text NOT NULL DEFAULT 'INITIAL',
  reason text,
  size_key text,
  grade_code text,
  thk_mm numeric(6,3),
  note text,
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
  weld_flow_ok boolean,
  ect_calibrated boolean,
  coolant_conc_pct numeric(5,2),
  first_off_dims jsonb,
  first_off_form jsonb,
  weld_flow_surface_vangle text,
  fin_pass_dims jsonb,
  slit_thk_mm numeric(6,3),
  slit_width_mm numeric(7,2),
  roll_set text,
  coolant_pressure_kg numeric(5,2),
  wiper_used boolean,
  speed_mpm_obs numeric(7,2),
  power_kw_obs numeric(7,2),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_tm_mill_setup_mill
  ON txn.tm_mill_setup(tenant_id, mill_code, created_at DESC);

ALTER TABLE txn.tm_mill_setup ENABLE ROW LEVEL SECURITY;
ALTER TABLE txn.tm_mill_setup FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON txn.tm_mill_setup;
CREATE POLICY tenant_isolation ON txn.tm_mill_setup
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));
