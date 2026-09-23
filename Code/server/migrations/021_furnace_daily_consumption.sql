-- Independent furnace daily consumption (PNG/NH3 A/B/C) — not tied to a production run.
CREATE TABLE IF NOT EXISTS txn.fur_daily_consumption (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  furnace_code text NOT NULL,
  prod_date date NOT NULL,
  shift_ref text,
  png_a numeric(12,3),
  png_b numeric(12,3),
  png_c numeric(12,3),
  nh3_a numeric(12,3),
  nh3_b numeric(12,3),
  nh3_c numeric(12,3),
  source text NOT NULL DEFAULT 'MANUAL',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, furnace_code, prod_date)
);

CREATE INDEX IF NOT EXISTS idx_fur_daily_consumption_furnace_date
  ON txn.fur_daily_consumption (tenant_id, furnace_code, prod_date DESC);
