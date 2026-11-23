---
name: Browser recording resource recovery
description: Orphaned browser-test recordings can retain enough frame memory to interrupt Preview and shell services.
---
When Preview and shell/browser workers repeatedly disconnect without an app
crash, check process memory before assuming a code or port failure. Abandoned
FFmpeg X11 screen recorders can retain large frame queues and Xvnc surfaces.

**Why:** Multiple interrupted test sessions left orphaned recorders consuming
most available memory. Stopping those orphaned recordings also released the
large Xvnc allocation and restored stable Preview service.

**How to apply:** Identify only FFmpeg processes capturing `x11grab` whose parent
is PID 1, and confirm they belong to abandoned browser tests. Send those orphaned
recorders SIGTERM. Do not stop active recorders, Xvnc, application processes or
user media jobs. Recheck memory and restart only the affected managed workflows.
Avoid concurrent full builds and extra screenshot browsers during a live test.
