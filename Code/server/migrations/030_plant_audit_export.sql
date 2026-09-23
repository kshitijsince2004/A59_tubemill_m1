-- Plant Head audit trail + export job history
CREATE TABLE IF NOT EXISTS txn.audit_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  actor_username text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_audit_event_at ON txn.audit_event(tenant_id, at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_event_entity ON txn.audit_event(tenant_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS txn.export_job (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  process_code text,
  report_code text NOT NULL,
  label text,
  status text NOT NULL DEFAULT 'DONE',
  file_name text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_export_job_at ON txn.export_job(tenant_id, created_at DESC);

DO $$
BEGIN
  BEGIN
    ALTER TABLE txn.audit_event ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE txn.export_job ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
