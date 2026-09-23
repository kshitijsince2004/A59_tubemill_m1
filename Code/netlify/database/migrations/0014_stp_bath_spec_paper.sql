-- Refresh STP bath analysis specs to STP-FT-01A paper ranges (idempotent upsert)
INSERT INTO master.stp_bath_spec (tenant_id, bath_code, bath_label, param_key, min_val, max_val, unit)
SELECT t.tenant_id, v.bath_code, v.bath_label, v.param_key, v.min_val, v.max_val, v.unit
FROM (SELECT DISTINCT tenant_id FROM master.stp_bath_spec
      UNION
      SELECT DISTINCT tenant_id FROM master.process) t
CROSS JOIN (
  VALUES
    ('DEGREASE','Degreasing','TA',78::numeric,90::numeric,'ml'),
    ('PICKLE','HCl pickling','HCl',6,22,'%'),
    ('PICKLE','HCl pickling','Fe',0,10,'%'),
    ('ACT','Activation','pH',7,8,''),
    ('PHOS','Phosphating','TA',32,38,'pts'),
    ('PHOS','Phosphating','FA',4,6,'pts'),
    ('PHOS','Phosphating','ACC',3,5,'pts'),
    ('PHOS','Phosphating','OXTA',18,22,'pts'),
    ('NEUT','Neutralizer','pH',8,10,''),
    ('LUBE','Lube','CON',4,6,'%'),
    ('LUBE','Lube','FA',0,1,'%'),
    ('LUBE','Lube','pH',8,10,''),
    ('RINSE','Water rinse','pH',2,10,''),
    ('OIL','Oil bath','acid_no',100,200,''),
    ('NEUT_FINAL','Neutralizer final','pH',6.5,7.5,'')
) AS v(bath_code, bath_label, param_key, min_val, max_val, unit)
ON CONFLICT (tenant_id, bath_code, param_key) DO UPDATE SET
  bath_label = EXCLUDED.bath_label,
  min_val = EXCLUDED.min_val,
  max_val = EXCLUDED.max_val,
  unit = EXCLUDED.unit;
