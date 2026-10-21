---
name: Node route-test bundling
description: Why raw Node route tests must bundle generated workspace schemas and their dependencies.
---

Bundle generated workspace validators when exercising real routes under Node's
TypeScript stripping runner. Do not assume that a package resolving in the app
build can also be loaded directly by the test runner.

**Why:** Generated workspace source uses extensionless TypeScript imports that
raw Node ESM cannot resolve. Leaving its validator dependency external can also
make Node search the API package, which does not own that dependency.

**How to apply:** Keep real validation in mocked-service route tests, but resolve
the generated validator entry and its dependency from the schema-owning package
during the test bundle. Do not weaken production validation or add a runtime
dependency to the API merely to fix the test harness.
