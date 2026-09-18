-- Phase 3: PLC time-series, idempotency, band exceptions
-- Retention (O-7): demo keeps all samples; production should partition + purge.

CREATE SCHEMA IF NOT EXISTS plc;

CREATE TABLE IF NOT EXISTS plc.tag (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  mill_code text NOT NULL,
  controller text,
  signal text NOT NULL,
  unit text,
  subnet text,
  driver text
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_plc_tag_mill_signal
  ON plc.tag(tenant_id, mill_code, signal);

CREATE TABLE IF NOT EXISTS plc.sample (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL REFERENCES plc.tag(id),
  tenant_id uuid NOT NULL,
  run_id uuid,
  ts timestamptz NOT NULL DEFAULT now(),
  value double precision NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_plc_sample_tag_ts ON plc.sample(tag_id, ts DESC);
CREATE INDEX IF NOT EXISTS ix_plc_sample_run_ts ON plc.sample(run_id, ts DESC);

CREATE TABLE IF NOT EXISTS plc.collector_health (
  mill_code text NOT NULL,
  tag_id uuid,
  last_sample_at timestamptz,
  backlog integer DEFAULT 0,
  heartbeat_at timestamptz,
  PRIMARY KEY (mill_code)
);

CREATE TABLE IF NOT EXISTS txn.idempotency_key (
  key text NOT NULL,
  scope text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key)
);

CREATE TABLE IF NOT EXISTS txn.tm_exception (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES txn.prod_tm_run(id) ON DELETE CASCADE,
  mill_code text NOT NULL,
  kind text NOT NULL DEFAULT 'OUT_OF_BAND',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  is_open boolean NOT NULL DEFAULT true,
  power_kw numeric(7,2),
  detail jsonb
);

CREATE INDEX IF NOT EXISTS ix_tm_exception_run_open
  ON txn.tm_exception(tenant_id, run_id, is_open);
