-- Demo seed for Netlify: badge/PIN logins, sample orders, light graph history.
-- Kept small so Netlify Database migration processing does not stall.
-- PIN for all users: 1234

DO $$
DECLARE
  tid uuid := '00000000-0000-4000-8000-000000000001';
  pin text := 'scrypt$b136b62a68b7480dbec1fea7c68e3be9$262ddfa489e5a9850eb5065e44971acccb4c81fc4338005642011abea35fdb2ed3dcf3e866f2ac19164f2a24805f1f9db1b4f069bd18b1eedcec052a0f979da0';
  uid uuid;
  v_run_id uuid;
  d int;
  day_ts timestamptz;
  u record;
BEGIN
  PERFORM set_config('app.tenant_id', tid::text, true);

  INSERT INTO security.role (role_code, label, rank) VALUES
    ('OPERATOR', 'Operator', 0),
    ('MACHINE_HEAD', 'Machine Head', 1),
    ('PLANT_HEAD', 'Plant Head', 2),
    ('ADMIN', 'Administrator', 3)
  ON CONFLICT (role_code) DO UPDATE SET label = EXCLUDED.label, rank = EXCLUDED.rank;

  INSERT INTO security.tenant (tenant_id, name)
  VALUES (tid, 'Goodluck A-59')
  ON CONFLICT (tenant_id) DO NOTHING;

  INSERT INTO master.machine (machine_code, tenant_id, label, process_code) VALUES
    ('STP-01', tid, 'STP-01', 'STP'),
    ('DB-10T', tid, 'Draw Bench 10T', 'DRW'),
    ('DB-20T', tid, 'Draw Bench 20T', 'DRW'),
    ('DB-40T', tid, 'Draw Bench 40T', 'DRW'),
    ('DB-45T', tid, 'Draw Bench 45T (3 tube)', 'DRW'),
    ('DB-80T', tid, 'Draw Bench 80T', 'DRW'),
    ('DB-120T', tid, 'Draw Bench 120T', 'DRW'),
    ('DB-180T', tid, 'Draw Bench 180T (LDP)', 'DRW'),
    ('DB-250T', tid, 'Draw Bench 250T (LDP)', 'DRW'),
    ('SWG-01', tid, 'Swage Machine 01', 'SWG')
  ON CONFLICT (machine_code) DO NOTHING;

  -- Core demo users only (operators for key machines)
  FOR u IN
    SELECT * FROM (VALUES
      ('admin', 'A-59 Admin', 'ADM-01', 'admin@a59.local', 'ADMIN', NULL::text, 'ALL'),
      ('planthead', 'Plant Head', 'PH-01', 'planthead@a59.local', 'PLANT_HEAD', NULL, 'ALL'),
      ('machinehead', 'Plant Machine Head', 'MH-01', 'machinehead@a59.local', 'MACHINE_HEAD', NULL, 'ALL'),
      ('mh.tm', 'Tube Mill Machine Head', 'MH-TM', 'mh.tm@a59.local', 'MACHINE_HEAD', 'TM', 'PROCESS'),
      ('mh.fur', 'Furnace Machine Head', 'MH-FUR', 'mh.fur@a59.local', 'MACHINE_HEAD', 'FUR', 'PROCESS'),
      ('mh.stp', 'STP Machine Head', 'MH-STP', 'mh.stp@a59.local', 'MACHINE_HEAD', 'STP', 'PROCESS'),
      ('mh.drw', 'Draw Bench Machine Head', 'MH-DRW', 'mh.drw@a59.local', 'MACHINE_HEAD', 'DRW', 'PROCESS'),
      ('mh.swg', 'Swage Machine Head', 'MH-SWG', 'mh.swg@a59.local', 'MACHINE_HEAD', 'SWG', 'PROCESS'),
      ('op.a59', 'A-59 Operator', 'OP-A59', 'op.a59@a59.local', 'OPERATOR', 'TM', 'A-59'),
      ('op.rhf03', 'RHF-03 Operator', 'OP-RHF03', 'op.rhf03@a59.local', 'OPERATOR', 'FUR', 'RHF-03'),
      ('op.stpline', 'STP Line Operator', 'OP-STPLINE', 'op.stpline@a59.local', 'OPERATOR', 'STP', 'STP-LINE'),
      ('op.db10t', 'DB-10T Operator', 'OP-DB10T', 'op.db10t@a59.local', 'OPERATOR', 'DRW', 'DB-10T'),
      ('op.db40t', 'DB-40T Operator', 'OP-DB40T', 'op.db40t@a59.local', 'OPERATOR', 'DRW', 'DB-40T'),
      ('op.swg01', 'SWG-01 Operator', 'OP-SWG01', 'op.swg01@a59.local', 'OPERATOR', 'SWG', 'SWG-01')
    ) AS t(username, full_name, emp_code, email, role_code, process_code, machine_mode)
  LOOP
    uid := NULL;
    INSERT INTO security.app_user (
      tenant_id, username, full_name, emp_code, email, pin_hash, status
    ) VALUES (tid, u.username, u.full_name, u.emp_code, u.email, pin, 'ACTIVE')
    ON CONFLICT (tenant_id, username) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      emp_code = EXCLUDED.emp_code,
      email = EXCLUDED.email,
      pin_hash = EXCLUDED.pin_hash,
      status = 'ACTIVE',
      updated_at = now()
    RETURNING user_id INTO uid;

    IF uid IS NULL THEN
      SELECT user_id INTO uid FROM security.app_user
      WHERE tenant_id = tid AND username = u.username;
    END IF;

    INSERT INTO security.user_role (user_id, role_code, tenant_id)
    VALUES (uid, u.role_code, tid)
    ON CONFLICT DO NOTHING;

    IF u.process_code IS NULL THEN
      INSERT INTO security.process_access (user_id, process_code, access_level, tenant_id)
      SELECT uid, p.code,
             CASE WHEN u.role_code IN ('ADMIN', 'MACHINE_HEAD') THEN 'APPROVE'
                  WHEN u.role_code = 'PLANT_HEAD' THEN 'READ'
                  ELSE 'WRITE' END,
             tid
      FROM master.process p WHERE p.tenant_id = tid
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO security.process_access (user_id, process_code, access_level, tenant_id)
      VALUES (
        uid, u.process_code,
        CASE WHEN u.role_code = 'MACHINE_HEAD' THEN 'APPROVE' ELSE 'WRITE' END,
        tid
      )
      ON CONFLICT DO NOTHING;
    END IF;

    IF u.machine_mode = 'ALL' THEN
      INSERT INTO security.machine_access (user_id, machine_code, access_level, tenant_id)
      SELECT uid, mm.machine_code, 'WRITE', tid
      FROM master.machine mm WHERE mm.tenant_id = tid
      ON CONFLICT DO NOTHING;
    ELSIF u.machine_mode = 'PROCESS' THEN
      INSERT INTO security.machine_access (user_id, machine_code, access_level, tenant_id)
      SELECT uid, mm.machine_code, 'WRITE', tid
      FROM master.machine mm
      WHERE mm.tenant_id = tid AND mm.process_code = u.process_code
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO security.machine_access (user_id, machine_code, access_level, tenant_id)
      VALUES (uid, u.machine_mode, 'WRITE', tid)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- One Released WO per process (enough for pickers; avoids N×machine inserts)
  INSERT INTO erp.released_order (
    tenant_id, bc_id, work_order_no, status, mill_code, customer_code, grade_code,
    lot_no, size, qty_pieces, planned_qty, source, payload, updated_at
  ) VALUES
    (tid, 'PO-DEMO-A-59', 'WO-DEMO-A-59', 'Released', 'A-59', 'TATA', '1010',
     'LOT-DEMO-A-59', '{"profile":"ROUND","odMm":38.1,"thkMm":2.0,"lengthMm":6000}'::jsonb,
     500, 5.0, 'SEED', '{}'::jsonb, now()),
    (tid, 'PO-DEMO-RHF-03', 'WO-DEMO-RHF-03', 'Released', 'RHF-03', 'TATA', '1010',
     'LOT-DEMO-RHF-03', '{"odMm":38.1,"thkMm":2.0}'::jsonb,
     200, 2.5, 'SEED', '{}'::jsonb, now()),
    (tid, 'PO-DEMO-STP-LINE', 'WO-DEMO-STP-LINE', 'Released', 'STP-LINE', 'JINDAL', '1010',
     'LOT-DEMO-STP', '{"odMm":38.1,"thkMm":2.0}'::jsonb,
     180, 2.0, 'SEED', '{}'::jsonb, now()),
    (tid, 'PO-DEMO-DB-40T', 'WO-DEMO-DB-40T', 'Released', 'DB-40T', 'AMNS', '1010',
     'LOT-DEMO-DB-40T', '{"odMm":31.8,"thkMm":1.6}'::jsonb,
     120, 1.5, 'SEED', '{}'::jsonb, now()),
    (tid, 'PO-DEMO-SWG-01', 'WO-DEMO-SWG-01', 'Released', 'SWG-01', 'TATA', '1010',
     'LOT-DEMO-SWG-01', '{"odMm":31.8,"thkMm":1.6}'::jsonb,
     80, 1.0, 'SEED', '{}'::jsonb, now())
  ON CONFLICT (tenant_id, work_order_no) DO UPDATE SET
    status = 'Released', mill_code = EXCLUDED.mill_code, updated_at = now();

  INSERT INTO ops.queue_card (
    id, tenant_id, mill_code, status, work_order_no, bc_batch_number,
    customer_code, grade_code, size_key, size, qty_pieces, source, lot_no
  ) VALUES (
    'qc-demo-a59', tid, 'A-59', 'Pending', 'WO-DEMO-A-59', 'BC-DEMO-A59',
    'TATA', '1010', 'OD38.1',
    '{"profile":"ROUND","odMm":38.1,"thkMm":2.0,"lengthMm":6000}'::jsonb,
    500, 'SEED', 'LOT-DEMO-A-59'
  )
  ON CONFLICT (id) DO UPDATE SET status = 'Pending', work_order_no = EXCLUDED.work_order_no;

  -- 7-day light graph series (TM + one FUR/STP/DRW per day)
  FOR d IN 0..6 LOOP
    day_ts := date_trunc('day', now() AT TIME ZONE 'UTC')
              - ((6 - d) || ' days')::interval
              + interval '10 hours';
    v_run_id := NULL;

    INSERT INTO txn.prod_tm_run (
      tenant_id, run_no, mill_code, work_order_no, bc_batch_number, customer_code, grade_code,
      size, size_key, source_tag, run_state, first_off_status, time_from, time_to,
      raw_material_mt, total_prime_mt, total_scrap_mt, yield_pct, status, hold_status,
      created_at, created_by
    )
    SELECT tid, 'TM-DEMO-D' || d, 'A-59', 'WO-DEMO-A-59', 'BC-DEMO-A59', 'TATA', '1010',
           '{"profile":"ROUND","odMm":38.1,"thkMm":2.0}'::jsonb, 'OD38.1', 'SEED',
           'COMPLETE', 'APPROVED', day_ts, day_ts + interval '6 hours',
           12.0 + d, 11.0 + d * 0.8, 0.4 + d * 0.05,
           round(((11.0 + d * 0.8) / (12.0 + d)) * 1000) / 10.0,
           'CLOSED', 'NONE', day_ts, 'seed'
    WHERE NOT EXISTS (
      SELECT 1 FROM txn.prod_tm_run r WHERE r.tenant_id = tid AND r.run_no = 'TM-DEMO-D' || d
    )
    RETURNING id INTO v_run_id;

    IF v_run_id IS NULL THEN
      SELECT id INTO v_run_id FROM txn.prod_tm_run
      WHERE tenant_id = tid AND run_no = 'TM-DEMO-D' || d;
    END IF;

    IF v_run_id IS NOT NULL THEN
      INSERT INTO txn.stoppage_entry (
        tenant_id, run_id, mill_code, stoppage_code, category, from_time, to_time,
        duration_min, reason, is_planned, is_open, process_code, source_id, created_at
      )
      SELECT tid, v_run_id, 'A-59', 'TM-0' || (1 + (d % 3)), 'MECH',
             day_ts + interval '2 hours', day_ts + interval '2 hours 20 minutes',
             20 + d, 'Demo stoppage day ' || d, false, false, 'TM', v_run_id, day_ts
      WHERE NOT EXISTS (
        SELECT 1 FROM txn.stoppage_entry s
        WHERE s.tenant_id = tid AND s.run_id = v_run_id AND s.reason = 'Demo stoppage day ' || d
      );

      INSERT INTO txn.tm_defect (
        tenant_id, run_id, defect_code, quantity_mt, pieces, remark, created_by, created_at
      )
      SELECT tid, v_run_id, 'D-SEAM', 0.05 + d * 0.01, 2 + d,
             'Demo defect day ' || d, 'seed', day_ts
      WHERE NOT EXISTS (
        SELECT 1 FROM txn.tm_defect x
        WHERE x.tenant_id = tid AND x.run_id = v_run_id AND x.remark = 'Demo defect day ' || d
      );
    END IF;

    INSERT INTO txn.prod_ann_run (
      tenant_id, charge_no, furnace_code, customer_code, grade_code, work_order_no, size,
      tube_count, ht_type, line_speed_mhr, total_mt, qty_mt, status, data_source,
      prod_date, shift_ref, created_at, updated_at,
      zone1_min_c, zone1_max_c, zone2_min_c, zone2_max_c, zone3_min_c, zone3_max_c,
      zone4_min_c, zone4_max_c, zone5_min_c, zone5_max_c, zone6_min_c, zone6_max_c
    )
    SELECT tid, 'FUR-DEMO-D' || d, 'RHF-03', 'TATA', '1010', 'WO-DEMO-RHF-03',
           '{"odMm":38.1,"thkMm":2.0}'::jsonb, 100 + d * 10, 'ANNEAL',
           20 + d, 3.5 + d * 0.4, 3.5 + d * 0.4,
           CASE WHEN d = 6 THEN 'SUBMITTED' ELSE 'CLOSED' END, 'SEED',
           day_ts::date, 'A', day_ts, day_ts,
           880, 900, 900, 920, 920, 940, 940, 960, 960, 980, 980, 1000
    WHERE NOT EXISTS (
      SELECT 1 FROM txn.prod_ann_run r
      WHERE r.tenant_id = tid AND r.charge_no = 'FUR-DEMO-D' || d
    );

    INSERT INTO txn.prod_stp_lot (
      tenant_id, lot_no, customer_code, grade_code, work_order_no, size, qty_no, qty_mt,
      machine_code, status, data_source, prod_date, shift_ref, created_at, updated_at
    )
    SELECT tid, 'STP-DEMO-D' || d, 'JINDAL', '1010', 'WO-DEMO-STP-LINE',
           '{"odMm":38.1,"thkMm":2.0}'::jsonb, 80 + d * 5, 1.1 + d * 0.15,
           'STP-LINE', CASE WHEN d = 6 THEN 'SUBMITTED' ELSE 'CLOSED' END, 'SEED',
           day_ts::date, 'A', day_ts, day_ts
    WHERE NOT EXISTS (
      SELECT 1 FROM txn.prod_stp_lot l WHERE l.tenant_id = tid AND l.lot_no = 'STP-DEMO-D' || d
    );

    INSERT INTO txn.prod_db_lot (
      tenant_id, lot_no, work_order_no, customer_code, grade_code, size, bench_code, draw_pass,
      accepted_pcs, rejected_pcs, accepted_mt, status, data_source, prod_date, shift_ref,
      created_at, updated_at
    )
    SELECT tid, 'DB-DEMO-D' || d, 'WO-DEMO-DB-40T', 'AMNS', '1010',
           '{"odMm":31.8,"thkMm":1.6}'::jsonb, 'DB-40T', '1ST',
           60 + d * 5, 1, 0.8 + d * 0.1,
           CASE WHEN d = 6 THEN 'SUBMITTED' ELSE 'CLOSED' END, 'SEED',
           day_ts::date, 'A', day_ts, day_ts
    WHERE NOT EXISTS (
      SELECT 1 FROM txn.prod_db_lot l WHERE l.tenant_id = tid AND l.lot_no = 'DB-DEMO-D' || d
    );
  END LOOP;

  INSERT INTO txn.prod_tm_run (
    tenant_id, run_no, mill_code, work_order_no, customer_code, grade_code,
    size, size_key, source_tag, run_state, status, hold_status, created_at, created_by,
    raw_material_mt, total_prime_mt
  )
  SELECT tid, 'TM-DEMO-OPEN', 'A-59', 'WO-DEMO-A-59', 'TATA', '1010',
         '{"profile":"ROUND","odMm":25.4,"thkMm":2.6}'::jsonb, 'OD25.4', 'SEED',
         'RUNNING', 'OPEN', 'NONE', now() - interval '90 minutes', 'seed', 2.0, 0
  WHERE NOT EXISTS (
    SELECT 1 FROM txn.prod_tm_run WHERE tenant_id = tid AND run_no = 'TM-DEMO-OPEN'
  );

  INSERT INTO txn.prod_ann_run (
    tenant_id, charge_no, furnace_code, customer_code, grade_code, work_order_no, size,
    tube_count, ht_type, line_speed_mhr, total_mt, status, data_source, prod_date, shift_ref,
    created_at, updated_at
  )
  SELECT tid, 'FUR-DEMO-LIVE', 'RHF-03', 'TATA', '1010', 'WO-DEMO-RHF-03',
         '{"odMm":38.1,"thkMm":2.0}'::jsonb, 90, 'ANNEAL', 21.5, 2.2, 'IN_PROGRESS', 'SEED',
         CURRENT_DATE, 'A', now() - interval '2 hours', now()
  WHERE NOT EXISTS (
    SELECT 1 FROM txn.prod_ann_run WHERE tenant_id = tid AND charge_no = 'FUR-DEMO-LIVE'
  );
END $$;
