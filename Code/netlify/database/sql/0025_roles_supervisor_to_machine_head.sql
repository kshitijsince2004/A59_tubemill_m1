-- Profile consolidation: SUPERVISOR → MACHINE_HEAD (ranks OPERATOR=0, MH=1, PH=2, ADMIN=3).
-- Netlify twin of server/migrations/027_roles_supervisor_to_machine_head.sql

INSERT INTO security.role (role_code, label, rank) VALUES
  ('MACHINE_HEAD', 'Machine Head', 1)
ON CONFLICT (role_code) DO UPDATE SET label = EXCLUDED.label, rank = EXCLUDED.rank;

UPDATE security.user_role SET role_code = 'MACHINE_HEAD' WHERE role_code = 'SUPERVISOR';

UPDATE security.process_access pa
SET access_level = 'APPROVE'
FROM security.user_role ur
WHERE pa.user_id = ur.user_id
  AND ur.role_code = 'MACHINE_HEAD'
  AND pa.access_level = 'WRITE';

UPDATE security.role SET rank = 2 WHERE role_code = 'PLANT_HEAD';
UPDATE security.role SET rank = 3 WHERE role_code = 'ADMIN';

DELETE FROM security.role WHERE role_code = 'SUPERVISOR';

INSERT INTO security.machine_access (user_id, machine_code, access_level, tenant_id)
SELECT DISTINCT
  pa.user_id,
  m.machine_code,
  'WRITE',
  pa.tenant_id
FROM security.process_access pa
JOIN security.user_role ur ON ur.user_id = pa.user_id AND ur.role_code = 'MACHINE_HEAD'
JOIN master.machine m
  ON m.process_code = pa.process_code
 AND m.tenant_id = pa.tenant_id
WHERE pa.access_level = 'APPROVE'
  AND NOT EXISTS (
    SELECT 1 FROM security.machine_access ma
    WHERE ma.user_id = pa.user_id
  )
ON CONFLICT (user_id, machine_code) DO NOTHING;
