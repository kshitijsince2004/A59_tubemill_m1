-- Remove obsolete Draw Bench stub machines not in Table-C workbook
DELETE FROM security.machine_access
WHERE machine_code IN ('DB-25T','DB-60T','DB-100T','DB-150T');

DELETE FROM master.db_bench_capability
WHERE bench_code IN ('DB-25T','DB-60T','DB-100T','DB-150T');

-- Reassign any lots still on stub benches to nearest Table-C code
UPDATE txn.prod_db_lot SET bench_code = 'DB-20T' WHERE bench_code = 'DB-25T';
UPDATE txn.prod_db_lot SET bench_code = 'DB-40T' WHERE bench_code = 'DB-60T';
UPDATE txn.prod_db_lot SET bench_code = 'DB-80T' WHERE bench_code = 'DB-100T';
UPDATE txn.prod_db_lot SET bench_code = 'DB-120T' WHERE bench_code = 'DB-150T';

UPDATE txn.db_shift_check SET bench_code = 'DB-20T' WHERE bench_code = 'DB-25T';
UPDATE txn.db_shift_check SET bench_code = 'DB-40T' WHERE bench_code = 'DB-60T';
UPDATE txn.db_shift_check SET bench_code = 'DB-80T' WHERE bench_code = 'DB-100T';
UPDATE txn.db_shift_check SET bench_code = 'DB-120T' WHERE bench_code = 'DB-150T';

DELETE FROM master.machine
WHERE machine_code IN ('DB-25T','DB-60T','DB-100T','DB-150T');
