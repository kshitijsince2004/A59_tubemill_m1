-- DB-FT-01 footer sign-off fields (supervisor / shift incharge)
ALTER TABLE txn.prod_db_lot
  ADD COLUMN IF NOT EXISTS supervisor_ref text,
  ADD COLUMN IF NOT EXISTS shift_incharge_ref text;
