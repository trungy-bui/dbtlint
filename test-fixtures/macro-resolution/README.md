# Macro-resolution fixtures

These fixtures lock down package and project-local macro resolution without
downloading dbt packages. Each directory is a deliberately tiny dbt project:

- `dbt-utils`, `dbt-expectations`, `codegen`, and `audit-helper` cover the
  supported package namespaces.
- `dispatch-pattern` vendors a package macro that calls `adapter.dispatch()`.
- `adapter-override-{snowflake,bigquery,redshift}` vendor the corresponding
  `adapter__macro` implementation.
- `nested-call` vendors a three-level package macro call chain.
- `project-local` defines an unqualified project macro that calls a second
  project macro in a nested `macros/` subdirectory.
- `project-local-pr-sparse` reproduces a GitHub PR scan where the changed model
  calls an unchanged top-level `macros/format_int.sql` definition. Its
  `changed-files.txt` records the sparse changed-file checkout.

Every package fixture contains:

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

The project-local fixture contains only `dbt_project.yml`,
`models/example.sql`, and the two macro definitions under `macros/`. It has no
package manifest or vendored dependencies. The integration test lints both the
model and local macro source so nested local calls follow the application
boundary.

The sparse PR fixture keeps the full source layout in the fixture, then tests
the GitHub path in two separate directories: changed SQL is linted from the
sparse checkout, while unchanged package manifests and local macro sources are
hydrated into a resolution-only context. Resolution support files are never
reported as changed-file lint results.

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

For a project-local fixture, omit `packages.yml` and `dbt_packages/`, place
minimal definitions under `macros/`, and list every expected macro name in the
fixture case.

Do not add generated artifacts, a dbt profile, seeds, snapshots, or downloaded
package contents. A fixture should demonstrate one resolution behavior only.
