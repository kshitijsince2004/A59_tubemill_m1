-- Admin validation rule overlays (merge onto shared code rulesets at assertValid time).
CREATE SCHEMA IF NOT EXISTS config;

CREATE TABLE IF NOT EXISTS config.validation_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  process_code text NOT NULL,
  field text NOT NULL,
  rule_type text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  severity text NOT NULL DEFAULT 'ERROR',
  enabled boolean NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, process_code, field, rule_type)
);

CREATE INDEX IF NOT EXISTS ix_validation_rule_tenant_process
  ON config.validation_rule (tenant_id, process_code);

-- Seed A-59 style range overlays (idempotent).
INSERT INTO config.validation_rule (tenant_id, process_code, field, rule_type, params, severity, enabled, version)
SELECT t.tenant_id, v.process_code, v.field, v.rule_type, v.params::jsonb, v.severity, true, 1
FROM (SELECT DISTINCT tenant_id FROM master.process) t
CROSS JOIN (VALUES
  ('FUR', 'tubeCount', 'range', '{"min":0,"max":100000}', 'ERROR'),
  ('FUR', 'htType', 'oneOf', '{"values":["ANNEAL","NORMALIZE","SRA"]}', 'ERROR'),
  ('STP', 'qtyNo', 'range', '{"min":0,"max":100000}', 'ERROR'),
  ('DRW', 'drawPass', 'range', '{"min":1,"max":20}', 'ERROR')
) AS v(process_code, field, rule_type, params, severity)
ON CONFLICT (tenant_id, process_code, field, rule_type) DO NOTHING;
