---
name: Workflow port ownership
description: Managed restart readiness can hide orphan servers and silent Vite port drift after task merges
---

Confirm that the current managed service owns its assigned port; a green workflow
or Vite's ready message is not sufficient after a task merge.

**Why:** Obsolete pnpm/Vite children have survived managed restarts here. New
Vite processes then silently chose another port, while the artifact router kept
targeting the original port. Stale previews and intermittent 502s looked like
application bugs.

**How to apply:** Diagnose actual listener ownership before retrying a restart
or changing routing. Distinguish obsolete processes from other active artifacts;
do not create a duplicate workflow to work around a port conflict.
