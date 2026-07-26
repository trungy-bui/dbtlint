# Macro-resolution fixtures

These fixtures lock down package macro resolution without downloading dbt
packages. Each directory is a deliberately tiny dbt project:

- `dbt-utils`, `dbt-expectations`, `codegen`, and `audit-helper` cover the
  supported package namespaces.
- `dispatch-pattern` vendors a package macro that calls `adapter.dispatch()`.
- `adapter-override-{snowflake,bigquery,redshift}` vendor the corresponding
  `adapter__macro` implementation.
- `nested-call` vendors a three-level package macro call chain.

Every fixture contains:

1. `dbt_project.yml`, with a unique project name and the standard `models`
   directory.
2. `packages.yml`, declaring the package namespace the lint engine may resolve.
3. `models/example.sql`, containing the smallest package macro invocation that
   reaches the resolution path.
4. `dbt_packages/<namespace>/`, containing only the macro stubs needed to
   describe the installed package behavior. CI never runs `dbt deps` and never
   accesses the network.

The integration test intentionally lints project models, not vendored package
source, matching the application boundary: dependency macros provide template
symbols but are not user-authored files to report on.

## Adding a package fixture

1. Add its canonical namespace and accepted manifest aliases to
   `PACKAGE_NAMESPACE_ALIASES` in `trigger/macroResolution.ts`.
2. Copy one of the package directories and rename the project and namespace.
3. Pin a package version in `packages.yml`.
4. Add one representative package macro call in `models/example.sql`.
5. Add a minimal offline macro stub under `dbt_packages/<namespace>/macros/`.
6. Add the directory and expected namespace to `fixtureCases` in
   `tests/macroResolution.test.ts`.
7. Run `npm run test:macro-resolution`. To include the pinned SQLFluff
   integration test, set `RUN_SQLFLUFF_INTEGRATION=1`.

Do not add generated artifacts, a dbt profile, seeds, snapshots, or downloaded
package contents. A fixture should demonstrate one resolution behavior only.
