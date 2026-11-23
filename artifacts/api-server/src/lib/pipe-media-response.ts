import type { Readable, Writable } from "node:stream";

/**
 * GCS emits `response` immediately BEFORE installing its internal pipeline.
 * Destroying its lazy stream while that request is pending makes the SDK try
 * to pipe into a destroyed destination, throwing outside our error listener.
 * Unpipe immediately, then cancel after response setup (or the first chunk for
 * ordinary Readables). This never drains a whole video after a client abort.
 */
export function pipeMediaResponse(
  source: Readable,
  response: Writable,
  onError: (error: Error) => void,
): void {
  let closed = response.destroyed;
  let ready = false;
  let cancelling = false;
  const cancel = () => {
    if (!ready || cancelling || source.destroyed || source.readableEnded) return;
    cancelling = true;
    setImmediate(() => source.destroy());
  };
  const onReady = () => { ready = true; if (closed) cancel(); };
  const onClose = () => {
    closed = true;
    source.unpipe(response);
    if (source.destroyed || source.readableEnded) return;
    if (ready) cancel();
    else source.resume(); // Allow the lazy request to establish before cancelling.
  };
  source.on("error", error => {
    if (!closed && !response.destroyed) onError(error);
  });
  source.once("response", onReady);
  source.once("data", onReady);
  source.once("close", () => response.off("close", onClose));
  response.once("close", onClose);
  if (closed) onClose();
  else source.pipe(response);
}
