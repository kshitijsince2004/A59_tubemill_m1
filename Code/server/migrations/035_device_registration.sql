-- Device registration / line binding for operator tablets (APK).
CREATE TABLE IF NOT EXISTS master.device (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  device_id text NOT NULL,
  plant_code text NOT NULL DEFAULT 'A59',
  line_code text NOT NULL,
  machine_code text,
  label text,
  status text NOT NULL DEFAULT 'ACTIVE',
  registered_by uuid,
  registered_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ck_device_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'WIPED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_master_device_tenant_device
  ON master.device (tenant_id, device_id);

CREATE INDEX IF NOT EXISTS ix_master_device_line
  ON master.device (tenant_id, line_code);

-- Optional response cache for idempotent replay (body may be null → client treats 409 as success).
ALTER TABLE txn.idempotency_key
  ADD COLUMN IF NOT EXISTS response_status integer,
  ADD COLUMN IF NOT EXISTS response_body jsonb,
  ADD COLUMN IF NOT EXISTS server_received_at timestamptz DEFAULT now();
