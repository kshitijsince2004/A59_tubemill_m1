-- Idempotent reference data for Netlify deploys (replaces npm run seed CLI).
-- Sets app.tenant_id so RLS WITH CHECK accepts inserts under FORCE RLS.

DO $$
DECLARE
  tid uuid := '00000000-0000-4000-8000-000000000001';
BEGIN
  PERFORM set_config('app.tenant_id', tid::text, true);

  INSERT INTO master.machine (machine_code, tenant_id, label, saw_type, cutter_dia_min, cutter_dia_max)
  VALUES ('A-59', tid, 'A-59 ERW Tube Mill', 'FLYING', 300, 450)
  ON CONFLICT (machine_code) DO NOTHING;

  INSERT INTO master.grade (code, tenant_id, label, density_kg_m3)
  VALUES ('1010', tid, 'SAE 1010', 7850)
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO master.customer (code, tenant_id, name) VALUES
    ('TATA', tid, 'TATA'),
    ('JINDAL', tid, 'JINDAL'),
    ('AMNS', tid, 'AMNS')
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO master.stoppage_code (code, tenant_id, label, category, is_planned) VALUES
    ('TM-01', tid, 'Roll change', 'PLANNED', true),
    ('TM-02', tid, 'Welder fault', 'ELECT', false),
    ('TM-03', tid, 'Mechanical breakdown', 'MECH', false),
    ('TM-04', tid, 'Power failure', 'POWER', false),
    ('TM-05', tid, 'Utility (water/air)', 'UTILITY', false),
    ('TM-06', tid, 'Operator stop', 'OPN', false),
    ('TM-07', tid, 'Material issue', 'OTHER', false),
    ('TM-08', tid, 'Planned maintenance', 'PLANNED', true)
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO master.defect_code (code, tenant_id, label, category) VALUES
    ('D-JOINT', tid, 'Joint tube', 'PQ2'),
    ('D-SEAM', tid, 'Seam defect', 'CQ'),
    ('D-DIM', tid, 'Dimensional', 'OPEN'),
    ('D-SCRAP', tid, 'Scrap / reject', 'SCRAP')
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO master.tm_consumable (
    code, tenant_id, kind, replace_threshold_mt, replace_threshold_uses, status
  ) VALUES
    ('36', tid, 'WORK_COIL', 50, 200, 'ACTIVE'),
    ('42', tid, 'WORK_COIL', 40, 180, 'ACTIVE'),
    ('CUT-A59-1', tid, 'CUTTER', 100, 500, 'ACTIVE'),
    ('IMP-16', tid, 'IMPEDER', 80, NULL, 'ACTIVE'),
    ('FIN-01', tid, 'FIN_BLADE', 30, 100, 'ACTIVE')
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO master.tm_param_chart (
    tenant_id, size_key, thk_mm, grade_code,
    power_kw_min, power_kw_max, speed_min_mpm, speed_max_mpm,
    id_tool, od_tool, boggie, impeder, ferrite_rod, ss_rod, work_coil_id,
    seam_guide, weld_dia_mm, is_active
  )
  SELECT tid, v.size_key, v.thk_mm, v.grade_code,
         v.power_kw_min, v.power_kw_max, v.speed_min_mpm, v.speed_max_mpm,
         v.id_tool, v.od_tool, v.boggie, v.impeder, v.ferrite_rod, v.ss_rod, v.work_coil_id,
         v.seam_guide, v.weld_dia_mm, true
  FROM (VALUES
    ('OD25.4'::text, 2.6::numeric, '1010'::text, 90::numeric, 115::numeric, 35::numeric, 55::numeric,
     'R-7/8'::text, 'R-15/18'::text, '16'::text, '16 X 18'::text, '3X200'::text, '10'::text, '36'::text,
     'SG-25'::text, 25.2::numeric),
    ('OD25.4', 3.0, '1010', 95, 125, 30, 50,
     'R-7/8', 'R-15/18', '16', '16 X 18', '3X200', '10', '36',
     'SG-25', 25.2),
    ('SEC40X25(41.28)', 1.5, '1010', 25, 60, 40, 70,
     'S-40/25', 'S-41/28', '14', '14 X 16', '3X180', '8', '42',
     'SG-40', 41.28)
  ) AS v(size_key, thk_mm, grade_code, power_kw_min, power_kw_max, speed_min_mpm, speed_max_mpm,
         id_tool, od_tool, boggie, impeder, ferrite_rod, ss_rod, work_coil_id, seam_guide, weld_dia_mm)
  WHERE NOT EXISTS (
    SELECT 1 FROM master.tm_param_chart c
    WHERE c.tenant_id = tid
      AND c.size_key = v.size_key
      AND c.thk_mm = v.thk_mm
      AND c.grade_code = v.grade_code
      AND c.is_active = true
  );

  INSERT INTO ops.queue_card (
    id, tenant_id, mill_code, status, work_order_no, bc_batch_number,
    customer_code, grade_code, size_key, size, qty_pieces
  ) VALUES
    (
      'qc-001', tid, 'A-59', 'Pending', 'WO-2026-1042', 'BC-88421',
      'TATA', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":2.6,"lengthMm":6000}'::jsonb,
      2400
    ),
    (
      'qc-002', tid, 'A-59', 'Pending', 'WO-2026-1043', 'BC-88422',
      'JINDAL', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":3.0,"lengthMm":6000}'::jsonb,
      1800
    ),
    (
      'qc-003', tid, 'A-59', 'Pending', 'WO-2026-1044', 'BC-88423',
      'AMNS', '1010', 'SEC40X25(41.28)',
      '{"profile":"SECTION","aMm":40,"bMm":25,"equivOdMm":41.28,"thkMm":1.5,"lengthMm":6000}'::jsonb,
      3200
    )
  ON CONFLICT (id) DO NOTHING;
END $$;
