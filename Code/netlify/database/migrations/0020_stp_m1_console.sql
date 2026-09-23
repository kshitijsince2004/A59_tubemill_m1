-- STP M1 console: WO lines, production clock, disposition, chemical additions

CREATE TABLE IF NOT EXISTS erp.released_order_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  work_order_no text NOT NULL,
  line_no integer NOT NULL,
  customer_code text,
  grade_code text,
  lot_no text,
  coil_no text,
  tdc text,
  pass_no integer,
  size jsonb NOT NULL DEFAULT '{}'::jsonb,
  qty_pieces integer,
  planned_qty numeric(14,3),
  final_size jsonb NOT NULL DEFAULT '{}'::jsonb,
  tube_shape text,
  next_process text,
  remarks text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, work_order_no, line_no)
);

CREATE INDEX IF NOT EXISTS ix_erp_rel_order_line_wo
  ON erp.released_order_line (tenant_id, work_order_no);

ALTER TABLE txn.prod_stp_lot
  ADD COLUMN IF NOT EXISTS work_order_line_no integer,
  ADD COLUMN IF NOT EXISTS production_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS production_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS disposition text;

CREATE TABLE IF NOT EXISTS txn.stp_chemical_addition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lot_id uuid NOT NULL REFERENCES txn.prod_stp_lot(id) ON DELETE CASCADE,
  bath_code text NOT NULL,
  chemical text NOT NULL,
  quantity numeric(12,3),
  unit text,
  batch_ref text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE INDEX IF NOT EXISTS ix_stp_chem_lot ON txn.stp_chemical_addition(tenant_id, lot_id);

INSERT INTO erp.released_order (
  tenant_id, bc_id, work_order_no, status, mill_code, customer_code, grade_code, lot_no, size, qty_pieces, planned_qty, source
)
SELECT
  t.tenant_id,
  'PO-26081750',
  '26081750',
  'Released',
  'A-59',
  'MARMON',
  '1020',
  '01-2608B-0290',
  '{"profile":"ROUND","odMm":50.8,"thkMm":3.6,"lengthMm":4900,"slitWidthMm":155}'::jsonb,
  105,
  2.134,
  'SEED'
FROM (SELECT DISTINCT tenant_id FROM erp.released_order LIMIT 1) t
WHERE NOT EXISTS (
  SELECT 1 FROM erp.released_order r WHERE r.work_order_no = '26081750' AND r.tenant_id = t.tenant_id
);

INSERT INTO erp.released_order_line (
  tenant_id, work_order_no, line_no, customer_code, grade_code, lot_no, coil_no, tdc, pass_no,
  size, qty_pieces, planned_qty, final_size, tube_shape, next_process, remarks
)
SELECT
  t.tenant_id,
  '26081750',
  1,
  'MARMON',
  '1020',
  '01-2608B-0290',
  '01-2608B-0290',
  'TDC-23899',
  1,
  '{"profile":"ROUND","odMm":50.8,"thkMm":3.6,"lengthMm":4900,"slitWidthMm":155}'::jsonb,
  105,
  2.134,
  '{"odMm":44.45,"idMm":38.354,"thkMm":3.048,"lengthMm":6096}'::jsonb,
  'ROUND',
  'HANL, STPS, SWAG',
  'Line 1 — STP M1 demo'
FROM (SELECT DISTINCT tenant_id FROM erp.released_order LIMIT 1) t
WHERE NOT EXISTS (
  SELECT 1 FROM erp.released_order_line l
  WHERE l.work_order_no = '26081750' AND l.line_no = 1 AND l.tenant_id = t.tenant_id
);

INSERT INTO erp.released_order_line (
  tenant_id, work_order_no, line_no, customer_code, grade_code, lot_no, coil_no, tdc, pass_no,
  size, qty_pieces, planned_qty, final_size, tube_shape, next_process, remarks
)
SELECT
  t.tenant_id,
  '26081750',
  2,
  'MARMON',
  '1020',
  '01-2608B-0291',
  '01-2608B-0291',
  'TDC-23900',
  1,
  '{"profile":"ROUND","odMm":38.1,"thkMm":2.5,"lengthMm":6000,"slitWidthMm":120}'::jsonb,
  80,
  1.5,
  '{"odMm":31.8,"idMm":26.8,"thkMm":2.5,"lengthMm":6000}'::jsonb,
  'ROUND',
  'HANL, STPS',
  'Line 2 — STP M1 demo'
FROM (SELECT DISTINCT tenant_id FROM erp.released_order LIMIT 1) t
WHERE NOT EXISTS (
  SELECT 1 FROM erp.released_order_line l
  WHERE l.work_order_no = '26081750' AND l.line_no = 2 AND l.tenant_id = t.tenant_id
);
