-- Phase RBAC spine: security schema (users, roles, process/machine ACL)

CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE IF NOT EXISTS security.tenant (
  tenant_id uuid PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security.role (
  role_code text PRIMARY KEY,
  label text NOT NULL,
  rank int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS security.app_user (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES security.tenant(tenant_id),
  username text NOT NULL,
  full_name text NOT NULL,
  emp_code text,
  email text,
  pin_hash text,
  status text NOT NULL DEFAULT 'ACTIVE',
  supertokens_user_id text,
  pin_fail_count int NOT NULL DEFAULT 0,
  pin_locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, username)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_app_user_emp
  ON security.app_user(tenant_id, emp_code) WHERE emp_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_app_user_email
  ON security.app_user(tenant_id, lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_app_user_st
  ON security.app_user(supertokens_user_id) WHERE supertokens_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS security.user_role (
  user_id uuid NOT NULL REFERENCES security.app_user(user_id) ON DELETE CASCADE,
  role_code text NOT NULL REFERENCES security.role(role_code),
  tenant_id uuid NOT NULL REFERENCES security.tenant(tenant_id),
  PRIMARY KEY (user_id, role_code)
);

CREATE TABLE IF NOT EXISTS security.process_access (
  user_id uuid NOT NULL REFERENCES security.app_user(user_id) ON DELETE CASCADE,
  process_code text NOT NULL,
  access_level text NOT NULL DEFAULT 'WRITE',
  tenant_id uuid NOT NULL REFERENCES security.tenant(tenant_id),
  PRIMARY KEY (user_id, process_code),
  CHECK (access_level IN ('READ', 'WRITE', 'APPROVE'))
);

CREATE TABLE IF NOT EXISTS security.machine_access (
  user_id uuid NOT NULL REFERENCES security.app_user(user_id) ON DELETE CASCADE,
  machine_code text NOT NULL REFERENCES master.machine(machine_code),
  access_level text NOT NULL DEFAULT 'WRITE',
  tenant_id uuid NOT NULL REFERENCES security.tenant(tenant_id),
  PRIMARY KEY (user_id, machine_code),
  CHECK (access_level IN ('READ', 'WRITE', 'MANAGE'))
);

INSERT INTO security.role (role_code, label, rank) VALUES
  ('OPERATOR', 'Operator', 0),
  ('SUPERVISOR', 'Supervisor', 1),
  ('PLANT_HEAD', 'Plant Head', 3),
  ('ADMIN', 'Administrator', 4)
ON CONFLICT (role_code) DO NOTHING;

INSERT INTO security.tenant (tenant_id, name)
VALUES ('00000000-0000-4000-8000-000000000001', 'Goodluck A-59')
ON CONFLICT (tenant_id) DO NOTHING;

GRANT USAGE ON SCHEMA security TO m1_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA security TO m1_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA security
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO m1_app;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'security.app_user',
    'security.user_role',
    'security.process_access',
    'security.machine_access'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %s', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %s USING (tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) WITH CHECK (tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))',
      t
    );
  END LOOP;
END $$;
