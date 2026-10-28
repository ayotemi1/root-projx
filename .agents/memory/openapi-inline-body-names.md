---
name: OpenAPI body naming
description: Prevent Orval validator/type export collisions when adding request bodies.
---

Give operation request bodies explicit, named component schemas and reference them rather than defining their shapes inline.

**Why:** Inline bodies caused Orval to generate a validator and a TypeScript type with the same export name. This workspace re-exports both, so library type checking failed with TS2308 despite generation succeeding.

**How to apply:** When adding an endpoint body, use a component schema with a domain name distinct from the operation's automatically generated body-validator name. Regenerate normally; do not hand-edit generated output or remove existing barrel exports to hide the collision.
