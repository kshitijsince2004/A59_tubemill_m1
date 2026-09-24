-- Machine Head profile: quality specs + crew roster
CREATE TABLE IF NOT EXISTS master.process_quality_spec (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  process_code text NOT NULL,
  machine_code text,
  title text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'DRAFT',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE INDEX IF NOT EXISTS ix_process_quality_spec_process
  ON master.process_quality_spec (tenant_id, process_code, status);

CREATE TABLE IF NOT EXISTS master.machine_crew_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  machine_code text NOT NULL REFERENCES master.machine(machine_code),
  role_label text NOT NULL,
  person_name text NOT NULL,
  shift_code text NOT NULL DEFAULT 'A',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_machine_crew_machine
  ON master.machine_crew_roster (tenant_id, machine_code);

-- Furnace / STP MH gate columns
ALTER TABLE txn.prod_ann_run
  ADD COLUMN IF NOT EXISTS excursion_disposition text,
  ADD COLUMN IF NOT EXISTS excursion_note text,
  ADD COLUMN IF NOT EXISTS excursion_cleared_by text,
  ADD COLUMN IF NOT EXISTS excursion_cleared_at timestamptz;

ALTER TABLE txn.prod_stp_lot
  ADD COLUMN IF NOT EXISTS bath_sign_off_by text,
  ADD COLUMN IF NOT EXISTS bath_sign_off_at timestamptz,
  ADD COLUMN IF NOT EXISTS bath_sign_off_note text;
