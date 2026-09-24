-- TM-04: WC-to-WR distance is MANUAL until PLC; persist on independent param readings.
ALTER TABLE txn.tm_param_reading
  ADD COLUMN IF NOT EXISTS wc_to_wr_distance_mm numeric(7,2);
