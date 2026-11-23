import test from "node:test";
import assert from "node:assert/strict";
import { PassThrough, Readable, Writable, pipeline } from "node:stream";
import { setImmediate as nextTurn } from "node:timers/promises";
import { pipeMediaResponse } from "./pipe-media-response.ts";

test("a client abort before GCS responds does not destroy its pipeline destination", async () => {
  const source = new PassThrough();
  const response = new PassThrough();
  pipeMediaResponse(source, response, error => assert.fail(error.message));
  response.destroy();
  await nextTurn();
  assert.equal(source.destroyed, false);
  source.emit("response", {});
  assert.equal(source.destroyed, false, "GCS still needs to install its pipeline synchronously");
  assert.doesNotThrow(() => pipeline(Readable.from(["first chunk"]), source, () => {}));
  await nextTurn();
  assert.equal(source.destroyed, true);
});

test("normal media responses finish with all bytes", async () => {
  const chunks: Buffer[] = [];
  const response = new Writable({ write(chunk, _encoding, done) { chunks.push(chunk); done(); } });
  const finished = new Promise<void>(resolve => response.once("finish", resolve));
  pipeMediaResponse(Readable.from([Buffer.from("one"), Buffer.from("two")]), response, error => assert.fail(error.message));
  await finished;
  assert.equal(Buffer.concat(chunks).toString(), "onetwo");
});

test("cancellation after a response closes the source without writing a late error", async () => {
  const source = new PassThrough();
  const response = new PassThrough();
  let errors = 0;
  pipeMediaResponse(source, response, () => errors++);
  source.emit("response", {});
  source.write("first");
  response.destroy();
  await nextTurn();
  await nextTurn();
  assert.equal(source.destroyed, true);
  source.emit("error", new Error("late cancellation"));
  assert.equal(errors, 0);
});

test("an active stream error is reported", async () => {
  const source = new PassThrough();
  const response = new PassThrough();
  const errors: string[] = [];
  pipeMediaResponse(source, response, error => { errors.push(error.message); response.end(); });
  source.destroy(new Error("unavailable"));
  await nextTurn();
  assert.deepEqual(errors, ["unavailable"]);
});
