# DBT-31 production regression fixture

The seven SQL and macro files in this fixture were copied byte-for-byte from
`trungy-bui/Energy-Data-Analysis-France` PR 22 at commit
`10216e9bdad9ec9f8bc747b274d014d170c19e62`.

The three production artifacts that reported PRS failures are
`stg_energy_emission.sql`, `stg_energy_intermediate.sql`, and `test.sql`.
`stg_energy_emission.sql` is UTF-8 without a BOM and contains the accented
quoted identifier `"Filière"`. Keep every file byte-identical to the source
commit; the regression test pins all seven SHA-256 hashes.
