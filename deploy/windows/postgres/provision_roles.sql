-- Provisioning SQL for Windows plant (run as postgres superuser once).
-- Aligns with existing migrations that expect role m1_app.

CREATE DATABASE zedral_prod;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'm1_migrator') THEN
    CREATE ROLE m1_migrator LOGIN PASSWORD 'CHANGE_ME_MIGRATOR' NOSUPERUSER;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'm1_app') THEN
    CREATE ROLE m1_app LOGIN PASSWORD 'CHANGE_ME_APP' NOSUPERUSER NOBYPASSRLS;
  END IF;
END$$;

GRANT CONNECT ON DATABASE zedral_prod TO m1_app, m1_migrator;
GRANT CREATE ON DATABASE zedral_prod TO m1_migrator;

-- After schemas exist (post-migrate), grant usage (also applied by migrations):
-- GRANT USAGE ON SCHEMA master, txn, erp, security, ops, plc TO m1_app;
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA master, txn, erp, security, ops TO m1_app;

CREATE DATABASE supertokens;
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supertokens') THEN
    CREATE ROLE supertokens LOGIN PASSWORD 'CHANGE_ME_ST' NOSUPERUSER;
  END IF;
END$$;
GRANT ALL PRIVILEGES ON DATABASE supertokens TO supertokens;
