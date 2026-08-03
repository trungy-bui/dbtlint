# DBT-31 production regression fixture

The SQL and macro files in this fixture were copied byte-for-byte from
`trungy-bui/Energy-Data-Analysis-France` PR 22 at commit
`10216e9bdad9ec9f8bc747b274d014d170c19e62`.

`models/staging/stg_energy_emission.sql` is the production artifact that
reported `Found unparsable section: 'e."Pays" AS country...'`. It is UTF-8
without a BOM and uses LF line endings. Keep these files byte-identical to the
source commit; the regression test pins their SHA-256 hashes.
