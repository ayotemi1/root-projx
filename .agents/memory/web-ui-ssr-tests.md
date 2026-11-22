---
name: Web UI SSR tests
description: Wouter location hooks in raw Node-rendered web control tests.
---

When rendering a Wouter-linked web component in raw Node React SSR tests, supply a Router with a static hook that returns a path and navigation function.

**Why:** The default browser hook requires `location`; Wouter's memory location hook uses an external-store subscription without the server snapshot required by React SSR. Neither works unmodified in the API package's raw Node test runner.

**How to apply:** In isolated render tests, wrap the component with a Router whose hook returns a fixed location tuple. Also supply `searchHook: () => ""` (or the required query string) when a component uses `useSearch`: the static location hook does not replace Wouter's separate browser search hook. This is for rendering only; use a browser test when actual navigation or click-to-request behavior matters.
