---
name: Inline video playback
description: Browser playback pitfalls for uploaded organisation and supporter footage
---
When starting an HTML video from a user click, avoid assigning its source both imperatively and through React state in the same gesture. React's attribute update can trigger a second load and abort the pending play request. Start playback synchronously in the click gesture, especially for phone browsers.

**Why:** A first browser pass showed every real video failing with an interrupted play request even though the MP4 itself was playable. The resulting error looked like a file/codec failure.

**How to apply:** Keep source ownership single and test with a real phone-sized browser. Seekable uploaded videos also need HTTP byte-range responses; older organisation media can carry absolute public-site URLs that bypass the Preview server, so route trusted uploaded-media paths through the current app when testing Preview.

Capture the mounted video element in lifecycle cleanup rather than reading its
React ref only during unmount.

**Why:** React can clear a DOM ref before passive effect cleanup. A shared
one-video registry can otherwise retain a detached, still-playing video after
closing or moving to another post.

**How to apply:** Pause the captured element and release its registry entry on
unmount or source changes. Opening comments must resize the existing player,
not replace or reload it.

Cancel lazy Google Cloud Storage read streams only after their response setup
has finished, not immediately when the browser disconnects.

**Why:** The installed SDK emits `response` before installing its internal
pipeline. Destroying the stream first can make that later pipeline throw outside
the stream's error listener and terminate the API process.

**How to apply:** Unpipe a disconnected response immediately; defer source
destruction until its response/first-data event and the next event-loop turn.
Keep error handling attached and avoid draining the entire abandoned video.
