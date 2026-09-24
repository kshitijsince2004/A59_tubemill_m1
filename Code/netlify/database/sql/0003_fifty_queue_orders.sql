-- Expand queue to 50 Pending orders (idempotent). Runs on redeploy after 0002.
DO $$
DECLARE
  tid uuid := '00000000-0000-4000-8000-000000000001';
BEGIN
  PERFORM set_config('app.tenant_id', tid::text, true);

  INSERT INTO ops.queue_card (
    id, tenant_id, mill_code, status, work_order_no, bc_batch_number,
    customer_code, grade_code, size_key, size, qty_pieces
  ) VALUES
    (
      'qc-001', tid, 'A-59', 'Pending', 'WO-2026-1042', 'BC-88421',
      'TATA', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":2.6,"lengthMm":6000}'::jsonb,
      1200
    ),
    (
      'qc-002', tid, 'A-59', 'Pending', 'WO-2026-1043', 'BC-88422',
      'JINDAL', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":3,"lengthMm":6000}'::jsonb,
      1500
    ),
    (
      'qc-003', tid, 'A-59', 'Pending', 'WO-2026-1044', 'BC-88423',
      'AMNS', '1010', 'SEC40X25(41.28)',
      '{"profile":"SECTION","aMm":40,"bMm":25,"equivOdMm":41.28,"thkMm":1.5,"lengthMm":6000}'::jsonb,
      1800
    ),
    (
      'qc-004', tid, 'A-59', 'Pending', 'WO-2026-1045', 'BC-88424',
      'TATA', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":2.6,"lengthMm":6000}'::jsonb,
      2000
    ),
    (
      'qc-005', tid, 'A-59', 'Pending', 'WO-2026-1046', 'BC-88425',
      'JINDAL', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":3,"lengthMm":6000}'::jsonb,
      2200
    ),
    (
      'qc-006', tid, 'A-59', 'Pending', 'WO-2026-1047', 'BC-88426',
      'AMNS', '1010', 'SEC40X25(41.28)',
      '{"profile":"SECTION","aMm":40,"bMm":25,"equivOdMm":41.28,"thkMm":1.5,"lengthMm":6000}'::jsonb,
      2400
    ),
    (
      'qc-007', tid, 'A-59', 'Pending', 'WO-2026-1048', 'BC-88427',
      'TATA', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":2.6,"lengthMm":6000}'::jsonb,
      2800
    ),
    (
      'qc-008', tid, 'A-59', 'Pending', 'WO-2026-1049', 'BC-88428',
      'JINDAL', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":3,"lengthMm":6000}'::jsonb,
      3000
    ),
    (
      'qc-009', tid, 'A-59', 'Pending', 'WO-2026-1050', 'BC-88429',
      'AMNS', '1010', 'SEC40X25(41.28)',
      '{"profile":"SECTION","aMm":40,"bMm":25,"equivOdMm":41.28,"thkMm":1.5,"lengthMm":6000}'::jsonb,
      3200
    ),
    (
      'qc-010', tid, 'A-59', 'Pending', 'WO-2026-1051', 'BC-88430',
      'TATA', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":2.6,"lengthMm":6000}'::jsonb,
      3600
    ),
    (
      'qc-011', tid, 'A-59', 'Pending', 'WO-2026-1052', 'BC-88431',
      'JINDAL', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":3,"lengthMm":6000}'::jsonb,
      1200
    ),
    (
      'qc-012', tid, 'A-59', 'Pending', 'WO-2026-1053', 'BC-88432',
      'AMNS', '1010', 'SEC40X25(41.28)',
      '{"profile":"SECTION","aMm":40,"bMm":25,"equivOdMm":41.28,"thkMm":1.5,"lengthMm":6000}'::jsonb,
      1500
    ),
    (
      'qc-013', tid, 'A-59', 'Pending', 'WO-2026-1054', 'BC-88433',
      'TATA', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":2.6,"lengthMm":6000}'::jsonb,
      1800
    ),
    (
      'qc-014', tid, 'A-59', 'Pending', 'WO-2026-1055', 'BC-88434',
      'JINDAL', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":3,"lengthMm":6000}'::jsonb,
      2000
    ),
    (
      'qc-015', tid, 'A-59', 'Pending', 'WO-2026-1056', 'BC-88435',
      'AMNS', '1010', 'SEC40X25(41.28)',
      '{"profile":"SECTION","aMm":40,"bMm":25,"equivOdMm":41.28,"thkMm":1.5,"lengthMm":6000}'::jsonb,
      2200
    ),
    (
      'qc-016', tid, 'A-59', 'Pending', 'WO-2026-1057', 'BC-88436',
      'TATA', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":2.6,"lengthMm":6000}'::jsonb,
      2400
    ),
    (
      'qc-017', tid, 'A-59', 'Pending', 'WO-2026-1058', 'BC-88437',
      'JINDAL', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":3,"lengthMm":6000}'::jsonb,
      2800
    ),
    (
      'qc-018', tid, 'A-59', 'Pending', 'WO-2026-1059', 'BC-88438',
      'AMNS', '1010', 'SEC40X25(41.28)',
      '{"profile":"SECTION","aMm":40,"bMm":25,"equivOdMm":41.28,"thkMm":1.5,"lengthMm":6000}'::jsonb,
      3000
    ),
    (
      'qc-019', tid, 'A-59', 'Pending', 'WO-2026-1060', 'BC-88439',
      'TATA', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":2.6,"lengthMm":6000}'::jsonb,
      3200
    ),
    (
      'qc-020', tid, 'A-59', 'Pending', 'WO-2026-1061', 'BC-88440',
      'JINDAL', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":3,"lengthMm":6000}'::jsonb,
      3600
    ),
    (
      'qc-021', tid, 'A-59', 'Pending', 'WO-2026-1062', 'BC-88441',
      'AMNS', '1010', 'SEC40X25(41.28)',
      '{"profile":"SECTION","aMm":40,"bMm":25,"equivOdMm":41.28,"thkMm":1.5,"lengthMm":6000}'::jsonb,
      1200
    ),
    (
      'qc-022', tid, 'A-59', 'Pending', 'WO-2026-1063', 'BC-88442',
      'TATA', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":2.6,"lengthMm":6000}'::jsonb,
      1500
    ),
    (
      'qc-023', tid, 'A-59', 'Pending', 'WO-2026-1064', 'BC-88443',
      'JINDAL', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":3,"lengthMm":6000}'::jsonb,
      1800
    ),
    (
      'qc-024', tid, 'A-59', 'Pending', 'WO-2026-1065', 'BC-88444',
      'AMNS', '1010', 'SEC40X25(41.28)',
      '{"profile":"SECTION","aMm":40,"bMm":25,"equivOdMm":41.28,"thkMm":1.5,"lengthMm":6000}'::jsonb,
      2000
    ),
    (
      'qc-025', tid, 'A-59', 'Pending', 'WO-2026-1066', 'BC-88445',
      'TATA', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":2.6,"lengthMm":6000}'::jsonb,
      2200
    ),
    (
      'qc-026', tid, 'A-59', 'Pending', 'WO-2026-1067', 'BC-88446',
      'JINDAL', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":3,"lengthMm":6000}'::jsonb,
      2400
    ),
    (
      'qc-027', tid, 'A-59', 'Pending', 'WO-2026-1068', 'BC-88447',
      'AMNS', '1010', 'SEC40X25(41.28)',
      '{"profile":"SECTION","aMm":40,"bMm":25,"equivOdMm":41.28,"thkMm":1.5,"lengthMm":6000}'::jsonb,
      2800
    ),
    (
      'qc-028', tid, 'A-59', 'Pending', 'WO-2026-1069', 'BC-88448',
      'TATA', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":2.6,"lengthMm":6000}'::jsonb,
      3000
    ),
    (
      'qc-029', tid, 'A-59', 'Pending', 'WO-2026-1070', 'BC-88449',
      'JINDAL', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":3,"lengthMm":6000}'::jsonb,
      3200
    ),
    (
      'qc-030', tid, 'A-59', 'Pending', 'WO-2026-1071', 'BC-88450',
      'AMNS', '1010', 'SEC40X25(41.28)',
      '{"profile":"SECTION","aMm":40,"bMm":25,"equivOdMm":41.28,"thkMm":1.5,"lengthMm":6000}'::jsonb,
      3600
    ),
    (
      'qc-031', tid, 'A-59', 'Pending', 'WO-2026-1072', 'BC-88451',
      'TATA', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":2.6,"lengthMm":6000}'::jsonb,
      1200
    ),
    (
      'qc-032', tid, 'A-59', 'Pending', 'WO-2026-1073', 'BC-88452',
      'JINDAL', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":3,"lengthMm":6000}'::jsonb,
      1500
    ),
    (
      'qc-033', tid, 'A-59', 'Pending', 'WO-2026-1074', 'BC-88453',
      'AMNS', '1010', 'SEC40X25(41.28)',
      '{"profile":"SECTION","aMm":40,"bMm":25,"equivOdMm":41.28,"thkMm":1.5,"lengthMm":6000}'::jsonb,
      1800
    ),
    (
      'qc-034', tid, 'A-59', 'Pending', 'WO-2026-1075', 'BC-88454',
      'TATA', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":2.6,"lengthMm":6000}'::jsonb,
      2000
    ),
    (
      'qc-035', tid, 'A-59', 'Pending', 'WO-2026-1076', 'BC-88455',
      'JINDAL', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":3,"lengthMm":6000}'::jsonb,
      2200
    ),
    (
      'qc-036', tid, 'A-59', 'Pending', 'WO-2026-1077', 'BC-88456',
      'AMNS', '1010', 'SEC40X25(41.28)',
      '{"profile":"SECTION","aMm":40,"bMm":25,"equivOdMm":41.28,"thkMm":1.5,"lengthMm":6000}'::jsonb,
      2400
    ),
    (
      'qc-037', tid, 'A-59', 'Pending', 'WO-2026-1078', 'BC-88457',
      'TATA', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":2.6,"lengthMm":6000}'::jsonb,
      2800
    ),
    (
      'qc-038', tid, 'A-59', 'Pending', 'WO-2026-1079', 'BC-88458',
      'JINDAL', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":3,"lengthMm":6000}'::jsonb,
      3000
    ),
    (
      'qc-039', tid, 'A-59', 'Pending', 'WO-2026-1080', 'BC-88459',
      'AMNS', '1010', 'SEC40X25(41.28)',
      '{"profile":"SECTION","aMm":40,"bMm":25,"equivOdMm":41.28,"thkMm":1.5,"lengthMm":6000}'::jsonb,
      3200
    ),
    (
      'qc-040', tid, 'A-59', 'Pending', 'WO-2026-1081', 'BC-88460',
      'TATA', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":2.6,"lengthMm":6000}'::jsonb,
      3600
    ),
    (
      'qc-041', tid, 'A-59', 'Pending', 'WO-2026-1082', 'BC-88461',
      'JINDAL', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":3,"lengthMm":6000}'::jsonb,
      1200
    ),
    (
      'qc-042', tid, 'A-59', 'Pending', 'WO-2026-1083', 'BC-88462',
      'AMNS', '1010', 'SEC40X25(41.28)',
      '{"profile":"SECTION","aMm":40,"bMm":25,"equivOdMm":41.28,"thkMm":1.5,"lengthMm":6000}'::jsonb,
      1500
    ),
    (
      'qc-043', tid, 'A-59', 'Pending', 'WO-2026-1084', 'BC-88463',
      'TATA', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":2.6,"lengthMm":6000}'::jsonb,
      1800
    ),
    (
      'qc-044', tid, 'A-59', 'Pending', 'WO-2026-1085', 'BC-88464',
      'JINDAL', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":3,"lengthMm":6000}'::jsonb,
      2000
    ),
    (
      'qc-045', tid, 'A-59', 'Pending', 'WO-2026-1086', 'BC-88465',
      'AMNS', '1010', 'SEC40X25(41.28)',
      '{"profile":"SECTION","aMm":40,"bMm":25,"equivOdMm":41.28,"thkMm":1.5,"lengthMm":6000}'::jsonb,
      2200
    ),
    (
      'qc-046', tid, 'A-59', 'Pending', 'WO-2026-1087', 'BC-88466',
      'TATA', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":2.6,"lengthMm":6000}'::jsonb,
      2400
    ),
    (
      'qc-047', tid, 'A-59', 'Pending', 'WO-2026-1088', 'BC-88467',
      'JINDAL', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":3,"lengthMm":6000}'::jsonb,
      2800
    ),
    (
      'qc-048', tid, 'A-59', 'Pending', 'WO-2026-1089', 'BC-88468',
      'AMNS', '1010', 'SEC40X25(41.28)',
      '{"profile":"SECTION","aMm":40,"bMm":25,"equivOdMm":41.28,"thkMm":1.5,"lengthMm":6000}'::jsonb,
      3000
    ),
    (
      'qc-049', tid, 'A-59', 'Pending', 'WO-2026-1090', 'BC-88469',
      'TATA', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":2.6,"lengthMm":6000}'::jsonb,
      3200
    ),
    (
      'qc-050', tid, 'A-59', 'Pending', 'WO-2026-1091', 'BC-88470',
      'JINDAL', '1010', 'OD25.4',
      '{"profile":"ROUND","odMm":25.4,"equivOdMm":25.4,"thkMm":3,"lengthMm":6000}'::jsonb,
      3600
    )
  ON CONFLICT (id) DO UPDATE SET
    work_order_no = EXCLUDED.work_order_no,
    bc_batch_number = EXCLUDED.bc_batch_number,
    customer_code = EXCLUDED.customer_code,
    grade_code = EXCLUDED.grade_code,
    size_key = EXCLUDED.size_key,
    size = EXCLUDED.size,
    qty_pieces = EXCLUDED.qty_pieces
  WHERE ops.queue_card.status = 'Pending';
END $$;
