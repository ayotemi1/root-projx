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

Keep frontend modules outside the API test program's static import graph. Load
them through an isolated bundle or a runtime-computed module URL when an API test
needs to exercise real web logic.

**Why:** API tests are type-checked with the server's root directory. Static
cross-artifact imports pull frontend source into that compilation and produce
root-directory, Vite-environment and web-alias errors even when Node tests pass.

**How to apply:** Check API types as well as runtime tests after adding
cross-artifact tests. Do not broaden the API compiler scope or add frontend
ambient types to hide a test-harness boundary problem.

Virtual fixture modules that re-export real files need a real `resolveDir`,
even when the re-export uses an absolute path.

**Why:** esbuild does not resolve filesystem imports from a custom namespace
without the fixture declaring its filesystem resolution context.

**How to apply:** Set `resolveDir` on the virtual module's load result when
partially mocking a module while retaining its actual security functions.
