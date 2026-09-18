-- Phase 4: consumables / tooling life

CREATE TABLE IF NOT EXISTS master.tm_consumable (
  code text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  kind text NOT NULL,
  spec jsonb,
  replace_threshold_mt numeric(12,3),
  replace_threshold_uses integer,
  status text NOT NULL DEFAULT 'ACTIVE',
  cumulative_tonnage_mt numeric(12,3) DEFAULT 0,
  cumulative_uses integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS txn.tm_consumable_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  consumable_code text NOT NULL REFERENCES master.tm_consumable(code),
  run_id uuid REFERENCES txn.prod_tm_run(id),
  cumulative_tonnage_mt numeric(12,3),
  cumulative_uses integer,
  delta_tonnage_mt numeric(12,3),
  visual_inspection text,
  action text,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_tm_consumable_usage_code
  ON txn.tm_consumable_usage(tenant_id, consumable_code);
