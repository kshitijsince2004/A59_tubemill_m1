-- Seed / refresh fur_zone_recipe soaking + speed specs (idempotent)
INSERT INTO master.fur_zone_recipe (tenant_id, grade_code, furnace_code, soaking_spec_c, speed_spec_m_hr)
SELECT t.tenant_id, v.grade_code, v.furnace_code, v.soaking_spec_c, v.speed_spec_m_hr
FROM (SELECT DISTINCT tenant_id FROM master.process) t
CROSS JOIN (
  VALUES
    ('1010','RHF-03',900::numeric,22::numeric),
    ('1010','RHF-04',900,22),
    ('1010','RHF-05',905,20)
) AS v(grade_code, furnace_code, soaking_spec_c, speed_spec_m_hr)
ON CONFLICT (tenant_id, grade_code, furnace_code) DO UPDATE SET
  soaking_spec_c = EXCLUDED.soaking_spec_c,
  speed_spec_m_hr = EXCLUDED.speed_spec_m_hr;
