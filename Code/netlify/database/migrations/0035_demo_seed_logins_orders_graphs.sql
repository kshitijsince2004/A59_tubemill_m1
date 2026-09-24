-- Demo seed for Netlify: badge/PIN logins, per-machine orders, and graph history.
-- Idempotent. PIN for all users: 1234 (scrypt hash below).

DO $$
DECLARE
  tid uuid := '00000000-0000-4000-8000-000000000001';
  pin text := 'scrypt$b136b62a68b7480dbec1fea7c68e3be9$262ddfa489e5a9850eb5065e44971acccb4c81fc4338005642011abea35fdb2ed3dcf3e866f2ac19164f2a24805f1f9db1b4f069bd18b1eedcec052a0f979da0';
  uid uuid;
  run_id uuid;
  m record;
  furnace_code text;
  bench_code text;
  d int;
  day_ts timestamptz;
  customers text[] := ARRAY['TATA','JINDAL','AMNS'];
  stop_codes text[] := ARRAY['TM-01','TM-02','TM-03','TM-06','FUR-01','STP-01','DRW-01'];
  defect_codes text[] := ARRAY['D-JOINT','D-SEAM','D-DIM','D-SCRAP'];
  benches text[] := ARRAY['DB-10T','DB-20T','DB-40T','DB-45T','DB-80T','DB-120T','DB-180T','DB-250T'];
  furnaces text[] := ARRAY['RHF-03','RHF-04','RHF-05'];
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

  -- Ensure STP-01 exists for OP-STP01 + MH scope
  INSERT INTO master.machine (machine_code, tenant_id, label, process_code)
  VALUES ('STP-01', tid, 'STP-01', 'STP')
  ON CONFLICT (machine_code) DO UPDATE SET process_code = 'STP', label = COALESCE(master.machine.label, EXCLUDED.label);

  -- Ensure workbook benches exist (0023 may have inserted; safe upsert)
  INSERT INTO master.machine (machine_code, tenant_id, label, process_code) VALUES
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

  -- -------------------------------------------------------------------------
  -- Demo users (badge = emp_code, PIN 1234)
  -- -------------------------------------------------------------------------
  CREATE TEMP TABLE IF NOT EXISTS _demo_users (
    username text PRIMARY KEY,
    full_name text,
    emp_code text,
    email text,
    role_code text,
    process_code text,   -- NULL = all processes
    machine_mode text    -- ALL | PROCESS | SINGLE
  ) ON COMMIT DROP;

  DELETE FROM _demo_users;
  INSERT INTO _demo_users (username, full_name, emp_code, email, role_code, process_code, machine_mode) VALUES
    ('admin', 'A-59 Admin', 'ADM-01', 'admin@a59.local', 'ADMIN', NULL, 'ALL'),
    ('planthead', 'Plant Head', 'PH-01', 'planthead@a59.local', 'PLANT_HEAD', NULL, 'ALL'),
    ('machinehead', 'Plant Machine Head', 'MH-01', 'machinehead@a59.local', 'MACHINE_HEAD', NULL, 'ALL'),
    ('mh.tm', 'Tube Mill Machine Head', 'MH-TM', 'mh.tm@a59.local', 'MACHINE_HEAD', 'TM', 'PROCESS'),
    ('mh.fur', 'Furnace Machine Head', 'MH-FUR', 'mh.fur@a59.local', 'MACHINE_HEAD', 'FUR', 'PROCESS'),
    ('mh.stp', 'STP Machine Head', 'MH-STP', 'mh.stp@a59.local', 'MACHINE_HEAD', 'STP', 'PROCESS'),
    ('mh.drw', 'Draw Bench Machine Head', 'MH-DRW', 'mh.drw@a59.local', 'MACHINE_HEAD', 'DRW', 'PROCESS'),
    ('mh.swg', 'Swage Machine Head', 'MH-SWG', 'mh.swg@a59.local', 'MACHINE_HEAD', 'SWG', 'PROCESS');

  FOR m IN
    SELECT machine_code, process_code, label,
           upper(regexp_replace(machine_code, '[^A-Za-z0-9]', '', 'g')) AS slug
    FROM master.machine WHERE tenant_id = tid
  LOOP
    INSERT INTO _demo_users (username, full_name, emp_code, email, role_code, process_code, machine_mode)
    VALUES (
      'op.' || lower(m.slug),
      COALESCE(m.label, m.machine_code) || ' Operator',
      'OP-' || m.slug,
      'op.' || lower(m.slug) || '@a59.local',
      'OPERATOR',
      m.process_code,
      'SINGLE'
    )
    ON CONFLICT (username) DO NOTHING;
  END LOOP;

  FOR m IN SELECT * FROM _demo_users LOOP
    uid := NULL;
    INSERT INTO security.app_user (
      tenant_id, username, full_name, emp_code, email, pin_hash, status
    ) VALUES (tid, m.username, m.full_name, m.emp_code, m.email, pin, 'ACTIVE')
    ON CONFLICT (tenant_id, username) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      emp_code = EXCLUDED.emp_code,
      email = EXCLUDED.email,
      pin_hash = EXCLUDED.pin_hash,
      status = 'ACTIVE',
      updated_at = now()
    RETURNING user_id INTO uid;

    IF uid IS NULL THEN
      SELECT user_id INTO uid FROM security.app_user WHERE tenant_id = tid AND username = m.username;
    END IF;

    INSERT INTO security.user_role (user_id, role_code, tenant_id)
    VALUES (uid, m.role_code, tid)
    ON CONFLICT DO NOTHING;

    IF m.process_code IS NULL THEN
      INSERT INTO security.process_access (user_id, process_code, access_level, tenant_id)
      SELECT uid, p.code,
             CASE WHEN m.role_code IN ('ADMIN','MACHINE_HEAD') THEN 'APPROVE'
                  WHEN m.role_code = 'PLANT_HEAD' THEN 'READ'
                  ELSE 'WRITE' END,
             tid
      FROM master.process p WHERE p.tenant_id = tid
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO security.process_access (user_id, process_code, access_level, tenant_id)
      VALUES (
        uid, m.process_code,
        CASE WHEN m.role_code = 'MACHINE_HEAD' THEN 'APPROVE' ELSE 'WRITE' END,
        tid
      )
      ON CONFLICT DO NOTHING;
    END IF;

    IF m.machine_mode = 'ALL' THEN
      INSERT INTO security.machine_access (user_id, machine_code, access_level, tenant_id)
      SELECT uid, mm.machine_code, 'WRITE', tid
      FROM master.machine mm WHERE mm.tenant_id = tid
      ON CONFLICT DO NOTHING;
    ELSIF m.machine_mode = 'PROCESS' THEN
      INSERT INTO security.machine_access (user_id, machine_code, access_level, tenant_id)
      SELECT uid, mm.machine_code, 'WRITE', tid
      FROM master.machine mm WHERE mm.tenant_id = tid AND mm.process_code = m.process_code
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO security.machine_access (user_id, machine_code, access_level, tenant_id)
      SELECT uid, mm.machine_code, 'WRITE', tid
      FROM master.machine mm
      WHERE mm.tenant_id = tid
        AND upper(regexp_replace(mm.machine_code, '[^A-Za-z0-9]', '', 'g')) =
            replace(m.emp_code, 'OP-', '')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Soft crew roster for login capture / MH pages
  IF to_regclass('master.machine_crew_roster') IS NOT NULL THEN
    FOR m IN SELECT machine_code, label FROM master.machine WHERE tenant_id = tid LOOP
      IF NOT EXISTS (
        SELECT 1 FROM master.machine_crew_roster r
        WHERE r.tenant_id = tid AND r.machine_code = m.machine_code AND r.role_label = 'Operator'
      ) THEN
        INSERT INTO master.machine_crew_roster (
          tenant_id, machine_code, role_label, person_name, shift_code, is_active
        ) VALUES
          (tid, m.machine_code, 'Operator', COALESCE(m.label, m.machine_code) || ' Op', 'A', true),
          (tid, m.machine_code, 'Helper', COALESCE(m.label, m.machine_code) || ' Helper', 'A', true);
      END IF;
    END LOOP;
  END IF;

  -- -------------------------------------------------------------------------
  -- Demo Released WO per machine (pickers + backlog KPIs)
  -- -------------------------------------------------------------------------
  FOR m IN SELECT machine_code, process_code, label FROM master.machine WHERE tenant_id = tid LOOP
    INSERT INTO erp.released_order (
      tenant_id, bc_id, work_order_no, status, mill_code, customer_code, grade_code,
      lot_no, size, qty_pieces, planned_qty, source, payload, updated_at
    ) VALUES (
      tid,
      'PO-DEMO-' || m.machine_code,
      'WO-DEMO-' || m.machine_code,
      'Released',
      m.machine_code,
      customers[1 + (abs(hashtext(m.machine_code)) % 3)],
      '1010',
      'LOT-DEMO-' || m.machine_code,
      '{"profile":"ROUND","odMm":38.1,"equivOdMm":38.1,"thkMm":2.0,"lengthMm":6000}'::jsonb,
      200 + (abs(hashtext(m.machine_code)) % 800),
      2.5 + (abs(hashtext(m.machine_code)) % 10)::numeric / 2,
      'SEED',
      jsonb_build_object('machine', m.machine_code, 'process', m.process_code, 'label', m.label),
      now()
    )
    ON CONFLICT (tenant_id, work_order_no) DO UPDATE SET
      status = 'Released',
      mill_code = EXCLUDED.mill_code,
      updated_at = now();

    IF to_regclass('erp.released_order_line') IS NOT NULL THEN
      INSERT INTO erp.released_order_line (
        tenant_id, work_order_no, line_no, customer_code, grade_code, lot_no, coil_no,
        size, qty_pieces, planned_qty, tube_shape, remarks, payload
      )
      SELECT tid, 'WO-DEMO-' || m.machine_code, 1,
             customers[1], '1010', 'LOT-DEMO-' || m.machine_code, 'COIL-DEMO-' || m.machine_code,
             '{"profile":"ROUND","odMm":38.1,"thkMm":2.0,"lengthMm":6000}'::jsonb,
             200, 2.5, 'ROUND', 'Demo line for ' || m.machine_code,
             '{}'::jsonb
      WHERE NOT EXISTS (
        SELECT 1 FROM erp.released_order_line l
        WHERE l.tenant_id = tid AND l.work_order_no = 'WO-DEMO-' || m.machine_code AND l.line_no = 1
      );
    END IF;
  END LOOP;

  -- TM queue cards for A-59 demo WO
  INSERT INTO ops.queue_card (
    id, tenant_id, mill_code, status, work_order_no, bc_batch_number,
    customer_code, grade_code, size_key, size, qty_pieces, source, lot_no
  ) VALUES (
    'qc-demo-a59', tid, 'A-59', 'Pending', 'WO-DEMO-A-59', 'BC-DEMO-A59',
    'TATA', '1010', 'OD38.1',
    '{"profile":"ROUND","odMm":38.1,"equivOdMm":38.1,"thkMm":2.0,"lengthMm":6000}'::jsonb,
    500, 'SEED', 'LOT-DEMO-A-59'
  )
  ON CONFLICT (id) DO UPDATE SET status = 'Pending', work_order_no = EXCLUDED.work_order_no;

  -- -------------------------------------------------------------------------
  -- Graph history: 7 days TM / FUR / STP / DRW + stoppages + defects
  -- -------------------------------------------------------------------------
  FOR d IN 0..6 LOOP
    day_ts := date_trunc('day', now() AT TIME ZONE 'UTC') - ((6 - d) || ' days')::interval + interval '10 hours';

    -- Tube Mill completed run each day
    INSERT INTO txn.prod_tm_run (
      tenant_id, run_no, mill_code, work_order_no, bc_batch_number, customer_code, grade_code,
      size, size_key, source_tag, run_state, first_off_status, time_from, time_to,
      raw_material_mt, total_prime_mt, total_scrap_mt, yield_pct, status, hold_status,
      created_at, created_by
    )
    SELECT tid, 'TM-DEMO-D' || d, 'A-59', 'WO-DEMO-A-59', 'BC-DEMO-A59', 'TATA', '1010',
           '{"profile":"ROUND","odMm":38.1,"thkMm":2.0,"lengthMm":6000}'::jsonb, 'OD38.1', 'SEED',
           'COMPLETE', 'APPROVED', day_ts, day_ts + interval '6 hours',
           12.0 + d, 11.0 + d * 0.8, 0.4 + d * 0.05,
           round(((11.0 + d * 0.8) / (12.0 + d)) * 1000) / 10.0,
           'CLOSED', 'NONE', day_ts, 'seed'
    WHERE NOT EXISTS (
      SELECT 1 FROM txn.prod_tm_run r WHERE r.tenant_id = tid AND r.run_no = 'TM-DEMO-D' || d
    )
    RETURNING id INTO run_id;

    IF run_id IS NULL THEN
      SELECT id INTO run_id FROM txn.prod_tm_run WHERE tenant_id = tid AND run_no = 'TM-DEMO-D' || d;
    END IF;

    IF run_id IS NOT NULL THEN
      INSERT INTO txn.stoppage_entry (
        tenant_id, run_id, mill_code, stoppage_code, category, from_time, to_time,
        duration_min, reason, is_planned, is_open, process_code, source_id, created_at
      )
      SELECT tid, run_id, 'A-59', stop_codes[1 + (d % array_length(stop_codes, 1))],
             'MECH', day_ts + interval '2 hours', day_ts + interval '2 hours 25 minutes',
             25 + d, 'Demo stoppage day ' || d, (d % 2 = 0), false, 'TM', run_id, day_ts
      WHERE NOT EXISTS (
        SELECT 1 FROM txn.stoppage_entry s
        WHERE s.tenant_id = tid AND s.run_id = run_id AND s.reason = 'Demo stoppage day ' || d
      );

      INSERT INTO txn.tm_defect (
        tenant_id, run_id, defect_code, quantity_mt, pieces, remark, created_by, created_at
      )
      SELECT tid, run_id, defect_codes[1 + (d % array_length(defect_codes, 1))],
             0.05 + d * 0.01, 2 + d, 'Demo defect day ' || d, 'seed', day_ts
      WHERE NOT EXISTS (
        SELECT 1 FROM txn.tm_defect x
        WHERE x.tenant_id = tid AND x.run_id = run_id AND x.remark = 'Demo defect day ' || d
      );

      -- Param readings for TM quality band chart
      IF to_regclass('txn.tm_param_reading') IS NOT NULL THEN
        INSERT INTO txn.tm_param_reading (
          tenant_id, mill_code, ts_hour, line_speed_mpm, weld_power_kw, in_band
        )
        SELECT tid, 'A-59', day_ts + (h || ' hours')::interval,
               42 + d + h, 100 + d, true
        FROM generate_series(0, 3) AS h
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    -- Furnace charges (all three lines)
    FOREACH furnace_code IN ARRAY furnaces LOOP
      INSERT INTO txn.prod_ann_run (
        tenant_id, charge_no, furnace_code, customer_code, grade_code, work_order_no, size,
        tube_count, ht_type,
        zone1_min_c, zone1_max_c, zone2_min_c, zone2_max_c, zone3_min_c, zone3_max_c,
        zone4_min_c, zone4_max_c, zone5_min_c, zone5_max_c, zone6_min_c, zone6_max_c,
        line_speed_mhr, total_mt, qty_mt, qty_nos, status, data_source, prod_date, shift_ref,
        created_at, updated_at
      )
      SELECT tid, 'FUR-DEMO-' || furnace_code || '-D' || d, furnace_code, 'TATA', '1010',
             'WO-DEMO-' || furnace_code,
             '{"odMm":38.1,"thkMm":2.0}'::jsonb, 100 + d * 10, 'ANNEAL',
             880, 900, 900, 920, 920, 940, 940, 960, 960, 980, 980, 1000,
             20 + d + (abs(hashtext(furnace_code)) % 5),
             3.5 + d * 0.4, 3.5 + d * 0.4, 100 + d * 10,
             CASE WHEN d = 6 THEN 'SUBMITTED' ELSE 'CLOSED' END,
             'SEED', (day_ts::date), 'A', day_ts, day_ts
      WHERE NOT EXISTS (
        SELECT 1 FROM txn.prod_ann_run r
        WHERE r.tenant_id = tid AND r.charge_no = 'FUR-DEMO-' || furnace_code || '-D' || d
      );
    END LOOP;

    -- STP lots
    INSERT INTO txn.prod_stp_lot (
      tenant_id, lot_no, customer_code, grade_code, work_order_no, size, qty_no, qty_mt,
      machine_code, degrease_temp_c, phosphate_temp_c, status, data_source, prod_date, shift_ref,
      created_at, updated_at
    )
    SELECT tid, 'STP-DEMO-D' || d, 'JINDAL', '1010', 'WO-DEMO-STP-LINE',
           '{"odMm":38.1,"thkMm":2.0}'::jsonb, 80 + d * 5, 1.1 + d * 0.15,
           'STP-LINE', 70, 80,
           CASE WHEN d = 6 THEN 'SUBMITTED' ELSE 'CLOSED' END,
           'SEED', day_ts::date, 'A', day_ts, day_ts
    WHERE NOT EXISTS (
      SELECT 1 FROM txn.prod_stp_lot l WHERE l.tenant_id = tid AND l.lot_no = 'STP-DEMO-D' || d
    );

    -- Draw bench lots (one per active bench, staggered mt)
    FOREACH bench_code IN ARRAY benches LOOP
      IF EXISTS (SELECT 1 FROM master.machine WHERE tenant_id = tid AND machine_code = bench_code) THEN
        INSERT INTO txn.prod_db_lot (
          tenant_id, lot_no, work_order_no, customer_code, grade_code, size, bench_code, draw_pass,
          from_size, to_size, stage, accepted_pcs, rejected_pcs, accepted_mt, status, data_source,
          prod_date, shift_ref, created_at, updated_at
        )
        SELECT tid, 'DB-DEMO-' || bench_code || '-D' || d, 'WO-DEMO-' || bench_code, 'AMNS', '1010',
               '{"odMm":31.8,"thkMm":1.6}'::jsonb, bench_code, '1ST',
               '{"odMm":38.1,"thkMm":2.0}'::jsonb, '{"odMm":31.8,"thkMm":1.6}'::jsonb,
               'INTER', 60 + d * 5, 1 + (d % 3),
               0.8 + d * 0.1 + (abs(hashtext(bench_code)) % 5) * 0.05,
               CASE WHEN d = 6 AND bench_code = 'DB-10T' THEN 'SUBMITTED' ELSE 'CLOSED' END,
               'SEED', day_ts::date, 'A', day_ts, day_ts
        WHERE NOT EXISTS (
          SELECT 1 FROM txn.prod_db_lot l
          WHERE l.tenant_id = tid AND l.lot_no = 'DB-DEMO-' || bench_code || '-D' || d
        );
      END IF;
    END LOOP;

    -- Swage demo lot
    IF EXISTS (SELECT 1 FROM master.machine WHERE tenant_id = tid AND machine_code = 'SWG-01') THEN
      INSERT INTO txn.prod_db_swage (
        tenant_id, lot_no, swg_machine, work_order_no, customer_code, grade_code, size,
        pieces, status, data_source, prod_date, shift_ref, created_at
      )
      SELECT tid, 'SWG-DEMO-D' || d, 'SWG-01', 'WO-DEMO-SWG-01', 'TATA', '1010',
             '{"odMm":31.8,"thkMm":1.6}'::jsonb, 40 + d, 'CLOSED', 'SEED', day_ts::date, 'A', day_ts
      WHERE NOT EXISTS (
        SELECT 1 FROM txn.prod_db_swage s WHERE s.tenant_id = tid AND s.lot_no = 'SWG-DEMO-D' || d
      );
    END IF;
  END LOOP;

  -- Open / running samples so MH dashboard counts are non-zero
  INSERT INTO txn.prod_tm_run (
    tenant_id, run_no, mill_code, work_order_no, customer_code, grade_code,
    size, size_key, source_tag, run_state, status, hold_status, created_at, created_by,
    raw_material_mt, total_prime_mt
  )
  SELECT tid, 'TM-DEMO-OPEN', 'A-59', 'WO-DEMO-A-59', 'TATA', '1010',
         '{"profile":"ROUND","odMm":25.4,"thkMm":2.6}'::jsonb, 'OD25.4', 'SEED',
         'RUNNING', 'OPEN', 'NONE', now() - interval '90 minutes', 'seed', 2.0, 0
  WHERE NOT EXISTS (SELECT 1 FROM txn.prod_tm_run WHERE tenant_id = tid AND run_no = 'TM-DEMO-OPEN');

  INSERT INTO txn.prod_ann_run (
    tenant_id, charge_no, furnace_code, customer_code, grade_code, work_order_no, size,
    tube_count, ht_type, line_speed_mhr, total_mt, status, data_source, prod_date, shift_ref,
    created_at, updated_at
  )
  SELECT tid, 'FUR-DEMO-LIVE', 'RHF-03', 'TATA', '1010', 'WO-DEMO-RHF-03',
         '{"odMm":38.1,"thkMm":2.0}'::jsonb, 90, 'ANNEAL', 21.5, 2.2, 'IN_PROGRESS', 'SEED',
         CURRENT_DATE, 'A', now() - interval '2 hours', now()
  WHERE NOT EXISTS (SELECT 1 FROM txn.prod_ann_run WHERE tenant_id = tid AND charge_no = 'FUR-DEMO-LIVE');

END $$;
