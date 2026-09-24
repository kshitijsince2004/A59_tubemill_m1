-- Phase 1 reference data for Netlify (parity with local seed.ts)

DO $$
DECLARE
  tid uuid := '00000000-0000-4000-8000-000000000001';
BEGIN
  PERFORM set_config('app.tenant_id', tid::text, true);

  INSERT INTO master.process (code, tenant_id, label, sort_order) VALUES
    ('TM', tid, 'Tube Mill', 1),
    ('FUR', tid, 'Furnace', 2),
    ('STP', tid, 'STP', 3),
    ('DRW', tid, 'Draw Bench', 4),
    ('SWG', tid, 'Swaging', 5)
  ON CONFLICT (code) DO NOTHING;

  UPDATE master.machine SET process_code = 'TM' WHERE machine_code = 'A-59';

  INSERT INTO master.machine (machine_code, tenant_id, label, process_code) VALUES
    ('RHF-03', tid, 'RHF-03 Annealing', 'FUR'),
    ('RHF-04', tid, 'RHF-04 Annealing', 'FUR'),
    ('RHF-05', tid, 'RHF-05 Annealing', 'FUR'),
    ('STP-LINE', tid, 'STP Line 105A', 'STP'),
    ('DB-10T', tid, 'Draw Bench 10T', 'DRW'),
    ('DB-25T', tid, 'Draw Bench 25T', 'DRW'),
    ('DB-40T', tid, 'Draw Bench 40T', 'DRW'),
    ('DB-60T', tid, 'Draw Bench 60T', 'DRW'),
    ('DB-100T', tid, 'Draw Bench 100T', 'DRW'),
    ('DB-150T', tid, 'Draw Bench 150T', 'DRW'),
    ('DB-250T', tid, 'Draw Bench 250T', 'DRW'),
    ('SWG-01', tid, 'Swage Machine 01', 'SWG')
  ON CONFLICT (machine_code) DO NOTHING;

  INSERT INTO master.stoppage_code (code, tenant_id, label, category, is_planned) VALUES
    ('FUR-01', tid, 'Furnace burner fault (stub)', 'ELECT', false),
    ('FUR-02', tid, 'Atmosphere fault (stub)', 'OTHER', false),
    ('STP-01', tid, 'Crane stop (stub)', 'MECH', false),
    ('STP-02', tid, 'Bath chemistry hold (stub)', 'OTHER', false),
    ('DRW-01', tid, 'Die change (stub)', 'PLANNED', true),
    ('DRW-02', tid, 'Draw breakdown (stub)', 'MECH', false)
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO master.db_tooling (die_code, tenant_id, supplier, od_required_mm, received_at, status) VALUES
    ('DIE-38.1', tid, 'GLI Tooling', 38.1, CURRENT_DATE, 'ACTIVE'),
    ('DIE-31.8', tid, 'GLI Tooling', 31.8, CURRENT_DATE, 'ACTIVE'),
    ('DIE-25.4', tid, 'GLI Tooling', 25.4, CURRENT_DATE, 'ACTIVE')
  ON CONFLICT (die_code) DO NOTHING;

  INSERT INTO master.db_bench_capability (bench_code, tenant_id, tonnage_t, od_min_mm, od_max_mm, label) VALUES
    ('DB-10T', tid, 10, 12, 120, 'Draw Bench 10T'),
    ('DB-25T', tid, 25, 12, 120, 'Draw Bench 25T'),
    ('DB-40T', tid, 40, 12, 120, 'Draw Bench 40T'),
    ('DB-60T', tid, 60, 12, 120, 'Draw Bench 60T'),
    ('DB-100T', tid, 100, 12, 120, 'Draw Bench 100T'),
    ('DB-150T', tid, 150, 12, 120, 'Draw Bench 150T'),
    ('DB-250T', tid, 250, 12, 120, 'Draw Bench 250T')
  ON CONFLICT (bench_code) DO NOTHING;

  INSERT INTO master.stp_bath_spec (tenant_id, bath_code, bath_label, param_key, min_val, max_val, unit)
  SELECT tid, v.bath_code, v.bath_label, v.param_key, v.min_val, v.max_val, v.unit
  FROM (VALUES
    ('DEGREASE', 'Degrease', 'TA', 5::numeric, 15::numeric, 'pts'),
    ('PICKLE', 'Pickle', 'HCl', 8::numeric, 15::numeric, '%'),
    ('PHOS', 'Phosphate', 'TA', 20::numeric, 40::numeric, 'pts'),
    ('LUBE', 'Lube', 'FA', 1::numeric, 4::numeric, 'pts')
  ) AS v(bath_code, bath_label, param_key, min_val, max_val, unit)
  WHERE NOT EXISTS (
    SELECT 1 FROM master.stp_bath_spec s
    WHERE s.tenant_id = tid AND s.bath_code = v.bath_code AND s.param_key = v.param_key
  );

  INSERT INTO master.shift_check_template (tenant_id, process_code, check_key, label, sort_order)
  SELECT tid, 'DRW', v.check_key, v.label, v.sort_order
  FROM (VALUES
    ('clean', 'Machine clean', 1),
    ('die_plug', 'Die/plug OK', 2),
    ('lube', 'Lube OK', 3),
    ('pressure', 'Pressure OK', 4),
    ('noise', 'Noise OK', 5)
  ) AS v(check_key, label, sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM master.shift_check_template t
    WHERE t.tenant_id = tid AND t.process_code = 'DRW' AND t.check_key = v.check_key
  );

  INSERT INTO txn.prod_ann_run (
    tenant_id, charge_no, furnace_code, customer_code, grade_code, work_order_no, size,
    tube_count, ht_type, zone1_min_c, zone1_max_c, zone2_min_c, zone2_max_c,
    zone3_min_c, zone3_max_c, zone4_min_c, zone4_max_c, zone5_min_c, zone5_max_c,
    zone6_min_c, zone6_max_c, line_speed_mhr, status, data_source, prod_date, shift_ref
  )
  SELECT tid, 'ANN-DEMO-001', 'RHF-03', 'TATA', '1010', 'WO-FUR-001', '{"odMm":38.1,"thkMm":2.0}'::jsonb,
    120, 'ANNEAL', 880, 900, 900, 920, 920, 940, 940, 960, 960, 980, 980, 1000, 12.5,
    'DRAFT', 'MANUAL', CURRENT_DATE, 'A'
  WHERE NOT EXISTS (SELECT 1 FROM txn.prod_ann_run WHERE tenant_id = tid AND charge_no = 'ANN-DEMO-001');

  INSERT INTO txn.prod_stp_lot (
    tenant_id, lot_no, customer_code, grade_code, work_order_no, size, qty_no, qty_mt,
    machine_code, degrease_temp_c, phosphate_temp_c, status, data_source, prod_date, shift_ref
  )
  SELECT tid, 'STP-DEMO-001', 'TATA', '1010', 'WO-STP-001', '{"odMm":38.1,"thkMm":2.0}'::jsonb, 100, 1.2,
    'STP-LINE', 70, 80, 'DRAFT', 'MANUAL', CURRENT_DATE, 'A'
  WHERE NOT EXISTS (SELECT 1 FROM txn.prod_stp_lot WHERE tenant_id = tid AND lot_no = 'STP-DEMO-001');

  INSERT INTO txn.prod_db_lot (
    tenant_id, lot_no, work_order_no, customer_code, grade_code, size, bench_code, draw_pass,
    from_size, to_size, stage, accepted_pcs, rejected_pcs, status, data_source, prod_date, shift_ref
  )
  SELECT tid, 'DB-DEMO-001', 'WO-DRW-001', 'TATA', '1010', '{"odMm":31.8,"thkMm":1.6}'::jsonb, 'DB-60T', '1ST',
    '{"odMm":38.1,"thkMm":2.0}'::jsonb, '{"odMm":31.8,"thkMm":1.6}'::jsonb, 'INTER', 80, 2,
    'DRAFT', 'MANUAL', CURRENT_DATE, 'A'
  WHERE NOT EXISTS (SELECT 1 FROM txn.prod_db_lot WHERE tenant_id = tid AND lot_no = 'DB-DEMO-001');
END $$;
