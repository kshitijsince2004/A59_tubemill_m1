-- Bath analysis & chemical addition independent of production lot / work order

ALTER TABLE txn.stp_bath_analysis
  ALTER COLUMN lot_id DROP NOT NULL;

ALTER TABLE txn.stp_bath_analysis
  DROP CONSTRAINT IF EXISTS stp_bath_analysis_lot_id_fkey;

ALTER TABLE txn.stp_bath_analysis
  ADD CONSTRAINT stp_bath_analysis_lot_id_fkey
  FOREIGN KEY (lot_id) REFERENCES txn.prod_stp_lot(id) ON DELETE SET NULL;

ALTER TABLE txn.stp_chemical_addition
  ALTER COLUMN lot_id DROP NOT NULL;

ALTER TABLE txn.stp_chemical_addition
  DROP CONSTRAINT IF EXISTS stp_chemical_addition_lot_id_fkey;

ALTER TABLE txn.stp_chemical_addition
  ADD CONSTRAINT stp_chemical_addition_lot_id_fkey
  FOREIGN KEY (lot_id) REFERENCES txn.prod_stp_lot(id) ON DELETE SET NULL;
