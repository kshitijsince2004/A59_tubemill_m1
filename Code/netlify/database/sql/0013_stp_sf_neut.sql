-- STP-FT-01A: surface-finish neutralizer temp (flash dip 65–85 °C)
ALTER TABLE txn.prod_stp_lot ADD COLUMN IF NOT EXISTS sf_neut_temp_c numeric(7,1);
